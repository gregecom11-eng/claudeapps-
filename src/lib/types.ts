export type TaskStatus = "planned" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  notes?: string;
  updatedAt: string; // ISO
};

export type EventStatus = "scheduled" | "completed" | "cancelled";

export type EventItem = {
  id: string;
  title: string;
  datetime: string; // ISO
  location?: string;
  notes?: string;
  status: EventStatus;
};

export type AgentLog = {
  id: string;
  source: string;
  message: string;
  timestamp: string; // ISO
  metadata?: Record<string, unknown>;
};

export type AgentSnapshot = {
  summary: string;
  currentStep: string;
  confidence: number;
  todos: { title: string; status: TaskStatus }[];
  events: { title: string; datetime: string; location?: string; notes?: string }[];
  logs: { source: string; message: string; timestamp: string }[];
  fetchedAt: string;
};

export type Settings = {
  pollIntervalSec: number;
  theme: "light" | "dark" | "system";
  syncEnabled: boolean;
};

export type AppState = {
  tasks: Task[];
  events: EventItem[];
  agentLogs: AgentLog[];
  settings: Settings;
  agent?: AgentSnapshot;
};

export const DEFAULT_SETTINGS: Settings = {
  pollIntervalSec: 30,
  theme: "system",
  syncEnabled: false,
};

export const EMPTY_STATE: AppState = {
  tasks: [],
  events: [],
  agentLogs: [],
  settings: DEFAULT_SETTINGS,
};
