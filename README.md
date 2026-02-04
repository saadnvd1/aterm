# aTerm

[![Download](https://img.shields.io/github/v/release/saadnvd1/aterm?label=Download&style=flat-square)](https://github.com/saadnvd1/aterm/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-blue?style=flat-square)](https://github.com/saadnvd1/aterm/releases/latest)

A modern terminal workspace designed for agentic coding workflows. Run AI coding assistants (Claude Code, Aider, OpenCode) alongside your shell, dev server, and git panel in a unified, project-based interface.

![aTerm Screenshot](https://github.com/saadnvd1/aterm/raw/main/screenshot.png)

## Why aTerm?

When working with AI coding agents, you need multiple terminals running simultaneously:
- **AI Assistant** - Claude Code, Aider, or OpenCode doing the heavy lifting
- **Shell** - Running commands, checking outputs
- **Dev Server** - Watching your app in real-time
- **Tests** - Running test suites

aTerm gives you predefined layouts optimized for these workflows, with instant project switching and persistent terminals that stay alive in the background.

## Features

- **Agentic Layouts** - Pre-configured for AI-assisted development (AI + Shell, AI + Dev + Shell, AI + Git)
- **Project Workspaces** - Switch between projects instantly with Cmd+1-9, terminals persist in background
- **Task Worktrees** - Create tasks backed by git worktrees to work on multiple features in parallel
- **Built-in Code Editor** - Monaco-powered editor with file explorer, syntax highlighting, and Cmd+P file search
- **Built-in Git Panel** - Stage, commit, push, view diffs, and edit files inline with a Diff/Edit toggle
- **Multi-Agent Support** - Claude Code, Aider, OpenCode, Cursor, and custom commands
- **Split Panes** - Right-click to split with any profile, drag borders to resize
- **Pane Renaming** - Double-click or right-click to rename panes
- **Scratch Notes** - Per-project markdown scratchpad for quick notes (Shift+Cmd+N)
- **Maximize Mode** - Shift+Cmd+Enter to focus on a single pane
- **Per-Pane Font Size** - Cmd+Plus/Minus to adjust individual pane fonts
- **Themes** - Midnight, Dracula, Nord, Tokyo Night, Gruvbox

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+1-9 | Switch to project 1-9 |
| Cmd+B | Toggle sidebar |
| Cmd+P | File search |
| Shift+Cmd+G | Toggle git panel |
| Shift+Cmd+E | Toggle editor pane |
| Shift+Cmd+N | Scratch notes |
| Shift+Cmd+Enter | Maximize/restore focused pane |
| Shift+Cmd+[ / ] | Previous/next pane |
| Shift+Cmd+M | Minimize pane |
| Cmd+D | Split pane with shell |
| Cmd+W | Close focused pane |
| Cmd++ | Increase font size |
| Cmd+- | Decrease font size |
| Cmd+K | Clear terminal |

## Default Layouts

| Layout | Panes |
|--------|-------|
| AI + Shell | Claude Code (2/3) + Shell (1/3) |
| AI + Dev + Shell | Claude Code + Dev Server (top), Shell (bottom) |
| AI + Git | Claude Code (2/3) + Git Panel (1/3) |
| Focused AI | Single Claude Code pane |
| Quad | 4 panes in 2x2 grid |

## Installation

### macOS (Apple Silicon)

Download the latest `.dmg` from [Releases](https://github.com/saadnvd1/aterm/releases/latest) - signed and notarized.

### Build from Source

```bash
# Install dependencies
npm install

# Development
npm run tauri dev

# Production build
npm run tauri build
```

## Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Terminal**: xterm.js with fit addon
- **Editor**: Monaco (VS Code engine) with language detection
- **Backend**: Tauri 2 (Rust) with portable-pty
- **Drag & Drop**: @dnd-kit for pane reordering

## Configuration

Config stored in `~/Library/Application Support/aterm/config.json`:

- **Projects** - Name, path, git remote, AI provider, layout
- **Profiles** - Terminal presets (command, accent color)
- **Layouts** - Custom pane arrangements

## License

MIT
