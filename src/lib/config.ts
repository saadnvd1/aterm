import { ProviderId } from "./providers";
import { TerminalProfile, DEFAULT_PROFILES } from "./profiles";
import { Layout, DEFAULT_LAYOUTS } from "./layouts";

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  gitRemote?: string;
  provider: ProviderId;
  layoutId: string;
  createdAt: string;
}

export interface AppConfig {
  projects: ProjectConfig[];
  profiles: TerminalProfile[];
  layouts: Layout[];
  defaultProvider: ProviderId;
  defaultLayoutId: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  projects: [],
  profiles: DEFAULT_PROFILES,
  layouts: DEFAULT_LAYOUTS,
  defaultProvider: "claude",
  defaultLayoutId: "ai-shell",
};

export function createProject(
  name: string,
  path: string,
  provider: ProviderId = "claude",
  gitRemote?: string,
  layoutId: string = "ai-shell"
): ProjectConfig {
  return {
    id: crypto.randomUUID(),
    name,
    path,
    gitRemote,
    provider,
    layoutId,
    createdAt: new Date().toISOString(),
  };
}

// Helper to get layout for a project
export function getProjectLayout(
  config: AppConfig,
  project: ProjectConfig
): Layout | undefined {
  return config.layouts.find((l) => l.id === project.layoutId);
}

// Helper to get profile by ID
export function getProfile(
  config: AppConfig,
  profileId: string
): TerminalProfile | undefined {
  return config.profiles.find((p) => p.id === profileId);
}
