import type { Layout } from "../../lib/layouts";
import type { TerminalProfile } from "../../lib/profiles";
import type { ProviderId } from "../../lib/providers";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  isGitRepo: boolean;
}

export interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (project: import("../../lib/config").ProjectConfig) => void;
  layouts: Layout[];
  profiles: TerminalProfile[];
}

export interface ProjectFormFieldsProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  provider: ProviderId;
  onProviderChange: (provider: ProviderId) => void;
  layoutId: string;
  onLayoutIdChange: (id: string) => void;
  layouts: Layout[];
  profiles: TerminalProfile[];
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  skipPermissions: boolean;
  onSkipPermissionsChange: (skip: boolean) => void;
  showNameField?: boolean;
  namePlaceholder?: string;
}

export interface DirectoryBrowserProps {
  currentPath: string;
  pathInput: string;
  onPathInputChange: (path: string) => void;
  onPathSubmit: () => void;
  onGoUp: () => void;
  entries: DirEntry[];
  folderSearch: string;
  onFolderSearchChange: (search: string) => void;
  onEntryClick: (entry: DirEntry) => void;
}
