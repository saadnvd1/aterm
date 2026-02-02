import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useTheme } from "../context/ThemeContext";
import { PaneHeader } from "./PaneHeader";
import "@xterm/xterm/css/xterm.css";

// Base64 decode helper
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

interface Props {
  id: string;
  title: string;
  cwd: string;
  command?: string;
  accentColor?: string;
  defaultFontSize?: number;
  fontSize?: number;
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
}

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;

export function TerminalPane({ id, title, cwd, command, accentColor, defaultFontSize = 13, fontSize: savedFontSize, onFontSizeChange, onFocus, isFocused, isMaximized, onToggleMaximize, onClose, onRename, triggerRename, onTriggerRenameComplete, canClose, dragHandleProps }: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  const onFocusRef = useRef(onFocus);
  // Use saved font size if available, otherwise use default
  const [fontSize, setFontSize] = useState(savedFontSize ?? defaultFontSize);
  const [isDragging, setIsDragging] = useState(false);

  // Keep the refs updated with latest callbacks
  onToggleMaximizeRef.current = onToggleMaximize;
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!containerRef.current || spawnedRef.current) return;
    spawnedRef.current = true;

    const terminal = new Terminal({
      fontFamily: theme.terminal.fontFamily,
      fontSize: savedFontSize ?? defaultFontSize,
      cursorBlink: true,
      allowProposedApi: true,
      theme: theme.terminal.theme,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);

    // Try to load WebGL addon for GPU-accelerated rendering (2-3x faster)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon failed to load, using default renderer:", e);
    }

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    invoke("spawn_pty", {
      id,
      cwd,
      cols: terminal.cols,
      rows: terminal.rows,
      command,
    }).catch(console.error);

    // TextDecoder handles streaming UTF-8 properly (keeps partial sequences for next chunk)
    const decoder = new TextDecoder("utf-8", { fatal: false });

    // Frame batching: accumulate writes and flush on animation frame
    // This prevents render thrashing during fast output (e.g., cat large file)
    let pendingData: Uint8Array[] = [];
    let frameRequested = false;

    const flushPendingData = () => {
      if (pendingData.length === 0) return;

      // Concatenate all pending chunks
      const totalLength = pendingData.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of pendingData) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      pendingData = [];
      frameRequested = false;

      const text = decoder.decode(combined, { stream: true });
      terminal.write(text);
    };

    const unlisten = listen<string>(`pty-output-${id}`, (event) => {
      // Decode base64 to bytes
      const bytes = base64ToUint8Array(event.payload);
      pendingData.push(bytes);

      // Request animation frame if not already requested
      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(flushPendingData);
      }
    });

    terminal.onData((data) => {
      invoke("write_pty", { id, data }).catch(console.error);
    });

    // Custom key event handler for special key combinations
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;

      // Shift+Cmd+Enter: Toggle maximize
      if (e.shiftKey && e.metaKey && (e.key === "Enter" || e.keyCode === 13)) {
        e.preventDefault();
        e.stopPropagation();
        onToggleMaximizeRef.current?.();
        return false;
      }

      // Shift+Enter: Send literal newline for multi-line input (e.g., Claude Code)
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key === "Enter") {
        invoke("write_pty", { id, data: "\n" }).catch(console.error);
        return false;
      }

      // Cmd+Left: Go to beginning of line (sends Ctrl+A)
      if (e.metaKey && !e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        invoke("write_pty", { id, data: "\x01" }).catch(console.error);
        return false;
      }

      // Cmd+Right: Go to end of line (sends Ctrl+E)
      if (e.metaKey && !e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        invoke("write_pty", { id, data: "\x05" }).catch(console.error);
        return false;
      }

      // Option+Left: Move back one word (sends Escape+b)
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === "ArrowLeft") {
        e.preventDefault();
        invoke("write_pty", { id, data: "\x1bb" }).catch(console.error);
        return false;
      }

      // Option+Right: Move forward one word (sends Escape+f)
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === "ArrowRight") {
        e.preventDefault();
        invoke("write_pty", { id, data: "\x1bf" }).catch(console.error);
        return false;
      }

      return true; // Let terminal handle all other keys
    });

    // Trigger focus when clicking in terminal area
    const handleTerminalClick = () => {
      onFocusRef.current?.();
    };
    terminal.element?.addEventListener("click", handleTerminalClick);

    let resizeTimeout: number;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        fitAddon.fit();
        invoke("resize_pty", {
          id,
          cols: terminal.cols,
          rows: terminal.rows,
        }).catch(console.error);
      }, 100);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(resizeTimeout);
      unlisten.then((fn) => fn());
      terminal.element?.removeEventListener("click", handleTerminalClick);
      resizeObserver.disconnect();
      invoke("kill_pty", { id }).catch(console.error);
      terminal.dispose();
    };
  }, [id, cwd, command]);

  // Update terminal theme without recreating terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme.terminal.theme;
      terminalRef.current.options.fontFamily = theme.terminal.fontFamily;
    }
  }, [theme]);

  // Refit terminal when maximized state changes
  useEffect(() => {
    if (fitAddonRef.current) {
      // Small delay to let CSS transition complete
      const timeout = setTimeout(() => {
        fitAddonRef.current?.fit();
        if (terminalRef.current) {
          invoke("resize_pty", {
            id,
            cols: terminalRef.current.cols,
            rows: terminalRef.current.rows,
          }).catch(console.error);
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isMaximized, id]);

  // Update terminal font size when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      fitAddonRef.current?.fit();
      invoke("resize_pty", {
        id,
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
      }).catch(console.error);
    }
  }, [fontSize, id]);

  // Handle file drag and drop - only for focused pane
  useEffect(() => {
    if (!isFocused) return;

    const webview = getCurrentWebview();

    const unlisten = webview.onDragDropEvent((event) => {
      const { type } = event.payload;

      if (type === "enter" || type === "over") {
        setIsDragging(true);
      } else if (type === "drop") {
        setIsDragging(false);
        if (event.payload.paths.length > 0) {
          // Insert file paths into terminal (space-separated if multiple, quoted if contains spaces)
          const paths = event.payload.paths.map((p) =>
            p.includes(" ") ? `"${p}"` : p
          ).join(" ");
          invoke("write_pty", { id, data: paths }).catch(console.error);
        }
      } else if (type === "leave") {
        setIsDragging(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [id, isFocused]);

  // Handle keyboard shortcuts at container level (capture phase)
  function handleKeyDown(e: React.KeyboardEvent) {
    // Shift+Cmd+Enter: Toggle maximize
    if (e.shiftKey && e.metaKey && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onToggleMaximize?.();
      return;
    }

    // Cmd+Plus or Cmd+=: Increase font size
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

    // Cmd+Minus: Decrease font size
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

    // Cmd+K: Clear terminal
    if (e.metaKey && e.key === "k") {
      e.preventDefault();
      e.stopPropagation();
      if (terminalRef.current) {
        terminalRef.current.clear();
      }
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
        isFocused={isFocused}
        canClose={canClose}
        onClose={onClose}
        onRename={onRename}
        triggerRename={triggerRename}
        onTriggerRenameComplete={onTriggerRenameComplete}
        dragHandleProps={dragHandleProps}
      />
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
      {isDragging && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none flex items-center justify-center z-10">
          <div className="bg-background/90 border border-primary rounded-lg px-4 py-3 text-center shadow-lg">
            <p className="text-sm font-medium">Drop to insert path</p>
          </div>
        </div>
      )}
    </div>
  );
}
