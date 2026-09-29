import { create } from "zustand";

interface WorkflowRunState {
  currentRunId: string | null;
  status: "idle" | "pending" | "running" | "success" | "failed";
  progress: { value: number; max: number } | null;
  currentNode: string | null;
  resultData: Record<string, unknown> | null;
  errorMessage: string | null;

  startRun: (runId: string) => void;
  setProgress: (value: number, max: number) => void;
  setExecutingNode: (node: string | null) => void;
  setSuccess: (resultData: Record<string, unknown>) => void;
  setFailed: (errorMessage: string) => void;
  reset: () => void;
}

export const useWorkflowRunStore = create<WorkflowRunState>()((set) => ({
  currentRunId: null,
  status: "idle",
  progress: null,
  currentNode: null,
  resultData: null,
  errorMessage: null,

  startRun: (runId: string) =>
    set({
      currentRunId: runId,
      status: "running",
      progress: null,
      currentNode: null,
      resultData: null,
      errorMessage: null,
    }),

  setProgress: (value: number, max: number) =>
    set({ progress: { value, max } }),

  setExecutingNode: (node: string | null) =>
    set({ currentNode: node }),

  setSuccess: (resultData: Record<string, unknown>) =>
    set({ status: "success", resultData }),

  setFailed: (errorMessage: string) =>
    set({ status: "failed", errorMessage }),

  reset: () =>
    set({
      currentRunId: null,
      status: "idle",
      progress: null,
      currentNode: null,
      resultData: null,
      errorMessage: null,
    }),
}));
