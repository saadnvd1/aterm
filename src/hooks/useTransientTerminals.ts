import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TransientTerminal } from "../lib/transient";

export function useTransientTerminals() {
  const [terminals, setTerminals] = useState<TransientTerminal[]>([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const counterRef = useRef(1);

  const createTerminal = useCallback((cwd: string): TransientTerminal => {
    const terminal: TransientTerminal = {
      id: crypto.randomUUID(),
      name: `Terminal ${counterRef.current++}`,
      cwd,
    };
    setTerminals((prev) => [...prev, terminal]);
    setSelectedTerminalId(terminal.id);
    return terminal;
  }, []);

  const selectTerminal = useCallback((id: string) => {
    setSelectedTerminalId(id);
  }, []);

  const closeTerminal = useCallback((id: string) => {
    // Kill the PTY
    invoke("kill_pty", { id: `transient-${id}` }).catch(console.error);

    setTerminals((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      const newTerminals = prev.filter((t) => t.id !== id);

      // Select next terminal if we're closing the selected one
      setSelectedTerminalId((currentSelected) => {
        if (currentSelected !== id) return currentSelected;
        if (newTerminals.length === 0) return null;
        // Select the next terminal, or previous if we're at the end
        const nextIndex = Math.min(index, newTerminals.length - 1);
        return newTerminals[nextIndex].id;
      });

      return newTerminals;
    });
  }, []);

  const deselectTerminal = useCallback(() => {
    setSelectedTerminalId(null);
  }, []);

  return {
    terminals,
    selectedTerminalId,
    createTerminal,
    selectTerminal,
    closeTerminal,
    deselectTerminal,
  };
}
