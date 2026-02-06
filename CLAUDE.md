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
- TypeScript strict mode
- Tailwind CSS + shadcn/ui for styling (following LumifyHub conventions)
- **Always run `npx tsc --noEmit` after finishing a feature** to catch type errors before committing

## Design System

Uses **Tailwind CSS + shadcn/ui**, following the same conventions as LumifyHub:

### Structure
```
src/
├── components/ui/        # shadcn components (Button, Dialog, etc.)
├── lib/utils.ts          # cn() utility for class merging
└── styles/globals.css    # Tailwind + CSS variables
```

### Adding shadcn components
```bash
npx shadcn@latest add button dialog dropdown-menu
```

### CSS Variables (HSL format)
Themes are defined in `globals.css` with CSS variables:
- `--background`, `--foreground` - Base colors
- `--primary`, `--secondary`, `--muted`, `--accent` - UI colors
- `--destructive` - Danger/error states
- `--border`, `--input`, `--ring` - Form elements

### Theme Switching
Set `data-theme` attribute on `<html>`:
- `midnight` (default), `dracula`, `nord`, `tokyoNight`, `gruvbox`, `oneDark`, `catppuccin`, `monokai`, `solarized`, `rosePine`

### Z-Index Scale
Semantic z-index layers defined in `tailwind.config.ts`. **Never use raw z-index values (z-10, z-50, etc.) — always use semantic names.**

| Class              | Value | Usage                                    |
|--------------------|-------|------------------------------------------|
| `z-sticky`         | 100   | Sticky headers, fixed sidebars           |
| `z-dropdown`       | 200   | Dropdown menus, maximized panes          |
| `z-popover`        | 300   | Popovers, context menus, floating panels |
| `z-popover-nested` | 400   | Selects inside popovers                  |
| `z-modal`          | 500   | Modal dialogs, overlays                  |
| `z-modal-nested`   | 600   | Selects/dropdowns inside modals          |
| `z-toast`          | 700   | Toast notifications                      |
| `z-tooltip`        | 800   | Tooltips (highest regular layer)         |
| `z-max`            | 9999  | Escape hatch for edge cases              |

### Conventions (from LumifyHub)
- Use `cn()` for conditional classes: `cn("base", condition && "active")`
- Prefer shadcn components over custom implementations
- Use semantic color names (`bg-primary` not `bg-purple-500`)
- Use semantic z-index names (`z-modal` not `z-50`)

## File Size Rules

**Target: Keep files under 300 lines.** Large files are harder to understand, test, and maintain.

### How to Split Components

1. **Extract sub-components** into sibling files:
   ```
   components/
   ├── TerminalLayout.tsx        # Main orchestrator (~200 lines)
   ├── terminal-layout/          # Sub-components
   │   ├── SortablePane.tsx
   │   ├── RowWithResizer.tsx
   │   └── DropZones.tsx
   ```

2. **Extract hooks** for complex state/effects:
   ```
   hooks/
   ├── useTerminalInstance.ts    # xterm.js lifecycle
   ├── usePaneResize.ts          # Drag resize logic
   ```

3. **Extract types** into separate files when shared:
   ```
   lib/
   ├── types/terminal.ts
   ```

### What Stays Together
- Keep tightly coupled logic in one file (e.g., a component + its small helpers)
- Don't split just to hit 300 lines if it hurts readability
- Data files (themes.ts) can be longer - they're config, not logic

### Current Violations (to fix)
- `TerminalLayout.tsx` (1028 lines) → Split pane/row components
- `SettingsModal.tsx` (935 lines) → Split tab contents
- `TerminalPane.tsx` (690 lines) → Extract hooks
- `AddProjectModal.tsx` (528 lines) → Split clone/browse sections
- `App.tsx` (452 lines) → Extract handlers into hooks
