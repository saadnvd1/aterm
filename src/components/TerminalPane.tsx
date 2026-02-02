import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../context/ThemeContext";
import { PaneHeader } from "./PaneHeader";
import "@xterm/xterm/css/xterm.css";

interface Props {
  id: string;
  title: string;
  cwd: string;
  command?: string;
  accentColor?: string;
  onFocus?: () => void;
  isFocused?: boolean;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  onRename?: (name: string) => void;
  canClose?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;

export function TerminalPane({ id, title, cwd, command, accentColor, onFocus, isFocused, isMaximized, onToggleMaximize, onClose, onRename, canClose, dragHandleProps }: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  const onFocusRef = useRef(onFocus);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  // Keep the refs updated with latest callbacks
  onToggleMaximizeRef.current = onToggleMaximize;
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!containerRef.current || spawnedRef.current) return;
    spawnedRef.current = true;

    const terminal = new Terminal({
      fontFamily: theme.terminal.fontFamily,
      fontSize: DEFAULT_FONT_SIZE,
      cursorBlink: true,
      allowProposedApi: true,
      theme: theme.terminal.theme,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);

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

    const unlisten = listen<string>(`pty-output-${id}`, (event) => {
      terminal.write(event.payload);
    });

    terminal.onData((data) => {
      invoke("write_pty", { id, data }).catch(console.error);
    });

    // Intercept Shift+Cmd+Enter for maximize toggle
    terminal.attachCustomKeyEventHandler((e) => {
      // Check for Shift+Cmd+Enter (keyCode 13 is Enter)
      if (e.shiftKey && e.metaKey && (e.key === "Enter" || e.keyCode === 13)) {
        if (e.type === "keydown") {
          e.preventDefault();
          e.stopPropagation();
          onToggleMaximizeRef.current?.();
        }
        return false; // Prevent terminal from processing this key
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
  }, [id, cwd, command, theme]);

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
      setFontSize((prev) => Math.min(prev + 1, MAX_FONT_SIZE));
      return;
    }

    // Cmd+Minus: Decrease font size
    if (e.metaKey && e.key === "-") {
      e.preventDefault();
      e.stopPropagation();
      setFontSize((prev) => Math.max(prev - 1, MIN_FONT_SIZE));
      return;
    }
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 bg-background rounded-lg border border-border overflow-hidden"
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
        dragHandleProps={dragHandleProps}
      />
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
}
