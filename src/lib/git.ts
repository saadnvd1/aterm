// Git types for the GitPanel feature

export type FileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked" | "copied" | "unmerged" | "unknown";

export interface GitFile {
  path: string;
  status: FileStatus;
  staged: boolean;
  oldPath?: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
}

export interface CommitSummary {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  timestamp: number;
  relativeTime: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface CommitFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

// Status icon mapping
export function getStatusIcon(status: FileStatus): string {
  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "untracked":
      return "?";
    case "copied":
      return "C";
    case "unmerged":
      return "U";
    default:
      return "?";
  }
}

// Status color mapping
export function getStatusColor(status: FileStatus): string {
  switch (status) {
    case "modified":
      return "#e2c08d"; // yellow
    case "added":
      return "#98c379"; // green
    case "deleted":
      return "#e06c75"; // red
    case "renamed":
      return "#61afef"; // blue
    case "untracked":
      return "#abb2bf"; // gray
    case "copied":
      return "#c678dd"; // purple
    case "unmerged":
      return "#d19a66"; // orange
    default:
      return "#abb2bf";
  }
}
