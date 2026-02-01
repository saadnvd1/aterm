// Terminal profiles - reusable terminal configurations (like iTerm2 profiles)

export type ProfileType = "terminal" | "git";

export interface TerminalProfile {
  id: string;
  name: string;
  command?: string; // If empty, spawns default shell
  color: string; // Accent color for pane header
  icon?: string;
  type?: ProfileType; // Defaults to "terminal"
}

// Default profiles that come with aTerm
export const DEFAULT_PROFILES: TerminalProfile[] = [
  {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    color: "#7c5cff",
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    color: "#00d4aa",
  },
  {
    id: "aider",
    name: "Aider",
    command: "aider",
    color: "#ff6b6b",
  },
  {
    id: "shell",
    name: "Shell",
    command: undefined,
    color: "#888888",
  },
  {
    id: "dev-server",
    name: "Dev Server",
    command: "npm run dev",
    color: "#4ecdc4",
  },
  {
    id: "tests",
    name: "Tests",
    command: "npm test -- --watch",
    color: "#ffe66d",
  },
  {
    id: "git",
    name: "Git",
    color: "#f97316",
    type: "git",
  },
];

export function createProfile(
  name: string,
  command?: string,
  color: string = "#888888"
): TerminalProfile {
  return {
    id: crypto.randomUUID(),
    name,
    command,
    color,
  };
}
