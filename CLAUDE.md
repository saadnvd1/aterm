# aTerm

Agent-focused terminal workspace built with Tauri (Rust) + React + xterm.js.

## Architecture

```
src/                        # React frontend
├── components/
│   ├── git/                   # Git panel components
│   │   ├── GitPane.tsx           # Main git panel container
│   │   ├── GitPanelTabs.tsx      # Changes/History tab switcher
│   │   ├── FileChanges.tsx       # Staged/Unstaged/Untracked sections
│   │   ├── FileItem.tsx          # File row with stage/unstage actions
│   │   ├── DiffViewer.tsx        # Unified diff display
│   │   ├── CommitForm.tsx        # Commit message + buttons
│   │   ├── CommitHistory.tsx     # Scrollable commit list
│   │   └── CommitItem.tsx        # Expandable commit with files
│   ├── AddProjectModal.tsx    # Project creation (browse/clone)
│   ├── ProjectSidebar.tsx     # Left sidebar with project list
│   ├── SettingsModal.tsx      # Settings with tabs (Appearance, Profiles, Layouts)
│   ├── TerminalLayout.tsx     # Pane grid with resize, context menu, maximize
│   └── TerminalPane.tsx       # Individual terminal (xterm.js wrapper)
├── context/
│   └── ThemeContext.tsx       # Theme provider with localStorage persistence
├── lib/
│   ├── config.ts              # AppConfig, ProjectConfig types
│   ├── git.ts                 # Git types (GitStatus, GitFile, CommitSummary)
│   ├── layouts.ts             # Layout, LayoutRow, LayoutPane types
│   ├── profiles.ts            # TerminalProfile type, defaults
│   ├── providers.ts           # AI provider registry
│   └── themes.ts              # Theme definitions
├── App.tsx                    # Main app with project/terminal state
└── main.tsx                   # Entry point

src-tauri/src/
└── lib.rs                     # Rust backend (PTY, config, git, filesystem)
```

## Key Patterns

### Terminal Persistence
Terminals stay alive when switching projects. App.tsx tracks `openedProjects` Set and renders all opened projects, hiding inactive ones with `display: none`.

### Pane Maximize
Uses CSS positioning, not conditional rendering. Maximized pane gets `position: absolute` to cover container, others get `visibility: hidden`. No unmounting.

### Keyboard Shortcuts in Terminal
xterm.js captures keyboard events. Use `onKeyDownCapture` on container div to intercept before xterm. Store callbacks in refs to avoid stale closures.

### Profile/Layout System
- **Profiles**: Reusable terminal configs (id, name, command, color, type)
  - `type: "terminal"` (default) - xterm.js terminal pane
  - `type: "git"` - Git panel with status, staging, commits
- **Layouts**: Pane arrangements with rows containing panes, each referencing a profile
- **Projects**: Reference a layout by ID

### GitPane
Non-terminal pane type for git operations. Features:
- **Changes tab**: View staged/unstaged/untracked files, stage/unstage, view diffs
- **History tab**: Browse commit history, expand to see changed files, view diffs
- **Commit form**: Write commit message, commit, or commit & push
- Status auto-polls every 5 seconds

## Config

Stored in `~/.config/aterm/config.json` as flexible JSON. Rust backend uses `serde_json::Value`, frontend defines schema.

```typescript
interface AppConfig {
  projects: ProjectConfig[];
  profiles: TerminalProfile[];
  layouts: Layout[];
  defaultProvider: ProviderId;
  defaultLayoutId: string;
}
```

## Commands

```bash
npm run tauri dev      # Development
npm run tauri build    # Production build
```

## Standards

- Conventional commits (feat, fix, docs, etc.)
- CSS variables for theming (var(--bg), var(--text), etc.)
- TypeScript strict mode
- Inline styles with `styles` object pattern
