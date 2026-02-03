import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { TerminalLayout } from "./TerminalLayout";
import { WindowShell } from "./WindowShell";
import type { ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";

export interface DetachedProjectConfig {
  project: ProjectConfig;
  layout: Layout;
  profiles: TerminalProfile[];
  defaultFontSize: number;
  defaultScrollback: number;
}

interface Props {
  projectId: string;
}

export function DetachedProjectView({ projectId }: Props) {
  const [config, setConfig] = useState<DetachedProjectConfig | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read config from localStorage (written by main window before opening)
    const configKey = `detached-project-${projectId}`;
    const stored = localStorage.getItem(configKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as DetachedProjectConfig;
        setConfig(parsed);
        setLayout(parsed.layout);
      } catch (e) {
        setError("Failed to parse project config");
      }
    } else {
      setError("Project config not found");
    }
  }, [projectId]);

  const handleReattach = async () => {
    // Emit reattach event to main window
    await emit("project-reattach", { projectId });
    // Close this window
    await invoke("close_detached_window", { label: `project-${projectId}` });
  };

  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout);
    // Optionally sync layout changes back to main window
    emit("project-layout-change", { projectId, layout: newLayout });
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

  if (!config || !layout) {
    return (
      <WindowShell title="Loading...">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading project...
        </div>
      </WindowShell>
    );
  }

  return (
    <WindowShell
      title={config.project.name}
      subtitle={config.project.path.split("/").pop()}
      onReattach={handleReattach}
    >
      <TerminalLayout
        project={config.project}
        layout={layout}
        profiles={config.profiles}
        defaultFontSize={config.defaultFontSize}
        defaultScrollback={config.defaultScrollback}
        paneFontSizes={{}}
        onPaneFontSizeChange={() => {}}
        onLayoutChange={handleLayoutChange}
        isProjectActive={true}
      />
    </WindowShell>
  );
}
