import { useEffect, useMemo, useState } from "react";
import {
  deleteClient,
  exportSnapshot,
  listAllDrivers,
  listAllVehicles,
  listClients,
  sendDriverInvite,
  setDriverActive,
  setVehicleActive,
  updateMyProfile,
  upsertClient,
  upsertDriver,
  upsertVehicle,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/Avatar";
import { Icon, type IconName } from "../components/Icon";
import type {
  BillingTerms,
  Client,
  Driver,
  Vehicle,
} from "../lib/types";

const DASHBOARD_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

export function Settings() {
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="space-y-10">
      <header>
        <div
          className="text-muted"
          style={{
            fontSize: 12.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Settings
        </div>
        <h1
          className="mt-1"
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          Workshop &amp; preferences
        </h1>
        <p
          className="text-muted mt-1.5"
          style={{ fontSize: 13.5, lineHeight: 1.5 }}
        >
          Account details, your team and fleet, and the integrations that
          keep things humming.
        </p>
      </header>

      <AccountSection flash={flash} />
      <DriversSection flash={flash} />
      <VehiclesSection flash={flash} />
      <ClientsSection flash={flash} />
      <ConnectorSection flash={flash} />
      <BackupSection flash={flash} />

      {toast ? (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 surface rounded-[10px] px-4 py-2 text-sm shadow-pop pop-in"
          style={{ background: "var(--surface-2)" }}
        >
          <span className="text-success mr-2">
            <Icon name="check" size={14} />
          </span>
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ── Section primitive ─────────────────────────────────────────────── */
function Section({
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <div
            className="text-muted"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {eyebrow}
          </div>
          <h2
            className="mt-1"
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              className="text-muted mt-1"
              style={{ fontSize: 12.5, lineHeight: 1.5 }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="surface rounded-[12px]">{children}</div>
    </section>
  );
}

/* ── Account ───────────────────────────────────────────────────────── */
function AccountSection({ flash }: { flash: (m: string) => void }) {
  const { profile, session } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.full_name, profile?.phone]);

  const dirty =
    (name ?? "") !== (profile?.full_name ?? "") ||
    (phone ?? "") !== (profile?.phone ?? "");

  const save = async () => {
    setSaving(true);
    try {
      await updateMyProfile({
        full_name: name.trim() || null,
        phone: phone.trim() || null,
      });
      flash("Profile saved");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      eyebrow="01 — Account"
      title="Your account"
      subtitle="Visible to drivers and to clients on confirmations and invoices."
    >
      <div className="p-5 flex items-center gap-4">
        <Avatar name={name || profile?.full_name || "?"} size={56} />
        <div className="min-w-0">
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {name || profile?.full_name || "—"}
          </div>
          <div
            className="text-muted truncate"
            style={{ fontSize: 12.5 }}
          >
            {session?.user?.email} · {profile?.role ?? "—"}
          </div>
        </div>
      </div>
      <div
        className="grid gap-4 md:grid-cols-2 p-5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <Field label="Full name">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </Field>
        <Field label="Mobile" optional>
          <input
            className="field tnum"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (___) ___-____"
          />
        </Field>
        <Field label="Email" hint="Used for sign-in. Changing email is disabled here.">
          <input
            className="field"
            value={session?.user?.email ?? ""}
            disabled
            style={{ opacity: 0.6 }}
          />
        </Field>
      </div>
      <div
        className="flex items-center justify-end gap-2 px-5 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <PrimaryBtn onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </PrimaryBtn>
      </div>
    </Section>
  );
}

/* ── Drivers ──────────────────────────────────────────────────────── */
function DriversSection({ flash }: { flash: (m: string) => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", phone: "", email: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = () => listAllDrivers().then(setDrivers);
  useEffect(() => {
    reload();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.full_name.trim()) return;
    try {
      await upsertDriver({
        full_name: draft.full_name.trim(),
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        active: true,
      });
      setDraft({ full_name: "", phone: "", email: "" });
      setAdding(false);
      reload();
      flash("Driver added");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Add failed");
    }
  };

  const save = async (d: Driver, patch: Partial<Driver>) => {
    try {
      await upsertDriver({ ...d, ...patch });
      setEditingId(null);
      reload();
      flash("Driver updated");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Update failed");
    }
  };

  const toggleActive = async (d: Driver) => {
    try {
      await setDriverActive(d.id, !d.active);
      reload();
      flash(d.active ? "Driver deactivated" : "Driver reactivated");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const invite = async (d: Driver) => {
    if (!d.email) {
      flash("Add an email for this driver first.");
      return;
    }
    try {
      await sendDriverInvite(d.email);
      flash(`Magic link sent to ${d.email}`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Invite failed");
    }
  };

  return (
    <Section
      eyebrow="02 — Team"
      title="Drivers"
      subtitle="Anyone who chauffeurs for SDLuxury. Inactive drivers stay in your records but won't appear on the ride form."
      action={
        <button
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[13px] font-medium"
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
          onClick={() => setAdding((a) => !a)}
        >
          <Icon name={adding ? "x" : "plus"} size={13} />
          {adding ? "Cancel" : "Add driver"}
        </button>
      }
    >
      {adding ? (
        <form
          onSubmit={add}
          className="grid gap-3 md:grid-cols-3 p-4"
          style={{
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Field label="Full name">
            <input
              className="field"
              value={draft.full_name}
              onChange={(e) =>
                setDraft({ ...draft, full_name: e.target.value })
              }
              required
              autoFocus
            />
          </Field>
          <Field label="Phone" optional>
            <input
              className="field tnum"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="+1 (___) ___-____"
            />
          </Field>
          <Field label="Email" optional>
            <input
              className="field"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
          <div className="md:col-span-3 flex justify-end">
            <PrimaryBtn>Save driver</PrimaryBtn>
          </div>
        </form>
      ) : null}

      <ul>
        {drivers.length === 0 ? (
          <li className="p-5 text-muted text-sm">No drivers yet.</li>
        ) : (
          drivers.map((d) => (
            <DriverRow
              key={d.id}
              driver={d}
              editing={editingId === d.id}
              onStartEdit={() => setEditingId(d.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(patch) => save(d, patch)}
              onToggle={() => toggleActive(d)}
              onInvite={() => invite(d)}
            />
          ))
        )}
      </ul>
    </Section>
  );
}

function DriverRow({
  driver,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggle,
  onInvite,
}: {
  driver: Driver;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<Driver>) => void;
  onToggle: () => void;
  onInvite: () => void;
}) {
  const [name, setName] = useState(driver.full_name);
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [email, setEmail] = useState(driver.email ?? "");

  useEffect(() => {
    setName(driver.full_name);
    setPhone(driver.phone ?? "");
    setEmail(driver.email ?? "");
  }, [driver.id, driver.full_name, driver.phone, driver.email]);

  if (editing) {
    return (
      <li
        className="grid gap-3 md:grid-cols-3 items-end p-4"
        style={{
          background: "var(--surface-2)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <Field label="Full name">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Phone" optional>
          <input
            className="field tnum"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field
          label="Email"
          hint="Used for the driver app sign-in link."
          optional
        >
          <input
            className="field"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="md:col-span-3 flex justify-end gap-2">
          <button
            className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px]"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onClick={onCancelEdit}
          >
            Cancel
          </button>
          <PrimaryBtn
            onClick={() =>
              onSave({
                full_name: name.trim(),
                phone: phone.trim() || null,
                email: email.trim() || null,
              })
            }
            disabled={!name.trim()}
          >
            Save
          </PrimaryBtn>
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex items-center gap-3 px-4 py-3"
      style={{
        borderTop: "1px solid var(--border)",
        opacity: driver.active ? 1 : 0.55,
      }}
    >
      <Avatar name={driver.full_name} size={32} />
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>
          {driver.full_name.replace(/\s+\(.*\)$/, "")}
        </div>
        <div className="text-muted tnum truncate" style={{ fontSize: 12 }}>
          {driver.phone ?? "no phone"}
          {driver.email ? ` · ${driver.email}` : ""}
        </div>
      </div>
      {!driver.active ? (
        <span
          className="chip"
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 11,
          }}
        >
          Inactive
        </span>
      ) : driver.profile_id ? (
        <span
          className="chip"
          style={{
            background: "transparent",
            color: "var(--success)",
            fontSize: 11,
            borderColor: "color-mix(in oklab, var(--success) 35%, var(--border))",
          }}
          title="Driver has signed in and is linked to their account."
        >
          <Icon name="check" size={11} /> Linked
        </span>
      ) : null}
      <RowAction
        onClick={onInvite}
        icon="phone"
        label={
          driver.email
            ? "Send sign-in link"
            : "Add an email to enable invites"
        }
      />
      <RowAction onClick={onStartEdit} icon="note" label="Edit" />
      <RowAction
        onClick={onToggle}
        icon={driver.active ? "x" : "check"}
        label={driver.active ? "Deactivate" : "Reactivate"}
      />
    </li>
  );
}

/* ── Vehicles ─────────────────────────────────────────────────────── */
function VehiclesSection({ flash }: { flash: (m: string) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    display_name: "",
    plate: "",
    year: "",
  });

  const reload = () => listAllVehicles().then(setVehicles);
  useEffect(() => {
    reload();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.display_name.trim()) return;
    try {
      await upsertVehicle({
        display_name: draft.display_name.trim(),
        plate: draft.plate.trim() || null,
        year: draft.year ? parseInt(draft.year, 10) : null,
        active: true,
      });
      setDraft({ display_name: "", plate: "", year: "" });
      setAdding(false);
      reload();
      flash("Vehicle added");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Add failed");
    }
  };

  const toggle = async (v: Vehicle) => {
    try {
      await setVehicleActive(v.id, !v.active);
      reload();
      flash(v.active ? "Vehicle deactivated" : "Vehicle reactivated");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  return (
    <Section
      eyebrow="03 — Fleet"
      title="Vehicles"
      subtitle="Cars in service. Inactive ones won't show up when assigning rides."
      action={
        <button
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[13px] font-medium"
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
          onClick={() => setAdding((a) => !a)}
        >
          <Icon name={adding ? "x" : "plus"} size={13} />
          {adding ? "Cancel" : "Add vehicle"}
        </button>
      }
    >
      {adding ? (
        <form
          onSubmit={add}
          className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end p-4"
          style={{
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Field label="Name">
            <input
              className="field"
              value={draft.display_name}
              onChange={(e) =>
                setDraft({ ...draft, display_name: e.target.value })
              }
              placeholder="e.g. 2023 Cadillac Escalade ESV"
              required
              autoFocus
            />
          </Field>
          <Field label="Plate" optional>
            <input
              className="field tnum"
              value={draft.plate}
              onChange={(e) => setDraft({ ...draft, plate: e.target.value })}
            />
          </Field>
          <Field label="Year" optional>
            <input
              className="field tnum"
              type="number"
              min={1990}
              max={2099}
              value={draft.year}
              onChange={(e) => setDraft({ ...draft, year: e.target.value })}
            />
          </Field>
          <PrimaryBtn>Save</PrimaryBtn>
        </form>
      ) : null}

      <ul>
        {vehicles.length === 0 ? (
          <li className="p-5 text-muted text-sm">No vehicles yet.</li>
        ) : (
          vehicles.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: "1px solid var(--border)",
                opacity: v.active ? 1 : 0.55,
              }}
            >
              <span
                className="inline-grid place-items-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--accent)",
                }}
              >
                <Icon name="car" size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="truncate"
                  style={{ fontSize: 14, fontWeight: 600 }}
                >
                  {v.display_name}
                </div>
                <div
                  className="text-muted tnum truncate"
                  style={{ fontSize: 12 }}
                >
                  {v.plate ? `Plate ${v.plate}` : "no plate"}
                  {v.year ? ` · ${v.year}` : ""}
                </div>
              </div>
              {!v.active ? (
                <span
                  className="chip"
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    fontSize: 11,
                  }}
                >
                  Inactive
                </span>
              ) : null}
              <RowAction
                onClick={() => toggle(v)}
                icon={v.active ? "x" : "check"}
                label={v.active ? "Deactivate" : "Reactivate"}
              />
            </li>
          ))
        )}
      </ul>
    </Section>
  );
}

/* ── Clients ──────────────────────────────────────────────────────── */
const TERMS: { id: BillingTerms; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "zelle", label: "Zelle" },
  { id: "net_15", label: "Net 15" },
  { id: "net_30", label: "Net 30" },
  { id: "company_billing", label: "Company" },
];

function ClientsSection({ flash }: { flash: (m: string) => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<Client>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = () => listClients().then(setClients);
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q),
    );
  }, [clients, query]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name?.trim()) return;
    try {
      await upsertClient({
        name: draft.name.trim(),
        phone: draft.phone?.trim() || null,
        company: draft.company?.trim() || null,
        email: draft.email?.trim() || null,
        default_billing: draft.default_billing ?? null,
      });
      setDraft({});
      setAdding(false);
      reload();
      flash("Client added");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Add failed");
    }
  };

  const remove = async (c: Client) => {
    if (
      !confirm(
        `Delete ${c.name}? Their past rides remain but lose the client link.`,
      )
    )
      return;
    try {
      await deleteClient(c.id);
      reload();
      flash("Client deleted");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <Section
      eyebrow="04 — Clients"
      title="Recurring clients"
      subtitle="Phone, company, default billing terms — used to auto-fill the Add Ride form."
      action={
        <button
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[13px] font-medium"
          style={{
            background: "transparent",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
          onClick={() => setAdding((a) => !a)}
        >
          <Icon name={adding ? "x" : "plus"} size={13} />
          {adding ? "Cancel" : "Add client"}
        </button>
      }
    >
      <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            style={{ pointerEvents: "none" }}
          >
            <Icon name="search" size={14} />
          </span>
          <input
            className="field field-prefixed"
            placeholder="Search by name, company, or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {adding ? (
        <ClientForm
          value={draft}
          onChange={setDraft}
          onSubmit={add}
          submitLabel="Save client"
        />
      ) : null}

      <ul>
        {filtered.length === 0 ? (
          <li className="p-5 text-muted text-sm">
            {query ? "No matches." : "No clients yet."}
          </li>
        ) : (
          filtered.map((c) =>
            editingId === c.id ? (
              <ClientEditRow
                key={c.id}
                client={c}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  reload();
                  flash("Client updated");
                }}
              />
            ) : (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <Avatar name={c.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{ fontSize: 14, fontWeight: 600 }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="text-muted tnum truncate"
                    style={{ fontSize: 12 }}
                  >
                    {c.phone ?? "no phone"}
                    {c.company ? ` · ${c.company}` : ""}
                    {c.default_billing ? ` · ${c.default_billing}` : ""}
                  </div>
                </div>
                <RowAction
                  onClick={() => setEditingId(c.id)}
                  icon="note"
                  label="Edit"
                />
                <RowAction
                  onClick={() => remove(c)}
                  icon="x"
                  label="Delete"
                  danger
                />
              </li>
            ),
          )
        )}
      </ul>
    </Section>
  );
}

function ClientEditRow({
  client,
  onCancel,
  onSaved,
}: {
  client: Client;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Client>>(client);
  const [saving, setSaving] = useState(false);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertClient({
        ...draft,
        id: client.id,
        name: draft.name?.trim() || client.name,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  return (
    <li
      style={{
        background: "var(--surface-2)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <ClientForm
        value={draft}
        onChange={setDraft}
        onSubmit={onSubmit}
        submitLabel={saving ? "Saving…" : "Save changes"}
        onCancel={onCancel}
      />
    </li>
  );
}

function ClientForm({
  value,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  value: Partial<Client>;
  onChange: (v: Partial<Client>) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 md:grid-cols-2 p-4"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Field label="Name">
        <input
          className="field"
          value={value.name ?? ""}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <Field label="Company" optional>
        <input
          className="field"
          value={value.company ?? ""}
          onChange={(e) => onChange({ ...value, company: e.target.value })}
        />
      </Field>
      <Field label="Phone" optional>
        <input
          className="field tnum"
          value={value.phone ?? ""}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
        />
      </Field>
      <Field label="Email" optional>
        <input
          className="field"
          type="email"
          value={value.email ?? ""}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
        />
      </Field>
      <Field label="Default billing" optional>
        <select
          className="field"
          value={value.default_billing ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              default_billing: (e.target.value || null) as
                | BillingTerms
                | null,
            })
          }
        >
          <option value="">— None —</option>
          {TERMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2 flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center h-9 px-3 rounded-[8px] text-[13px]"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            Cancel
          </button>
        ) : null}
        <PrimaryBtn>{submitLabel}</PrimaryBtn>
      </div>
    </form>
  );
}

/* ── Connector (MCP) ───────────────────────────────────────────────── */
function ConnectorSection({ flash }: { flash: (m: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  const urlPattern = `${DASHBOARD_ORIGIN}/api/mcp/<MCP_API_KEY>`;
  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(urlPattern);
      flash("Pattern copied");
    } catch {
      flash("Copy failed");
    }
  };
  const onCheckHealth = async () => {
    try {
      const res = await fetch(`${DASHBOARD_ORIGIN}/health`);
      const body = await res.json();
      flash(body?.ok ? "Worker is alive" : "Worker not OK");
    } catch {
      flash("Health check failed");
    }
  };

  return (
    <Section
      eyebrow="05 — Integrations"
      title="Claude.ai connector"
      subtitle="The MCP endpoint Claude calls to create and read rides. Your secret API key is set as a Cloudflare secret — the dashboard cannot read it back."
    >
      <div
        className="p-4 grid gap-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <div
            className="text-muted mb-1.5"
            style={{
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Connector URL pattern
          </div>
          <div
            className="flex items-center gap-2 rounded-[8px] px-3 py-2 mono"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: 12.5,
              wordBreak: "break-all",
            }}
          >
            <span className="flex-1 min-w-0">
              {revealed
                ? urlPattern
                : urlPattern.replace("<MCP_API_KEY>", "•••••••••••••••••")}
            </span>
            <button
              className="text-muted hover:text-text"
              onClick={() => setRevealed((r) => !r)}
              aria-label="Reveal"
              title={revealed ? "Hide" : "Show"}
            >
              <Icon name={revealed ? "x" : "info"} size={14} />
            </button>
            <button
              className="text-muted hover:text-text"
              onClick={onCopy}
              aria-label="Copy"
            >
              <Icon name="copy" size={14} />
            </button>
          </div>
          <p className="help">
            Replace <code>&lt;MCP_API_KEY&gt;</code> with the secret you set
            in Cloudflare. Paste the resulting URL into Claude.ai → Settings
            → Connectors → Add custom connector.
          </p>
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-3 p-4 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="text-muted small" style={{ fontSize: 12.5 }}>
          Health endpoint:{" "}
          <code style={{ fontSize: 12 }}>{DASHBOARD_ORIGIN}/health</code>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[8px] text-[13px]"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
          onClick={onCheckHealth}
        >
          <Icon name="check" size={13} /> Check now
        </button>
      </div>
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          To rotate the key, open Cloudflare → Workers & Pages → claudeapps-1
          → Settings → Variables and Secrets → edit{" "}
          <code style={{ fontSize: 12 }}>MCP_API_KEY</code>. Then update the
          URL in Claude.
        </div>
      </div>
    </Section>
  );
}

/* ── Backup ───────────────────────────────────────────────────────── */
function BackupSection({ flash }: { flash: (m: string) => void }) {
  const [working, setWorking] = useState(false);
  const onExport = async () => {
    setWorking(true);
    try {
      const snap = await exportSnapshot();
      const blob = new Blob([JSON.stringify(snap, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sdluxury-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash(
        `Exported ${snap.rides.length} rides, ${snap.clients.length} clients`,
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : "Export failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Section
      eyebrow="06 — Backup"
      title="Export your data"
      subtitle="A JSON snapshot of every ride, client, driver, and vehicle. Useful for an offline copy or before any risky change."
    >
      <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          Saved as{" "}
          <code style={{ fontSize: 12 }}>
            sdluxury-backup-YYYY-MM-DD.json
          </code>{" "}
          to your downloads.
        </div>
        <PrimaryBtn onClick={onExport} disabled={working}>
          <Icon name="doc" size={14} />
          {working ? "Exporting…" : "Download JSON"}
        </PrimaryBtn>
      </div>
    </Section>
  );
}

/* ── Tiny atoms ───────────────────────────────────────────────────── */
function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {optional ? (
          <span
            style={{
              textTransform: "none",
              fontWeight: 400,
              marginLeft: 6,
              color: "var(--text-muted)",
            }}
          >
            · optional
          </span>
        ) : null}
      </label>
      {children}
      {hint ? <div className="help">{hint}</div> : null}
    </div>
  );
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[8px] text-[13.5px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: "var(--accent)",
        color: "#15161B",
        border: "1px solid var(--accent-strong)",
      }}
    >
      {children}
    </button>
  );
}

function RowAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-grid place-items-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid var(--border)",
        color: danger ? "var(--danger)" : "var(--text-muted)",
        background: "transparent",
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
