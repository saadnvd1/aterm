import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useTheme } from "../context/ThemeContext";
import { useTerminalInstance, useTerminalKeyboard, fitPreservingScroll } from "../hooks";
import { PaneHeader } from "./PaneHeader";
import { SearchOverlay, DragDropOverlay, DEFAULT_SCROLLBACK } from "./terminal-pane";
import "@xterm/xterm/css/xterm.css";

// Re-export for external use
export { killPty, serializeRefs } from "./terminal-pane";

interface Props {
  id: string;
  title: string;
  cwd: string;
  command?: string;
  initialInput?: string;
  // For remote: command to run first (e.g., "claude"), then initialInput is sent after CLI is ready
  remoteCommand?: string;
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
  // Remote execution props
  isRemote?: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshKeyPath?: string;
  tmuxSession?: string;
}

export function TerminalPane({
  id,
  title,
  cwd,
  command,
  initialInput,
  remoteCommand,
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
  isRemote,
  sshHost,
  sshPort,
  sshUser,
  sshKeyPath,
  tmuxSession,
}: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(savedFontSize ?? defaultFontSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Use the terminal instance hook
  const { terminalRef, fitAddonRef, searchAddonRef } = useTerminalInstance({
    id,
    cwd,
    command,
    initialInput,
    remoteCommand,
    scrollback,
    fontSize: savedFontSize ?? defaultFontSize,
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
  });

  // Use the keyboard hook
  const handleKeyDown = useTerminalKeyboard({
    terminalRef,
    isSearchOpen,
    setIsSearchOpen,
    setFontSize,
    onFontSizeChange,
    onToggleMaximize,
  });

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
