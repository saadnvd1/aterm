import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { SerializeAddon } from "@xterm/addon-serialize";
import { invoke } from "@tauri-apps/api/core";
import { StatusAddon, type PaneStatus, type StatusChangeEvent } from "../addons/StatusAddon";
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

// Re-export for external use
export { killPty, serializeRefs } from "./terminal-pane";

interface Props {
  id: string;
  title: string;
  cwd: string;
  command?: string;
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
  onStatusChange?: (event: StatusChangeEvent) => void;
  /** If true, this pane is configured as an AI agent (show status immediately) */
  isProfileAgent?: boolean;
}

// Re-export types for consumers
export type { PaneStatus, StatusChangeEvent };

export function TerminalPane({
  id,
  title,
  cwd,
  command,
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
  onStatusChange,
  isProfileAgent = false,
}: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const statusAddonRef = useRef<StatusAddon | null>(null);
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  const onFocusRef = useRef(onFocus);
  const onStatusChangeRef = useRef(onStatusChange);

  const [fontSize, setFontSize] = useState(savedFontSize ?? defaultFontSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [paneStatus, setPaneStatus] = useState<PaneStatus>("idle");
  const [isAgentPane, setIsAgentPane] = useState(isProfileAgent);

  // Keep refs updated with latest callbacks
  onToggleMaximizeRef.current = onToggleMaximize;
  onFocusRef.current = onFocus;
  onStatusChangeRef.current = onStatusChange;

  // Main terminal setup effect
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if terminal instance already exists (survives remounts from drag operations)
    let instance = terminalInstances.get(id);
    let terminal: Terminal;
    let fitAddon: FitAddon;
    let searchAddon: SearchAddon;
    let serializeAddon: SerializeAddon;
    let statusAddon: StatusAddon;
    let isNewInstance = false;

    if (instance) {
      // Reuse existing terminal - just reattach to new DOM element
      terminal = instance.terminal;
      fitAddon = instance.fitAddon;
      searchAddon = instance.searchAddon;
      serializeAddon = instance.serializeAddon;
      statusAddon = instance.statusAddon;

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

      const clipboardAddon = new ClipboardAddon();
      terminal.loadAddon(clipboardAddon);

      serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);

      // Status addon for session status detection
      statusAddon = new StatusAddon(id);
      terminal.loadAddon(statusAddon);

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
    statusAddonRef.current = statusAddon;
    serializeRefs.set(id, () => serializeAddon.serialize());

    // Set up status change listener
    const statusDisposable = statusAddon.onStatusChange((event) => {
      setPaneStatus(event.status);
      if (event.isAgent) {
        setIsAgentPane(true);
      }
      onStatusChangeRef.current?.(event);
    });

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
        pendingData.push(base64ToUint8Array(event.payload));
        if (!frameRequested) {
          frameRequested = true;
          requestAnimationFrame(flushPendingData);
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
        fitAddon.fit();
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
      statusAddon,
      unlisten: unlistenFn || instance?.unlisten || null,
    });

    return () => {
      clearTimeout(resizeTimeout);
      terminal.element?.removeEventListener("click", handleTerminalClick);
      resizeObserver.disconnect();
      statusDisposable.dispose();
    };
  }, [id, cwd, command]);

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = theme.terminal.theme;
      terminalRef.current.options.fontFamily = theme.terminal.fontFamily;
    }
  }, [theme]);

  // Refit on maximize
  useEffect(() => {
    if (fitAddonRef.current) {
      const timeout = setTimeout(() => {
        fitAddonRef.current?.fit();
        if (terminalRef.current) {
          invoke("resize_pty", { id, cols: terminalRef.current.cols, rows: terminalRef.current.rows }).catch(console.error);
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [isMaximized, id]);

  // Update font size
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      fitAddonRef.current?.fit();
      invoke("resize_pty", { id, cols: terminalRef.current.cols, rows: terminalRef.current.rows }).catch(console.error);
    }
  }, [fontSize, id]);

  // Sync to default font size
  useEffect(() => {
    if (savedFontSize === undefined) setFontSize(defaultFontSize);
  }, [defaultFontSize, savedFontSize]);

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
        status={isAgentPane ? paneStatus : undefined}
      />
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
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
