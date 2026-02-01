import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../context/ThemeContext";
import "@xterm/xterm/css/xterm.css";

interface Props {
  id: string;
  title: string;
  cwd: string;
  command?: string;
  accentColor?: string;
  onFocus?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;

export function TerminalPane({ id, title, cwd, command, accentColor, onFocus, isMaximized, onToggleMaximize }: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  // Keep the ref updated with latest callback
  onToggleMaximizeRef.current = onToggleMaximize;

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
    <div style={styles.container} onClick={onFocus} onKeyDownCapture={handleKeyDown}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          {accentColor && (
            <span style={{ ...styles.indicator, backgroundColor: accentColor }} />
          )}
          <span style={styles.title}>{title}</span>
        </div>
        <span style={styles.path}>{cwd.split("/").pop()}</span>
      </div>
      <div ref={containerRef} style={styles.terminal} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    backgroundColor: "var(--bg)",
    borderRadius: "8px",
    border: "1px solid var(--border-subtle)",
    overflow: "hidden",
  },
  header: {
    padding: "8px 12px",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  indicator: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  title: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
  },
  path: {
    fontSize: "11px",
    color: "var(--text-subtle)",
  },
  terminal: {
    flex: 1,
    padding: "8px",
    overflow: "hidden",
  },
};
