# aTerm

Agent-focused terminal workspace built with Tauri + React + xterm.js.

## Features

- **Project-based workspaces** - Organize terminals by project
- **Multi-provider support** - Claude Code, OpenCode, Aider, Cursor, and more
- **Configurable themes** - Midnight, Dracula, Nord, Tokyo Night, Gruvbox
- **Per-project terminal layouts** - Customize pane arrangements per project

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
