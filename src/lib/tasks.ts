export interface Task {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  worktreePath: string;
  initialPrompt?: string;
  status: "idle" | "active";
  createdAt: string;
  promptInjected?: boolean;
  isRemote?: boolean; // If true, runs on remote server via SSH
  remoteTmuxSession?: string; // tmux session name on remote for reconnection
}

export function createTask(
  projectId: string,
  name: string,
  branch: string,
  worktreePath: string,
  initialPrompt?: string,
  isRemote?: boolean,
  remoteTmuxSession?: string
): Task {
  return {
    id: crypto.randomUUID(),
    projectId,
    name,
    branch,
    worktreePath,
    initialPrompt: initialPrompt?.trim() || undefined,
    status: "idle",
    createdAt: new Date().toISOString(),
    promptInjected: false,
    isRemote,
    remoteTmuxSession,
  };
}

