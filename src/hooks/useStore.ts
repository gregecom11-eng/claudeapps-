import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  type AgentSnapshot,
  type AppState,
  type EventItem,
  type Settings,
  type Task,
  EMPTY_STATE,
} from "../lib/types";
import { loadState, saveState, uid } from "../lib/storage";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "addTask"; task: Omit<Task, "id" | "updatedAt"> }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "removeTask"; id: string }
  | { type: "addEvent"; event: Omit<EventItem, "id"> }
  | { type: "updateEvent"; id: string; patch: Partial<EventItem> }
  | { type: "removeEvent"; id: string }
  | { type: "appendLog"; source: string; message: string; metadata?: Record<string, unknown> }
  | { type: "setAgent"; snapshot: AgentSnapshot }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "replaceAll"; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
    case "replaceAll":
      return action.state;
    case "addTask":
      return {
        ...state,
        tasks: [
          { ...action.task, id: uid(), updatedAt: new Date().toISOString() },
          ...state.tasks,
        ],
      };
    case "updateTask":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, ...action.patch, updatedAt: new Date().toISOString() }
            : t,
        ),
      };
    case "removeTask":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case "addEvent":
      return {
        ...state,
        events: [{ ...action.event, id: uid() }, ...state.events],
      };
    case "updateEvent":
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, ...action.patch } : e,
        ),
      };
    case "removeEvent":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    case "appendLog":
      return {
        ...state,
        agentLogs: [
          {
            id: uid(),
            source: action.source,
            message: action.message,
            timestamp: new Date().toISOString(),
            metadata: action.metadata,
          },
          ...state.agentLogs,
        ].slice(0, 500),
      };
    case "setAgent":
      return { ...state, agent: action.snapshot };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
  }
}

type Ctx = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // Convenience helpers
  addTask: (t: Omit<Task, "id" | "updatedAt">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addEvent: (e: Omit<EventItem, "id">) => void;
  updateEvent: (id: string, patch: Partial<EventItem>) => void;
  removeEvent: (id: string) => void;
  appendLog: (source: string, message: string, metadata?: Record<string, unknown>) => void;
  setAgent: (s: AgentSnapshot) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (s: AppState) => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);

  // Hydrate once on mount.
  useEffect(() => {
    dispatch({ type: "hydrate", state: loadState() });
  }, []);

  // Persist on every change.
  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      dispatch,
      addTask: (task) => dispatch({ type: "addTask", task }),
      updateTask: (id, patch) => dispatch({ type: "updateTask", id, patch }),
      removeTask: (id) => dispatch({ type: "removeTask", id }),
      addEvent: (event) => dispatch({ type: "addEvent", event }),
      updateEvent: (id, patch) => dispatch({ type: "updateEvent", id, patch }),
      removeEvent: (id) => dispatch({ type: "removeEvent", id }),
      appendLog: (source, message, metadata) =>
        dispatch({ type: "appendLog", source, message, metadata }),
      setAgent: (snapshot) => dispatch({ type: "setAgent", snapshot }),
      updateSettings: (patch) => dispatch({ type: "updateSettings", patch }),
      replaceAll: (s) => dispatch({ type: "replaceAll", state: s }),
    }),
    [state],
  );

  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

// Derived selectors that views call frequently.
export function useKpis() {
  const { state } = useStore();
  return useCallback(() => {
    const inProgress = state.tasks.filter((t) => t.status === "in_progress").length;
    const planned = state.tasks.filter((t) => t.status === "planned").length;
    const done = state.tasks.filter((t) => t.status === "done").length;
    const now = Date.now();
    const upcoming = state.events.filter(
      (e) => new Date(e.datetime).getTime() >= now && e.status === "scheduled",
    ).length;
    return { inProgress, planned, done, upcoming };
  }, [state])();
}
