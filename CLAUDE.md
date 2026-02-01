# aTerm

Agent-focused terminal workspace built with Tauri (Rust) + React + xterm.js.

## Architecture

```
src/                    # React frontend
├── components/         # UI components
├── context/           # React context (ThemeContext)
├── lib/               # Config, providers, themes
└── main.tsx           # Entry point

src-tauri/             # Rust backend
└── src/lib.rs         # PTY management, config storage, git ops
```

## Key Files

- `src/lib/themes.ts` - Theme definitions (colors, terminal themes)
- `src/lib/providers.ts` - AI provider registry (claude, opencode, etc.)
- `src/lib/config.ts` - Project config types and helpers
- `src-tauri/src/lib.rs` - Rust backend (PTY, filesystem, config)

## Config

Projects stored in `~/.config/aterm/config.json`:
- Project name, path, git remote
- AI provider selection
- Terminal pane configuration

## Commands

- `npm run tauri dev` - Development
- `npm run tauri build` - Production build

## Standards

- Conventional commits (feat, fix, docs, etc.)
- CSS variables for theming (var(--bg), var(--text), etc.)
- TypeScript strict mode
