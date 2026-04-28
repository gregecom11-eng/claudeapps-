import { useState } from "react";
import { useStore } from "../hooks/useStore";
import type { Task, TaskStatus } from "../lib/types";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "planned", label: "Planned" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export function TaskBoard() {
  const { state, addTask, updateTask, removeTask } = useStore();
  const [draft, setDraft] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    addTask({ title, status: "planned" });
    setDraft("");
  };

  return (
    <section className="stack">
      <form className="row gap-sm" onSubmit={submit}>
        <input
          className="input grow"
          placeholder="Add a task…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
        />
        <button className="btn" type="submit">
          Add
        </button>
      </form>

      <div className="board">
        {COLUMNS.map((col) => {
          const items = state.tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="board-col">
              <header className="board-col-header">
                <span>{col.label}</span>
                <span className="muted">{items.length}</span>
              </header>
              <ul className="stack-sm">
                {items.length === 0 ? (
                  <li className="muted small">Nothing here.</li>
                ) : (
                  items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onAdvance={() =>
                        updateTask(t.id, { status: nextStatus(t.status) })
                      }
                      onDelete={() => removeTask(t.id)}
                    />
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function nextStatus(s: TaskStatus): TaskStatus {
  return s === "planned" ? "in_progress" : s === "in_progress" ? "done" : "planned";
}

function TaskRow({
  task,
  onAdvance,
  onDelete,
}: {
  task: Task;
  onAdvance: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="card task">
      <div className="task-title">{task.title}</div>
      {task.notes ? <div className="task-notes">{task.notes}</div> : null}
      <div className="row gap-sm task-actions">
        <button className="btn-ghost" onClick={onAdvance}>
          {task.status === "done" ? "Reopen" : "Advance"}
        </button>
        <button className="btn-ghost danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
