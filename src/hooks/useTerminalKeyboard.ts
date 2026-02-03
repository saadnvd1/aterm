import { useCallback, MutableRefObject } from "react";
import { Terminal } from "@xterm/xterm";
import { MIN_FONT_SIZE, MAX_FONT_SIZE } from "../components/terminal-pane";

interface UseTerminalKeyboardOptions {
  terminalRef: MutableRefObject<Terminal | null>;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  setFontSize: (setter: (prev: number) => number) => void;
  onFontSizeChange?: (size: number) => void;
  onToggleMaximize?: () => void;
}

/**
 * Hook that handles keyboard shortcuts for terminal pane.
 * Returns a keydown handler to be used with onKeyDownCapture.
 */
export function useTerminalKeyboard({
  terminalRef,
  isSearchOpen,
  setIsSearchOpen,
  setFontSize,
  onFontSizeChange,
  onToggleMaximize,
}: UseTerminalKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd+F: Open search
      if (e.metaKey && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
        return;
      }

      // Escape: Close search
      if (e.key === "Escape" && isSearchOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(false);
        return;
      }

      // Cmd+Shift+Enter: Toggle maximize
      if (e.shiftKey && e.metaKey && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onToggleMaximize?.();
        return;
      }

      // Cmd+ or Cmd+=: Increase font size
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

      // Cmd+-: Decrease font size
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
        terminalRef.current?.clear();
        return;
      }
    },
    [isSearchOpen, setIsSearchOpen, setFontSize, onFontSizeChange, onToggleMaximize, terminalRef]
  );

  return handleKeyDown;
}
