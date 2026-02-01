# aTerm

Agent-focused terminal workspace built with Tauri + React + xterm.js.

## Features

- **Project-based workspaces** - Organize terminals by project with instant switching
- **iTerm2-style profiles** - Reusable terminal configurations (command, color)
- **Window layouts** - Predefined pane arrangements (AI + Shell, Quad, etc.)
- **Multi-provider support** - Claude Code, OpenCode, Aider, Cursor, and more
- **Drag-to-resize** - Resize panes and rows by dragging borders
- **Split panes** - Right-click to split vertically/horizontally with any profile
- **Maximize pane** - Shift+Cmd+Enter to focus on a single pane
- **Per-pane font size** - Cmd+Plus/Cmd+Minus to adjust font size
- **Configurable themes** - Midnight, Dracula, Nord, Tokyo Night, Gruvbox
- **Persistent terminals** - Terminals stay alive when switching projects

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Shift+Cmd+Enter | Maximize/restore focused pane |
| Cmd++ | Increase font size (focused pane) |
| Cmd+- | Decrease font size (focused pane) |

## Stack

- **Frontend**: React + TypeScript + xterm.js
- **Backend**: Tauri (Rust) with portable-pty
- **Config**: JSON stored in `~/.config/aterm/`

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Configuration

Settings are stored in `~/.config/aterm/config.json`:

- **Projects**: Name, path, git remote, provider, layout
- **Profiles**: Terminal configurations (name, command, color)
- **Layouts**: Pane arrangements with rows and columns
- **Themes**: Visual appearance settings
