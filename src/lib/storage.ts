import { type AppState, EMPTY_STATE, DEFAULT_SETTINGS } from "./types";

const KEY = "limo.dashboard.v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      tasks: parsed.tasks ?? [],
      events: parsed.events ?? [],
      agentLogs: parsed.agentLogs ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      agent: parsed.agent,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode — ignore. Export/import remains as fallback.
  }
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJson(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState>;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid backup file");
  }
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    agentLogs: Array.isArray(parsed.agentLogs) ? parsed.agentLogs : [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    agent: parsed.agent,
  };
}

export function downloadBackup(state: AppState): void {
  const blob = new Blob([exportJson(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `limo-dashboard-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
