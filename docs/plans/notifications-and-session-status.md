# Notifications & Session Status Detection

Status: **Implemented**
Created: 2026-02-02
Implemented: 2026-02-02

## Overview

Add real-time status detection for AI coding sessions (Claude Code, Cursor, Aider, etc.) with notifications when sessions need attention.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        aTerm Frontend                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  StatusAddon     │    │ useNotifications │                   │
│  │  (xterm addon)   │───▶│     (hook)       │───▶ Notifications │
│  │                  │    │                  │                   │
│  │ - Pattern match  │    │ - Sound          │                   │
│  │ - Activity track │    │ - Browser notif  │                   │
│  │ - State machine  │    │ - Tab badge      │                   │
│  └──────────────────┘    └──────────────────┘                   │
│            │                                                     │
│            ▼                                                     │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  SessionContext  │    │  ProjectSidebar  │                   │
│  │                  │───▶│  Status Icons    │                   │
│  │ - Per-pane state │    │                  │                   │
│  │ - Aggregate view │    │ 🟢 idle          │                   │
│  └──────────────────┘    │ 🔵 running       │                   │
│                          │ 🟡 waiting       │                   │
│                          └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Status Types

```typescript
type PaneStatus = "idle" | "running" | "waiting" | "dead";

interface PaneStatusInfo {
  status: PaneStatus;
  lastActivity: number;      // timestamp
  provider?: string;         // "claude" | "cursor" | "aider" | etc.
  acknowledged: boolean;     // user has seen waiting state
}
```

## StatusAddon (Custom xterm.js Addon)

A custom xterm.js addon that monitors terminal buffer content for status patterns.

### Detection Patterns

Borrowed from agent-os (`~/dev/agentos/agent-os/lib/status-detector.ts`):

| Status | Detection Method |
|--------|------------------|
| **running** | Spinner chars (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`), "esc to interrupt", activity spike |
| **waiting** | `[Y/n]`, `Allow?`, `Continue?`, `> 1. Yes`, `Press Enter` |
| **idle** | No activity for cooldown period (2s), acknowledged |
| **dead** | PTY closed/error |

### Provider Auto-Detection

- `claude` - "Claude" in prompt, spinner with "tokens"
- `cursor` - "Cursor" branding
- `aider` - "aider" prompt patterns
- `shell` - Default fallback

### Implementation Notes

- Only scan last 5-10 lines to avoid false positives from scrollback
- Use cooldown grace period (2s) to prevent status flickering
- Track activity spikes (2+ changes in 1s window = sustained activity)

## Notification System

| Event | Sound | Browser Notification | Tab Badge |
|-------|-------|---------------------|-----------|
| `running → waiting` | Subtle two-tone descending | "{pane} needs input" | Flash + count |
| `running → idle` | Subtle two-tone ascending (optional) | "{pane} completed" | Clear |
| `any → error` | Subtle low tones | "{pane} error" | ⚠️ |

### Sound Design

- Use Web Audio API for subtle beeps
- Keep sounds short and unobtrusive
- Allow per-project enable/disable

## UI Components

### A. Pane Header Status Indicator

```
┌─ Claude Code ─────────────────── 🔵 ──┐
│ ~/dev/aterm                           │
```

Small colored dot in pane header showing current status.

### B. Project Sidebar Badge

```
📁 aterm          🟡 2
📁 lumifyhub      🔵 1
📁 saadbase       🟢
```

Aggregate status per project with count of waiting panes.

### C. Window Title

```
"aTerm - Waiting: Claude Code (aterm)"
```

Update window title when panes need attention.

## Settings

Settings are **per-project** in the config:

```typescript
interface ProjectConfig {
  // ... existing fields
  notifications?: {
    enabled: boolean;
    soundEnabled: boolean;
    browserNotifications: boolean;
    notifyOnWaiting: boolean;
    notifyOnComplete: boolean;
    notifyOnError: boolean;
  };
}
```

## File Structure

```
src/
├── addons/
│   └── StatusAddon.ts        # Custom xterm addon
├── hooks/
│   ├── useSessionStatus.ts   # Per-pane status tracking
│   └── useNotifications.ts   # Notification logic
├── context/
│   └── SessionContext.tsx    # Global session state
├── lib/
│   ├── status-patterns.ts    # Regex patterns for detection
│   └── providers.ts          # (extend with detection patterns)
```

## Implementation Phases

### Phase 1: Status Detection
- Create `StatusAddon` xterm addon
- Track activity timestamps
- Pattern matching for running/waiting
- Integrate with `TerminalPane`

### Phase 2: Session Context
- Create `SessionContext` for global state
- Aggregate status across panes
- Per-project status rollup

### Phase 3: UI Indicators
- Pane header status dot
- Sidebar project badges
- Window title updates

### Phase 4: Notifications
- `useNotifications` hook
- Web Audio API for subtle sounds
- Browser Notification API
- Per-project settings UI

## Reference Implementation

See `~/dev/agentos/agent-os` for patterns:
- `lib/status-detector.ts` - Status detection logic
- `hooks/useNotifications.ts` - Notification handling
- `data/statuses/queries.ts` - Polling and state management
