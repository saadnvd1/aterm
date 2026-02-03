import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { TerminalPane } from "./TerminalPane";
import { GitPane } from "./git/GitPane";
import { WindowShell } from "./WindowShell";

export interface DetachedPaneConfig {
  paneId: string;
  terminalId: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  profileId: string;
  profileName: string;
  profileColor: string;
  profileType: "terminal" | "git";
  profileCommand?: string;
}

interface Props {
  paneId: string;
}

export function DetachedPaneView({ paneId }: Props) {
  const [config, setConfig] = useState<DetachedPaneConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read config from localStorage (written by main window before opening)
    const configKey = `detached-pane-${paneId}`;
    const stored = localStorage.getItem(configKey);

    if (stored) {
      try {
        setConfig(JSON.parse(stored));
      } catch (e) {
        setError("Failed to parse pane config");
      }
    } else {
      setError("Pane config not found");
    }
  }, [paneId]);

  const handleReattach = async () => {
    // Emit reattach event to main window
    await emit("pane-reattach", { paneId });
    // Close this window
    await invoke("close_detached_window", { label: `pane-${paneId}` });
  };

  if (error) {
    return (
      <WindowShell title="Error">
        <div className="flex items-center justify-center h-full text-destructive">
          {error}
        </div>
      </WindowShell>
    );
  }

  if (!config) {
    return (
      <WindowShell title="Loading...">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading terminal...
        </div>
      </WindowShell>
    );
  }

  const title = config.profileName;
  const subtitle = config.projectName;

  return (
    <WindowShell title={title} subtitle={subtitle} onReattach={handleReattach}>
      <div className="flex flex-col h-full p-1.5">
        {config.profileType === "git" ? (
          <GitPane
            id={config.terminalId}
            title={config.profileName}
            cwd={config.projectPath}
            accentColor={config.profileColor}
            isFocused={true}
            canClose={false}
          />
        ) : (
          <TerminalPane
            id={config.terminalId}
            title={config.profileName}
            cwd={config.projectPath}
            command={config.profileCommand}
            accentColor={config.profileColor}
            isFocused={true}
            canClose={false}
            isProjectActive={true}
          />
        )}
      </div>
    </WindowShell>
  );
}
