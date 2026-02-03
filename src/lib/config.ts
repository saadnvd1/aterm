import { ProviderId } from "./providers";
import type { Task } from "./tasks";
import type { SSHConnection } from "./ssh";
import { TerminalProfile, DEFAULT_PROFILES } from "./profiles";
import { Layout, DEFAULT_LAYOUTS } from "./layouts";

export interface ProjectConfig {
  id: string;
  name: string;
  path: string;
  gitRemote?: string;
  provider: ProviderId;
  layoutId: string;
  skipPermissions?: boolean;
  createdAt: string;
  icon?: string; // Emoji or icon identifier
  color?: string; // Hex color for project branding (affects terminal headers)
  tasks?: Task[];
  sshConnectionId?: string; // References SSHConnection.id for remote execution
  remoteProjectPath?: string; // Path on remote server (e.g., /home/user/dev/myproject)
}

export interface AppConfig {
  projects: ProjectConfig[];
  profiles: TerminalProfile[];
  layouts: Layout[];
  defaultProvider: ProviderId;
  defaultLayoutId: string;
  sidebarVisible?: boolean;
  defaultFontSize?: number;
  defaultScrollback?: number; // Lines to keep in scrollback buffer (default: 10000)
  // Per-pane font size overrides, keyed by pane instance ID (e.g., "projectId-paneId")
  paneFontSizes?: Record<string, number>;
  sshConnections?: SSHConnection[]; // SSH connections for remote task execution
}

export const DEFAULT_CONFIG: AppConfig = {
  projects: [],
  profiles: DEFAULT_PROFILES,
  layouts: DEFAULT_LAYOUTS,
  defaultProvider: "claude",
  defaultLayoutId: "ai-shell",
  sidebarVisible: true,
  defaultFontSize: 13,
  defaultScrollback: 10000,
  paneFontSizes: {},
  sshConnections: [],
};

export interface CreateProjectOptions {
  gitRemote?: string;
  layoutId?: string;
  skipPermissions?: boolean;
  sshConnectionId?: string;
  remoteProjectPath?: string;
}

export function createProject(
  name: string,
  path: string,
  provider: ProviderId = "claude",
  options: CreateProjectOptions = {}
): ProjectConfig {
  return {
    id: crypto.randomUUID(),
    name,
    path,
    gitRemote: options.gitRemote,
    provider,
    layoutId: options.layoutId || "ai-shell",
    skipPermissions: options.skipPermissions,
    createdAt: new Date().toISOString(),
    sshConnectionId: options.sshConnectionId,
    remoteProjectPath: options.remoteProjectPath,
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
