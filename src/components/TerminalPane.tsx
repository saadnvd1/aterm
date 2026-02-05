import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { SerializeAddon } from "@xterm/addon-serialize";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-shell";
import { useTheme } from "../context/ThemeContext";
import { PaneHeader } from "./PaneHeader";
import { SearchOverlay, DragDropOverlay } from "./terminal-pane";
import {
  spawnedPtys,
  terminalInstances,
  serializeRefs,
  base64ToUint8Array,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  DEFAULT_SCROLLBACK,
} from "./terminal-pane";
import "@xterm/xterm/css/xterm.css";

/**
 * Filter out terminal response sequences from xterm.js onData before writing to PTY.
 *
 * NOTE: We intentionally do NOT filter OSC responses (like OSC 11 background color).
 * Applications like supabase CLI use lipgloss which queries terminal colors and
 * waits for a response. Filtering these causes ~2 second timeouts.
 *
 * We only filter cursor/device reports that shells query but don't wait for.
 */
function filterTerminalResponses(data: string): string {
  return data
    // CPR (Cursor Position Report): \x1b[<digits>;<digits>R
    .replace(/\x1b\[\d+;\d+R/g, "")
    // DA (Device Attributes) response: \x1b[?...c
    .replace(/\x1b\[\?[\d;]*c/g, "");
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
 * Returns true if the output contains patterns suggesting the CLI is waiting for user input.
 */
function isCliIdle(chunk: string): boolean {
  const text = stripAnsi(chunk);
  if (!text) return false;

  // Claude Code idle indicators
  if (/❯.*Try\s+"/i.test(text)) return true; // Main prompt with suggestion
  if (/bypass permissions/i.test(text)) return true; // Bottom status bar
  if (/shift\+tab to cycle/i.test(text)) return true; // Bottom status bar
  if (/MCP server/i.test(text)) return true; // MCP status indicator

  // Generic CLI idle indicators
  if (/Ready|Awaiting|Next command/i.test(text)) return true;

  return false;
}

/**
 * Fit terminal while preserving scroll position.
 * If user is scrolled up, stay at the same position.
 * If user is at the bottom, stay at the bottom.
 */
function fitPreservingScroll(terminal: Terminal, fitAddon: FitAddon) {
  const buffer = terminal.buffer.active;
  const viewportY = buffer.viewportY;
  const baseY = buffer.baseY;
  const isAtBottom = viewportY >= baseY;

  fitAddon.fit();

  if (!isAtBottom) {
    // User was scrolled up - restore their position
    terminal.scrollToLine(viewportY);
  }
  // If at bottom, fit() keeps us there naturally
}

// Re-export for external use
export { killPty, serializeRefs } from "./terminal-pane";

interface Props {
  id: string;
  title: string;
  cwd: string;
  command?: string;
  initialInput?: string;
  onInitialInputSent?: () => void;
  accentColor?: string;
  projectColor?: string;
  defaultFontSize?: number;
  fontSize?: number;
  scrollback?: number;
  onFontSizeChange?: (size: number) => void;
  onFocus?: () => void;
  isFocused?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  onRename?: (name: string) => void;
  triggerRename?: boolean;
  onTriggerRenameComplete?: () => void;
  canClose?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isProjectActive?: boolean;
}

export function TerminalPane({
  id,
  title,
  cwd,
  command,
  initialInput,
  onInitialInputSent,
  accentColor,
  projectColor,
  defaultFontSize = 13,
  fontSize: savedFontSize,
  scrollback = DEFAULT_SCROLLBACK,
  onFontSizeChange,
  onFocus,
  isFocused,
  isMaximized,
  onToggleMaximize,
  onClose,
  onRename,
  triggerRename,
  onTriggerRenameComplete,
  canClose,
  dragHandleProps,
  isProjectActive = true,
}: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  const onFocusRef = useRef(onFocus);
  const onInitialInputSentRef = useRef(onInitialInputSent);

  const [fontSize, setFontSize] = useState(savedFontSize ?? defaultFontSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keep refs updated with latest callbacks
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
        fontSize: savedFontSize ?? defaultFontSize,
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
        webglAddon.onContextLoss(() => {
          console.warn("WebGL context lost, falling back to canvas renderer");
          webglAddon.dispose();
        });
        terminal.loadAddon(webglAddon);
        console.log("WebGL renderer active for terminal:", id);
      } catch (e) {
        console.warn("WebGL addon failed to load, using canvas renderer:", e);
      }

      // Cmd+click to open URLs
      const webLinksAddon = new WebLinksAddon((event, uri) => {
        if (event.metaKey) open(uri).catch(console.error);
      });
      terminal.loadAddon(webLinksAddon);

      searchAddon = new SearchAddon();
      terminal.loadAddon(searchAddon);

      const clipboardAddon = new ClipboardAddon();
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

        // Shift+Enter: Insert newline for multiline input in Claude Code
        // Send Escape + Enter sequence which Claude Code interprets as "insert newline"
        if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          invoke("write_pty", { id, data: "\x1b\r" }).catch(console.error);
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
        const filtered = filterTerminalResponses(data);
        if (filtered) {
          invoke("write_pty", { id, data: filtered }).catch(console.error);
        }
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
      invoke("spawn_pty", { id, cwd, cols: terminal.cols, rows: terminal.rows, command }).catch(console.error);
    }

    // Initial prompt injection with debounce + idle detection
    let silenceTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let initialPromptSent = false;

    const sendInitialPrompt = () => {
      if (initialPromptSent || !initialInput) return;
      initialPromptSent = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);

      // Send prompt text first, then Enter after a small delay
      // This gives the CLI time to process the pasted text
      invoke("write_pty", { id, data: initialInput })
        .then(() => {
          return new Promise(resolve => setTimeout(resolve, 50));
        })
        .then(() => {
          return invoke("write_pty", { id, data: "\r" });
        })
        .catch(console.error)
        .finally(() => {
          onInitialInputSentRef.current?.();
        });
    };

    if (initialInput) {
      // Absolute fallback in case CLI never becomes idle (10s)
      fallbackTimer = window.setTimeout(() => {
        sendInitialPrompt();
      }, 10000);

      // Start silence timer when PTY spawns (2s initial wait)
      silenceTimer = window.setTimeout(() => {
        sendInitialPrompt();
      }, 2000);
    }

    // Set up PTY output listener
    let unlistenFn: (() => void) | null = null;

    if (isNewInstance || !instance?.unlisten) {
      const decoder = new TextDecoder("utf-8", { fatal: false });

      listen<string>(`pty-output-${id}`, (event) => {
        const rawData = base64ToUint8Array(event.payload);
        // Write directly to terminal without RAF batching for lower latency
        terminal.write(decoder.decode(rawData, { stream: true }));

        // Debounce + idle detection for initial prompt injection
        if (initialInput && !initialPromptSent) {
          // Reset silence timer on each output (1.2s debounce)
          if (silenceTimer) clearTimeout(silenceTimer);
          silenceTimer = window.setTimeout(() => {
            sendInitialPrompt();
          }, 1200);

          // Check for idle patterns - send sooner if CLI is ready
          try {
            const text = new TextDecoder().decode(rawData);
            if (isCliIdle(text)) {
              if (silenceTimer) clearTimeout(silenceTimer);
              silenceTimer = window.setTimeout(() => {
                sendInitialPrompt();
              }, 250);
            }
          } catch {
            // Ignore decode errors
          }
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
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      clearTimeout(resizeTimeout);
      terminal.element?.removeEventListener("click", handleTerminalClick);
      resizeObserver.disconnect();
    };
  }, [id, cwd, command, initialInput]);

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme.terminal.theme;
      terminalRef.current.options.fontFamily = theme.terminal.fontFamily;
    }
  }, [theme]);

  // Refit on maximize
  useEffect(() => {
    if (fitAddonRef.current && terminalRef.current) {
      const timeout = setTimeout(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitPreservingScroll(terminalRef.current, fitAddonRef.current);
          invoke("resize_pty", { id, cols: terminalRef.current.cols, rows: terminalRef.current.rows }).catch(console.error);
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isMaximized, id]);

  // Update font size
  useEffect(() => {
    if (terminalRef.current && fitAddonRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      fitPreservingScroll(terminalRef.current, fitAddonRef.current);
      invoke("resize_pty", { id, cols: terminalRef.current.cols, rows: terminalRef.current.rows }).catch(console.error);
    }
  }, [fontSize, id]);

  // Sync to default font size
  useEffect(() => {
    if (savedFontSize === undefined) setFontSize(defaultFontSize);
  }, [defaultFontSize, savedFontSize]);

  // Auto-focus terminal when it becomes active
  useEffect(() => {
    if (isFocused && isProjectActive && terminalRef.current) {
      // Small delay to ensure DOM is ready after transitions
      const timeout = setTimeout(() => {
        terminalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isFocused, isProjectActive]);

  // File drag and drop
  useEffect(() => {
    if (!isFocused || !isProjectActive) return;
    const webview = getCurrentWebview();

    const unlisten = webview.onDragDropEvent((event) => {
      const { type } = event.payload;
      if (type === "enter" || type === "over") {
        setIsDragging(true);
      } else if (type === "drop") {
        setIsDragging(false);
        if (event.payload.paths.length > 0) {
          const paths = event.payload.paths.map((p) => (p.includes(" ") ? `"${p}"` : p)).join(" ");
          invoke("write_pty", { id, data: paths }).catch(console.error);
        }
      } else if (type === "leave") {
        setIsDragging(false);
      }
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [id, isFocused, isProjectActive]);

  // Keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.metaKey && e.key === "f") {
      e.preventDefault();
      e.stopPropagation();
      setIsSearchOpen(true);
      return;
    }

    if (e.key === "Escape" && isSearchOpen) {
      e.preventDefault();
      e.stopPropagation();
      setIsSearchOpen(false);
      return;
    }

    if (e.shiftKey && e.metaKey && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onToggleMaximize?.();
      return;
    }

    if (e.metaKey && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      e.stopPropagation();
      setFontSize((prev) => {
        const newSize = Math.min(prev + 1, MAX_FONT_SIZE);
        onFontSizeChange?.(newSize);
        return newSize;
      });
      return;
    }

    if (e.metaKey && e.key === "-") {
      e.preventDefault();
      e.stopPropagation();
      setFontSize((prev) => {
        const newSize = Math.max(prev - 1, MIN_FONT_SIZE);
        onFontSizeChange?.(newSize);
        return newSize;
      });
      return;
    }

    if (e.metaKey && e.key === "k") {
      e.preventDefault();
      e.stopPropagation();
      terminalRef.current?.clear();
      return;
    }
  }

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 bg-background rounded-lg border overflow-hidden relative ${isDragging ? "border-primary border-2" : "border-border"}`}
      onClick={onFocus}
      onKeyDownCapture={handleKeyDown}
    >
      <PaneHeader
        title={title}
        subtitle={cwd.split("/").pop()}
        accentColor={accentColor}
        projectColor={projectColor}
        isFocused={isFocused}
        canClose={canClose}
        onClose={onClose}
        onRename={onRename}
        triggerRename={triggerRename}
        onTriggerRenameComplete={onTriggerRenameComplete}
        dragHandleProps={dragHandleProps}
      />
      <div
        ref={containerRef}
        className="flex-1 p-2 overflow-hidden"
        onMouseDownCapture={(e) => {
          // When pane is not focused, intercept first click to just focus
          // without sending mouse event to terminal (prevents tmux clipboard issues)
          if (!isFocused) {
            e.stopPropagation();
            e.preventDefault();
            onFocus?.();
            terminalRef.current?.focus();
          }
        }}
      />
      {isSearchOpen && (
        <SearchOverlay
          searchAddon={searchAddonRef.current}
          onClose={() => setIsSearchOpen(false)}
          onFocusTerminal={() => terminalRef.current?.focus()}
        />
      )}
      <DragDropOverlay isVisible={isDragging} />
    </div>
  );
}
