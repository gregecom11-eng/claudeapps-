// Scheduled handler — Cloudflare cron triggers (every ~5 min).
//
// Two passes per tick:
//
//   1. ENQUEUE pickup reminders. Find rides whose pickup_at is between
//      now+85min and now+95min, status ∈ {scheduled, on_the_way},
//      assigned, and not yet reminded — insert into notification_events.
//      Idempotent via dedupe_key='pickup_reminder:<ride_id>'.
//
//   2. DISPATCH pending events. Read notification_events where
//      status='pending' and scheduled_for <= now(), resolve recipients,
//      apply prefs + quiet hours, send Web Push, log per-endpoint result
//      to notification_deliveries, update event status.
//
// All ride-event triggers (created, assigned, status changes,
// cancellations) are inserted by Postgres triggers — the dispatcher
// stays uniform across all kinds.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./index";
import { sendPush } from "./webpush";

type PushSub = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Recipient =
  | { user_id: string; role?: undefined }
  | { role: string; user_id?: undefined };

type PayloadShape = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  urgency?: "very-low" | "low" | "normal" | "high";
};

type EventRow = {
  id: string;
  kind:
    | "ride_created"
    | "ride_assigned"
    | "ride_status_changed"
    | "ride_cancelled"
    | "pickup_reminder";
  ride_id: string | null;
  recipients: Recipient[];
  payload: PayloadShape;
  scheduled_for: string;
  attempts: number;
};

type QuietHours = {
  user_id: string;
  start_local: string;
  end_local: string;
  tz: string;
};

// Kinds that bypass quiet hours — operationally critical.
const URGENT_KINDS = new Set<EventRow["kind"]>([
  "ride_cancelled",
  "ride_created",
]);

function fmtTimeLA(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Quiet hours check ─────────────────────────────────────────────
// Returns true if `now` falls inside the user's quiet window.
function inQuietHours(now: Date, qh: QuietHours): boolean {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: qh.tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const cur = `${hh}:${mm}`;
  const start = qh.start_local.slice(0, 5);
  const end = qh.end_local.slice(0, 5);
  if (start === end) return false;
  if (start < end) {
    // Same-day window, e.g. 13:00–17:00.
    return cur >= start && cur < end;
  }
  // Overnight window, e.g. 22:00–07:00.
  return cur >= start || cur < end;
}

// ── Pass 1: enqueue pickup reminders ──────────────────────────────
async function enqueuePickupReminders(
  sb: SupabaseClient,
  now: Date,
): Promise<void> {
  const in85 = new Date(now.getTime() + 85 * 60_000).toISOString();
  const in95 = new Date(now.getTime() + 95 * 60_000).toISOString();
  const { data: dueRides } = await sb
    .from("rides")
    .select(
      "id, passenger_name, pickup_at, pickup_address, dropoff_address, driver_id, drivers(profile_id)",
    )
    .gte("pickup_at", in85)
    .lte("pickup_at", in95)
    .in("status", ["scheduled", "on_the_way"])
    .not("driver_id", "is", null);

  type DueRow = {
    id: string;
    passenger_name: string;
    pickup_at: string;
    pickup_address: string;
    dropoff_address: string | null;
    driver_id: string;
    drivers: { profile_id: string | null } | null;
  };
  for (const r of (dueRides as unknown as DueRow[] | null) ?? []) {
    const profileId = r.drivers?.profile_id;
    if (!profileId) continue;
    const loc = r.dropoff_address
      ? `${r.pickup_address} → ${r.dropoff_address}`
      : r.pickup_address;
    await sb.rpc("enqueue_notification", {
      p_kind: "pickup_reminder",
      p_ride_id: r.id,
      p_recipients: [{ user_id: profileId }],
      p_payload: {
        title: `Pickup in 90 min · ${r.passenger_name}`,
        body: `${fmtTimeLA(r.pickup_at)} · ${loc}`,
        url: "/",
        tag: `pickup-${r.id}`,
        urgency: "high",
      },
      p_scheduled_for: now.toISOString(),
      p_dedupe_key: `pickup_reminder:${r.id}`,
    });
    // Also stamp the ride for the legacy "reminder sent" UI hint.
    await sb
      .from("rides")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", r.id)
      .is("reminder_sent_at", null);
  }
}

// ── Pass 2: dispatcher ────────────────────────────────────────────
async function resolveSubscriptions(
  sb: SupabaseClient,
  recipients: Recipient[],
): Promise<{ subs: PushSub[]; userIds: Set<string> }> {
  const directIds = new Set<string>();
  let needOwners = false;
  for (const r of recipients) {
    if ("user_id" in r && r.user_id) directIds.add(r.user_id);
    if ("role" in r && r.role === "owner") needOwners = true;
  }
  if (needOwners) {
    const { data: owners } = await sb
      .from("profiles")
      .select("id")
      .eq("role", "owner");
    for (const o of (owners as { id: string }[] | null) ?? []) {
      directIds.add(o.id);
    }
  }
  if (directIds.size === 0) return { subs: [], userIds: directIds };
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", Array.from(directIds));
  return { subs: (subs as PushSub[] | null) ?? [], userIds: directIds };
}

async function applyPrefs(
  sb: SupabaseClient,
  userIds: string[],
  kind: EventRow["kind"],
  now: Date,
): Promise<{ allowed: Set<string>; blocked: Map<string, string> }> {
  const allowed = new Set<string>(userIds);
  const blocked = new Map<string, string>();
  if (userIds.length === 0) return { allowed, blocked };

  // Per-kind opt-out.
  const { data: prefs } = await sb
    .from("notification_prefs")
    .select("user_id, enabled")
    .in("user_id", userIds)
    .eq("kind", kind);
  for (const p of (prefs as { user_id: string; enabled: boolean }[] | null) ??
    []) {
    if (!p.enabled) {
      allowed.delete(p.user_id);
      blocked.set(p.user_id, "opted out");
    }
  }

  // Quiet hours — skip for urgent kinds.
  if (!URGENT_KINDS.has(kind) && allowed.size > 0) {
    const { data: qhs } = await sb
      .from("notification_quiet_hours")
      .select("user_id, start_local, end_local, tz")
      .in("user_id", Array.from(allowed));
    for (const qh of (qhs as QuietHours[] | null) ?? []) {
      if (inQuietHours(now, qh)) {
        allowed.delete(qh.user_id);
        blocked.set(qh.user_id, "quiet hours");
      }
    }
  }
  return { allowed, blocked };
}

async function dispatchEvent(
  env: Env,
  sb: SupabaseClient,
  ev: EventRow,
  now: Date,
): Promise<void> {
  const { subs, userIds } = await resolveSubscriptions(sb, ev.recipients);
  const userIdList = Array.from(userIds);
  const { allowed, blocked } = await applyPrefs(sb, userIdList, ev.kind, now);
  const eligibleSubs = subs.filter((s) => allowed.has(s.user_id));

  if (eligibleSubs.length === 0) {
    const reason =
      userIdList.length === 0
        ? "no recipients resolved"
        : subs.length === 0
          ? "recipients have no devices subscribed"
          : `all recipients filtered (${
              Array.from(blocked.values()).join(", ") || "no devices"
            })`;
    await sb
      .from("notification_events")
      .update({
        status: "skipped",
        attempts: ev.attempts + 1,
        last_error: reason,
        sent_at: now.toISOString(),
      })
      .eq("id", ev.id);
    return;
  }

  let anyOk = false;
  let anyError: string | null = null;
  await Promise.all(
    eligibleSubs.map(async (s) => {
      let httpStatus = 0;
      let ok = false;
      let error: string | null = null;
      try {
        const r = await sendPush(
          env,
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(ev.payload),
          { ttl: 60 * 60, urgency: ev.payload.urgency ?? "normal" },
        );
        httpStatus = r.status;
        ok = r.ok;
        if (r.gone) {
          await sb.from("push_subscriptions").delete().eq("id", s.id);
        } else if (!r.ok) {
          error = `HTTP ${r.status}`;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "send failed";
      }
      if (ok) anyOk = true;
      else if (error && !anyError) anyError = error;
      await sb.from("notification_deliveries").insert({
        event_id: ev.id,
        subscription_id: s.id,
        user_id: s.user_id,
        http_status: httpStatus,
        ok,
        error,
      });
    }),
  );

  await sb
    .from("notification_events")
    .update({
      status: anyOk ? "sent" : "failed",
      attempts: ev.attempts + 1,
      last_error: anyOk ? null : anyError,
      sent_at: now.toISOString(),
    })
    .eq("id", ev.id);
}

async function dispatchPending(
  env: Env,
  sb: SupabaseClient,
  now: Date,
): Promise<void> {
  const { data: events } = await sb
    .from("notification_events")
    .select(
      "id, kind, ride_id, recipients, payload, scheduled_for, attempts",
    )
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);
  for (const ev of (events as EventRow[] | null) ?? []) {
    try {
      await dispatchEvent(env, sb, ev, now);
    } catch (e) {
      await sb
        .from("notification_events")
        .update({
          attempts: ev.attempts + 1,
          last_error: e instanceof Error ? e.message : "dispatch error",
        })
        .eq("id", ev.id);
    }
  }
}

export async function runScheduled(env: Env): Promise<void> {
  if (
    !env.VAPID_PUBLIC_KEY ||
    !env.VAPID_PRIVATE_KEY ||
    !env.VAPID_SUBJECT ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return;
  }

  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  await enqueuePickupReminders(sb, now);
  await dispatchPending(env, sb, now);
}
