// Provider registry pattern adapted from agent-os

export type ProviderId = "claude" | "opencode" | "codex" | "aider" | "cursor" | "gemini" | "shell";

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  cli: string;
  description: string;
  supportsResume: boolean;
  modelFlag?: string;
  defaultArgs?: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    cli: "claude",
    description: "Anthropic's Claude Code CLI",
    supportsResume: true,
    defaultArgs: [],
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    cli: "opencode",
    description: "Open-source AI coding assistant",
    supportsResume: false,
  },
  codex: {
    id: "codex",
    name: "Codex",
    cli: "codex",
    description: "OpenAI Codex CLI",
    supportsResume: false,
  },
  aider: {
    id: "aider",
    name: "Aider",
    cli: "aider",
    description: "AI pair programming in your terminal",
    supportsResume: false,
    modelFlag: "--model",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    cli: "cursor",
    description: "Cursor AI CLI",
    supportsResume: false,
  },
  gemini: {
    id: "gemini",
    name: "Gemini CLI",
    cli: "gemini",
    description: "Google's Gemini CLI",
    supportsResume: false,
  },
  shell: {
    id: "shell",
    name: "Shell",
    cli: "",
    description: "Plain terminal shell",
    supportsResume: false,
  },
};

export function getProviderCommand(providerId: ProviderId): string | undefined {
  const provider = PROVIDERS[providerId];
  if (!provider || providerId === "shell") return undefined;
  return provider.cli;
}

export function getProviderList(): ProviderDefinition[] {
  return Object.values(PROVIDERS);
}
