import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SSHConnection } from "../lib/ssh";

interface UseRemoteValidationOptions {
  sshConnections: SSHConnection[];
}

interface UseRemoteValidationResult {
  sshConnectionId: string;
  setSshConnectionId: (id: string) => void;
  remoteProjectPath: string;
  setRemoteProjectPath: (path: string) => void;
  remoteOpen: boolean;
  setRemoteOpen: (open: boolean) => void;
  validatingPath: boolean;
  pathValid: boolean | null;
  validateRemotePath: () => Promise<void>;
  resetValidation: () => void;
}

/**
 * Hook that manages SSH connection state and remote path validation.
 * Shared between AddProjectModal and ProjectSettingsModal.
 */
export function useRemoteValidation(
  { sshConnections }: UseRemoteValidationOptions,
  initialConnectionId = "",
  initialRemotePath = ""
): UseRemoteValidationResult {
  const [sshConnectionId, setSshConnectionId] = useState(initialConnectionId);
  const [remoteProjectPath, setRemoteProjectPath] = useState(initialRemotePath);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [validatingPath, setValidatingPath] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);

  const validateRemotePath = useCallback(async () => {
    if (!sshConnectionId || !remoteProjectPath) return;

    const conn = sshConnections.find((c) => c.id === sshConnectionId);
    if (!conn) return;

    setValidatingPath(true);
    setPathValid(null);

    try {
      const exists = await invoke<boolean>("remote_path_exists", {
        host: conn.host,
        port: conn.port,
        user: conn.user,
        keyPath: conn.keyPath || null,
        path: remoteProjectPath,
      });
      setPathValid(exists);
    } catch {
      setPathValid(false);
    } finally {
      setValidatingPath(false);
    }
  }, [sshConnectionId, remoteProjectPath, sshConnections]);

  const resetValidation = useCallback(() => {
    setSshConnectionId("");
    setRemoteProjectPath("");
    setRemoteOpen(false);
    setValidatingPath(false);
    setPathValid(null);
  }, []);

  return {
    sshConnectionId,
    setSshConnectionId,
    remoteProjectPath,
    setRemoteProjectPath,
    remoteOpen,
    setRemoteOpen,
    validatingPath,
    pathValid,
    validateRemotePath,
    resetValidation,
  };
}
