// Scheduled handler — runs on Cloudflare cron triggers.
//
// Two jobs every tick (5 min):
//   1. PICKUP REMINDERS: find rides where pickup_at is between
//      now+85min and now+95min, status is in {scheduled, on_the_way},
//      and reminder_sent_at is null. Push the assigned driver. Mark
//      reminder_sent_at = now to dedupe.
//   2. NEW BOOKINGS: find rides created in the last ~6 min with
//      source='booking_form' and reminder_sent_at is null. Push the
//      OWNER (every owner subscription). Mark reminder_sent_at to
//      dedupe.

import { createClient } from "@supabase/supabase-js";
import type { Env } from "./index";
import { sendPush } from "./webpush";

type PushSub = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function fmtTimeLA(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function sendToSubs(
  env: Env,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  subs: PushSub[],
  payload: { title: string; body: string; url?: string; tag?: string },
) {
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendPush(
          env,
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { ttl: 60 * 60, urgency: "high" },
        );
        if (r.gone) {
          // Browser unsubscribed — purge.
          await sb
            .from("push_subscriptions")
            .delete()
            .eq("id", s.id);
        }
      } catch {
        // Soft fail — keep going.
      }
    }),
  );
}

export async function runScheduled(env: Env): Promise<void> {
  if (
    !env.VAPID_PUBLIC_KEY ||
    !env.VAPID_PRIVATE_KEY ||
    !env.VAPID_SUBJECT ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    // Silent no-op — cron will keep firing harmlessly until configured.
    return;
  }

  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const in85 = new Date(now.getTime() + 85 * 60_000).toISOString();
  const in95 = new Date(now.getTime() + 95 * 60_000).toISOString();
  const since = new Date(now.getTime() - 6 * 60_000).toISOString();

  // ── 1. Driver pickup reminders ─────────────────────────────────
  const { data: dueRides } = await sb
    .from("rides")
    .select(
      "id, passenger_name, pickup_at, pickup_address, dropoff_address, driver_id, drivers(profile_id)",
    )
    .gte("pickup_at", in85)
    .lte("pickup_at", in95)
    .in("status", ["scheduled", "on_the_way"])
    .is("reminder_sent_at", null)
    .not("driver_id", "is", null);

  for (const r of (dueRides as unknown as
    | {
        id: string;
        passenger_name: string;
        pickup_at: string;
        pickup_address: string;
        dropoff_address: string | null;
        driver_id: string;
        drivers: { profile_id: string | null } | null;
      }[]
    | null) ?? []) {
    const profileId = r.drivers?.profile_id;
    if (!profileId) continue;
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .eq("user_id", profileId);
    if (subs && subs.length > 0) {
      await sendToSubs(env, sb, subs as PushSub[], {
        title: `Pickup in 90 min · ${r.passenger_name}`,
        body: `${fmtTimeLA(r.pickup_at)} · ${r.pickup_address}${
          r.dropoff_address ? ` → ${r.dropoff_address}` : ""
        }`,
        url: "/",
        tag: `ride-${r.id}`,
      });
    }
    // Mark sent regardless of subs found, so we don't keep checking.
    await sb
      .from("rides")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", r.id);
  }

  // ── 2. New booking-form requests → owners ──────────────────────
  const { data: newBookings } = await sb
    .from("rides")
    .select("id, passenger_name, pickup_at, pickup_address, source, created_at")
    .eq("source", "booking_form")
    .gte("created_at", since)
    .is("reminder_sent_at", null);

  if (newBookings && newBookings.length > 0) {
    const { data: ownerProfiles } = await sb
      .from("profiles")
      .select("id")
      .eq("role", "owner");
    if (ownerProfiles && ownerProfiles.length > 0) {
      const ownerIds = ownerProfiles.map((p) => p.id);
      const { data: ownerSubs } = await sb
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", ownerIds);
      for (const r of newBookings) {
        if (ownerSubs && ownerSubs.length > 0) {
          await sendToSubs(env, sb, ownerSubs as PushSub[], {
            title: `New booking request · ${r.passenger_name}`,
            body: `${fmtTimeLA(r.pickup_at as string)} · ${r.pickup_address}`,
            url: `/rides/${r.id}`,
            tag: `req-${r.id}`,
          });
        }
        await sb
          .from("rides")
          .update({ reminder_sent_at: now.toISOString() })
          .eq("id", r.id);
      }
    }
  }
}
