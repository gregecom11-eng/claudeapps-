import { useMemo, useState } from "react";
import { useStore } from "../hooks/useStore";
import type { EventItem } from "../lib/types";

type Filter = "upcoming" | "past";

export function EventsList() {
  const { state, addEvent, updateEvent, removeEvent } = useStore();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [draft, setDraft] = useState({ title: "", datetime: "", location: "" });

  const grouped = useMemo(() => groupByDay(state.events, filter), [state.events, filter]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.title.trim();
    const datetime = draft.datetime.trim();
    if (!title || !datetime) return;
    const iso = new Date(datetime).toISOString();
    addEvent({
      title,
      datetime: iso,
      location: draft.location.trim() || undefined,
      status: "scheduled",
    });
    setDraft({ title: "", datetime: "", location: "" });
  };

  return (
    <section className="stack">
      <div className="row gap-sm">
        <button
          className={`chip ${filter === "upcoming" ? "active" : ""}`}
          onClick={() => setFilter("upcoming")}
        >
          Upcoming
        </button>
        <button
          className={`chip ${filter === "past" ? "active" : ""}`}
          onClick={() => setFilter("past")}
        >
          Past
        </button>
      </div>

      <form className="card stack-sm" onSubmit={submit}>
        <input
          className="input"
          placeholder="Event title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <div className="row gap-sm">
          <input
            className="input grow"
            type="datetime-local"
            value={draft.datetime}
            onChange={(e) => setDraft({ ...draft, datetime: e.target.value })}
          />
          <input
            className="input grow"
            placeholder="Location (optional)"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
          />
        </div>
        <button className="btn" type="submit">
          Add event
        </button>
      </form>

      {grouped.length === 0 ? (
        <div className="muted">No {filter} events.</div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day} className="stack-sm">
            <div className="day-header">{day}</div>
            <ul className="stack-sm">
              {items.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  onComplete={() => updateEvent(e.id, { status: "completed" })}
                  onCancel={() => updateEvent(e.id, { status: "cancelled" })}
                  onDelete={() => removeEvent(e.id)}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function groupByDay(events: EventItem[], filter: Filter): [string, EventItem[]][] {
  const now = Date.now();
  const filtered = events
    .filter((e) =>
      filter === "upcoming"
        ? new Date(e.datetime).getTime() >= now
        : new Date(e.datetime).getTime() < now,
    )
    .sort((a, b) => {
      const t = new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      return filter === "upcoming" ? t : -t;
    });
  const map = new Map<string, EventItem[]>();
  for (const e of filtered) {
    const day = new Date(e.datetime).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    map.set(day, [...(map.get(day) ?? []), e]);
  }
  return [...map.entries()];
}

function EventRow({
  event,
  onComplete,
  onCancel,
  onDelete,
}: {
  event: EventItem;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const time = new Date(event.datetime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li className="card event">
      <div className="row between">
        <div className="event-title">{event.title}</div>
        <div className={`badge ${event.status}`}>{event.status}</div>
      </div>
      <div className="muted small">
        {time}
        {event.location ? ` · ${event.location}` : ""}
      </div>
      {event.notes ? <div className="task-notes">{event.notes}</div> : null}
      <div className="row gap-sm task-actions">
        {event.status === "scheduled" ? (
          <>
            <button className="btn-ghost" onClick={onComplete}>
              Mark complete
            </button>
            <button className="btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          </>
        ) : null}
        <button className="btn-ghost danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
