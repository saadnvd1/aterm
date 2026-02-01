import { ProviderId, getProviderCommand, PROVIDERS } from "./providers";

export interface TerminalConfig {
  id: string;
  title: string;
  command?: string; // If empty, spawns shell
  position: "main" | "side"; // main = left (2/3), side = right stacked
}

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  gitRemote?: string;
  provider: ProviderId;
  terminals: TerminalConfig[];
  createdAt: string;
}

export interface AppConfig {
  projects: ProjectConfig[];
  defaultProvider: ProviderId;
}

export const DEFAULT_CONFIG: AppConfig = {
  projects: [],
  defaultProvider: "claude",
};

export function getDefaultTerminals(provider: ProviderId): TerminalConfig[] {
  const command = getProviderCommand(provider);
  const providerDef = PROVIDERS[provider];

  return [
    {
      id: "ai",
      title: providerDef.name,
      command,
      position: "main",
    },
    {
      id: "shell",
      title: "Shell",
      position: "side",
    },
  ];
}

export function createProject(
  name: string,
  path: string,
  provider: ProviderId = "claude",
  gitRemote?: string
): ProjectConfig {
  return {
    id: crypto.randomUUID(),
    name,
    path,
    gitRemote,
    provider,
    terminals: getDefaultTerminals(provider),
    createdAt: new Date().toISOString(),
  };
}
