import { useEffect, useRef, MutableRefObject } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { SerializeAddon } from "@xterm/addon-serialize";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { TauriClipboardProvider } from "../lib/clipboard-provider";
import {
  spawnedPtys,
  terminalInstances,
  serializeRefs,
  base64ToUint8Array,
} from "../components/terminal-pane";

interface UseTerminalInstanceOptions {
  id: string;
  cwd: string;
  command?: string;
  initialInput?: string;
  // For remote: command to run first (e.g., "claude"), then initialInput is sent after CLI is ready
  remoteCommand?: string;
  scrollback: number;
  fontSize: number;
  theme: {
    terminal: {
      fontFamily: string;
      theme: Record<string, string>;
    };
  };
  containerRef: MutableRefObject<HTMLDivElement | null>;
  // Remote execution options
  isRemote?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshKeyPath?: string;
  tmuxSession?: string;
  // Callbacks
  onToggleMaximize?: () => void;
  onFocus?: () => void;
  onInitialInputSent?: () => void;
}

interface UseTerminalInstanceResult {
  terminalRef: MutableRefObject<Terminal | null>;
  fitAddonRef: MutableRefObject<FitAddon | null>;
  searchAddonRef: MutableRefObject<SearchAddon | null>;
}

/**
 * Strip ANSI escape codes from terminal output for pattern matching.
 */
function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\r/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "");
}

/**
 * Detect if CLI output indicates it's ready for input (idle state).
 */
function isCliIdle(chunk: string): boolean {
  const text = stripAnsi(chunk);
  if (!text) return false;

  // Claude Code idle indicators
  if (/❯.*Try\s+"/i.test(text)) return true;
  if (/bypass permissions/i.test(text)) return true;
  if (/shift\+tab to cycle/i.test(text)) return true;
  if (/MCP server/i.test(text)) return true;

  // Generic CLI idle indicators
  if (/Ready|Awaiting|Next command/i.test(text)) return true;

  return false;
}

/**
 * Fit terminal while preserving scroll position.
 */
export function fitPreservingScroll(terminal: Terminal, fitAddon: FitAddon) {
  const buffer = terminal.buffer.active;
  const viewportY = buffer.viewportY;
  const baseY = buffer.baseY;
  const isAtBottom = viewportY >= baseY;

  fitAddon.fit();

  if (!isAtBottom) {
    terminal.scrollToLine(viewportY);
  }
}

/**
 * Hook that manages xterm.js terminal lifecycle, PTY spawning, and event listeners.
 */
export function useTerminalInstance({
  id,
  cwd,
  command,
  initialInput,
  remoteCommand,
  scrollback,
  fontSize,
  theme,
  containerRef,
  isRemote,
  sshHost,
  sshPort,
  sshUser,
  sshKeyPath,
  tmuxSession,
  onToggleMaximize,
  onFocus,
  onInitialInputSent,
}: UseTerminalInstanceOptions): UseTerminalInstanceResult {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  // Store callbacks in refs to avoid stale closures
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  const onFocusRef = useRef(onFocus);
  const onInitialInputSentRef = useRef(onInitialInputSent);

  // Track injection state in refs to persist across effect re-runs
  const remoteCommandSentRef = useRef(false);
  const initialPromptSentRef = useRef(false);

  // Keep refs updated
  onToggleMaximizeRef.current = onToggleMaximize;
  onFocusRef.current = onFocus;
  onInitialInputSentRef.current = onInitialInputSent;

  // Main terminal setup effect
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if terminal instance already exists (survives remounts from drag operations)
    let instance = terminalInstances.get(id);
    let terminal: Terminal;
    let fitAddon: FitAddon;
    let searchAddon: SearchAddon;
    let serializeAddon: SerializeAddon;
    let isNewInstance = false;

    if (instance) {
      // Reuse existing terminal - just reattach to new DOM element
      terminal = instance.terminal;
      fitAddon = instance.fitAddon;
      searchAddon = instance.searchAddon;
      serializeAddon = instance.serializeAddon;

      if (terminal.element && containerRef.current) {
        containerRef.current.appendChild(terminal.element);
      }
    } else {
      // Create new terminal instance
      isNewInstance = true;
      terminal = new Terminal({
        fontFamily: theme.terminal.fontFamily,
        fontSize,
        cursorBlink: true,
        allowProposedApi: true,
        theme: theme.terminal.theme,
        scrollback,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);

      // Try to load WebGL addon for GPU-accelerated rendering
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => webglAddon.dispose());
        terminal.loadAddon(webglAddon);
      } catch (e) {
        console.warn("WebGL addon failed to load:", e);
      }

      // Cmd+click to open URLs
      const webLinksAddon = new WebLinksAddon((event, uri) => {
        if (event.metaKey) open(uri).catch(console.error);
      });
      terminal.loadAddon(webLinksAddon);

      searchAddon = new SearchAddon();
      terminal.loadAddon(searchAddon);

      // Use Tauri clipboard provider for OSC 52 support (bypasses browser restrictions)
      const clipboardAddon = new ClipboardAddon(undefined, TauriClipboardProvider);
      terminal.loadAddon(clipboardAddon);

      serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);

      // Custom key event handler
      terminal.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;

        if (e.shiftKey && e.metaKey && (e.key === "Enter" || e.keyCode === 13)) {
          e.preventDefault();
          e.stopPropagation();
          onToggleMaximizeRef.current?.();
          return false;
        }

        if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key === "Enter") {
          invoke("write_pty", { id, data: "\n" }).catch(console.error);
          return false;
        }

        if (e.metaKey && !e.shiftKey && e.key === "ArrowLeft") {
          e.preventDefault();
          invoke("write_pty", { id, data: "\x01" }).catch(console.error);
          return false;
        }

        if (e.metaKey && !e.shiftKey && e.key === "ArrowRight") {
          e.preventDefault();
          invoke("write_pty", { id, data: "\x05" }).catch(console.error);
          return false;
        }

        if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === "ArrowLeft") {
          e.preventDefault();
          invoke("write_pty", { id, data: "\x1bb" }).catch(console.error);
          return false;
        }

        if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === "ArrowRight") {
          e.preventDefault();
          invoke("write_pty", { id, data: "\x1bf" }).catch(console.error);
          return false;
        }

        return true;
      });

      terminal.onData((data) => {
        invoke("write_pty", { id, data }).catch(console.error);
      });
    }

    // Set up refs
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    serializeRefs.set(id, () => serializeAddon.serialize());

    // Fit terminal
    requestAnimationFrame(() => {
      fitAddon.fit();
      invoke("resize_pty", { id, cols: terminal.cols, rows: terminal.rows }).catch(console.error);
    });

    // Spawn PTY if needed
    if (!spawnedPtys.has(id)) {
      spawnedPtys.add(id);
      // Reset injection flags for new terminals
      remoteCommandSentRef.current = false;
      initialPromptSentRef.current = false;
      if (isRemote && sshHost && sshUser && tmuxSession) {
        // Spawn remote PTY via SSH + tmux
        invoke("spawn_remote_pty", {
          id,
          sshHost,
          sshPort: sshPort || 22,
          sshUser,
          sshKeyPath: sshKeyPath || null,
          remoteCwd: cwd,
          tmuxSession,
          command,
          cols: terminal.cols,
          rows: terminal.rows,
        }).catch(console.error);
      } else {
        // Spawn local PTY
        invoke("spawn_pty", { id, cwd, cols: terminal.cols, rows: terminal.rows, command }).catch(console.error);
      }
    }

    // Two-stage injection for remote: first remoteCommand, then initialInput after CLI is ready
    // Single-stage for local: just initialInput after CLI is ready
    let silenceTimer: number | null = null;
    let fallbackTimer: number | null = null;

    const sendRemoteCommand = () => {
      if (remoteCommandSentRef.current || !remoteCommand) return;
      remoteCommandSentRef.current = true;

      invoke("write_pty", { id, data: remoteCommand })
        .then(() => new Promise(resolve => setTimeout(resolve, 50)))
        .then(() => invoke("write_pty", { id, data: "\r" }))
        .catch(console.error);
    };

    const sendInitialPrompt = () => {
      if (initialPromptSentRef.current || !initialInput) return;
      initialPromptSentRef.current = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);

      invoke("write_pty", { id, data: initialInput })
        .then(() => new Promise(resolve => setTimeout(resolve, 50)))
        .then(() => invoke("write_pty", { id, data: "\r" }))
        .catch(console.error)
        .finally(() => {
          onInitialInputSentRef.current?.();
        });
    };

    // For remote: send command first, then wait for CLI idle to send prompt
    // For local: just wait for CLI idle to send prompt
    if (remoteCommand) {
      // Remote two-stage: send command after shell is ready (short delay)
      silenceTimer = window.setTimeout(() => sendRemoteCommand(), 1500);
      fallbackTimer = window.setTimeout(() => {
        sendRemoteCommand();
        if (initialInput) {
          // Fallback: send prompt after longer delay if idle detection doesn't trigger
          setTimeout(() => sendInitialPrompt(), 8000);
        }
      }, 10000);
    } else if (initialInput) {
      fallbackTimer = window.setTimeout(() => sendInitialPrompt(), 10000);
      silenceTimer = window.setTimeout(() => sendInitialPrompt(), 2000);
    }

    // Set up PTY output listener
    let unlistenFn: (() => void) | null = null;

    if (isNewInstance || !instance?.unlisten) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let pendingData: Uint8Array[] = [];
      let frameRequested = false;

      const flushPendingData = () => {
        if (pendingData.length === 0) return;
        const totalLength = pendingData.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of pendingData) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        pendingData = [];
        frameRequested = false;
        terminal.write(decoder.decode(combined, { stream: true }));
      };

      listen<string>(`pty-output-${id}`, (event) => {
        const rawData = base64ToUint8Array(event.payload);
        pendingData.push(rawData);
        if (!frameRequested) {
          frameRequested = true;
          requestAnimationFrame(flushPendingData);
        }

        // Idle detection for injection
        try {
          const text = new TextDecoder().decode(rawData);

          // For remote: first detect shell ready, then CLI ready
          if (remoteCommand && !remoteCommandSentRef.current) {
            // Shell prompt detection ($ or % or >)
            const shellReady = /[$%>]\s*$/.test(stripAnsi(text));
            if (shellReady) {
              if (silenceTimer) clearTimeout(silenceTimer);
              silenceTimer = window.setTimeout(() => sendRemoteCommand(), 200);
            }
          } else if (remoteCommand && remoteCommandSentRef.current && initialInput && !initialPromptSentRef.current) {
            // CLI idle detection for sending prompt
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = window.setTimeout(() => sendInitialPrompt(), 1200);
            if (isCliIdle(text)) {
              if (silenceTimer) clearTimeout(silenceTimer);
              silenceTimer = window.setTimeout(() => sendInitialPrompt(), 250);
            }
          } else if (!remoteCommand && initialInput && !initialPromptSentRef.current) {
            // Local: standard idle detection
            if (silenceTimer) clearTimeout(silenceTimer);
            silenceTimer = window.setTimeout(() => sendInitialPrompt(), 1200);
            if (isCliIdle(text)) {
              if (silenceTimer) clearTimeout(silenceTimer);
              silenceTimer = window.setTimeout(() => sendInitialPrompt(), 250);
            }
          }
        } catch {
          // Ignore decode errors
        }
      }).then((fn) => {
        unlistenFn = fn;
        const inst = terminalInstances.get(id);
        if (inst) inst.unlisten = fn;
      });
    }

    // Click handler
    const handleTerminalClick = () => onFocusRef.current?.();
    terminal.element?.addEventListener("click", handleTerminalClick);

    // Resize observer
    let resizeTimeout: number;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        fitPreservingScroll(terminal, fitAddon);
        invoke("resize_pty", { id, cols: terminal.cols, rows: terminal.rows }).catch(console.error);
      }, 100);
    });
    resizeObserver.observe(containerRef.current);

    // Store instance
    terminalInstances.set(id, {
      terminal,
      fitAddon,
      searchAddon,
      serializeAddon,
      unlisten: unlistenFn || instance?.unlisten || null,
    });

    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      clearTimeout(resizeTimeout);
      terminal.element?.removeEventListener("click", handleTerminalClick);
      resizeObserver.disconnect();
    };
  }, [id, cwd, command, initialInput, remoteCommand, isRemote, sshHost, sshPort, sshUser, sshKeyPath, tmuxSession]);

  return { terminalRef, fitAddonRef, searchAddonRef };
}
