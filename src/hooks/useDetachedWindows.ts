import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";
import type { DetachedPaneConfig } from "../components/DetachedPaneView";
import type { DetachedProjectConfig } from "../components/DetachedProjectView";

interface WindowConfig {
  window_type: string;
  id: string;
  title: string;
  width?: number;
  height?: number;
}

export function useDetachedWindows() {
  const [detachedPanes, setDetachedPanes] = useState<Set<string>>(new Set());
  const [detachedProjects, setDetachedProjects] = useState<Set<string>>(
    new Set()
  );

  // Listen for reattach requests from detached windows
  useEffect(() => {
    const unlistenPaneReattach = listen<{ paneId: string }>(
      "pane-reattach",
      (event) => {
        const { paneId } = event.payload;
        // Clean up localStorage
        localStorage.removeItem(`detached-pane-${paneId}`);
        // Update state
        setDetachedPanes((prev) => {
          const next = new Set(prev);
          next.delete(paneId);
          return next;
        });
      }
    );

    const unlistenProjectReattach = listen<{ projectId: string }>(
      "project-reattach",
      (event) => {
        const { projectId } = event.payload;
        // Clean up localStorage
        localStorage.removeItem(`detached-project-${projectId}`);
        // Update state
        setDetachedProjects((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    );

    return () => {
      unlistenPaneReattach.then((fn) => fn());
      unlistenProjectReattach.then((fn) => fn());
    };
  }, []);

  const detachPane = useCallback(
    async (
      paneId: string,
      terminalId: string,
      project: ProjectConfig,
      profile: TerminalProfile
    ) => {
      // Store config in localStorage for the detached window to read
      const config: DetachedPaneConfig = {
        paneId,
        terminalId,
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path,
        profileId: profile.id,
        profileName: profile.name,
        profileColor: profile.color,
        profileType: (profile.type as "terminal" | "git") || "terminal",
        profileCommand: profile.command,
      };
      localStorage.setItem(`detached-pane-${paneId}`, JSON.stringify(config));

      // Create the window
      const windowConfig: WindowConfig = {
        window_type: "pane",
        id: paneId,
        title: `${project.name} — ${profile.name}`,
        width: 900,
        height: 700,
      };

      const label = await invoke<string>("create_detached_window", {
        config: windowConfig,
      });

      setDetachedPanes((prev) => new Set(prev).add(paneId));
      return label;
    },
    []
  );

  const detachProject = useCallback(
    async (
      project: ProjectConfig,
      layout: Layout,
      profiles: TerminalProfile[],
      defaultFontSize: number,
      defaultScrollback: number
    ) => {
      // Store config in localStorage for the detached window to read
      const config: DetachedProjectConfig = {
        project,
        layout,
        profiles,
        defaultFontSize,
        defaultScrollback,
      };
      localStorage.setItem(
        `detached-project-${project.id}`,
        JSON.stringify(config)
      );

      // Create the window
      const windowConfig: WindowConfig = {
        window_type: "project",
        id: project.id,
        title: project.name,
        width: 1400,
        height: 900,
      };

      const label = await invoke<string>("create_detached_window", {
        config: windowConfig,
      });

      setDetachedProjects((prev) => new Set(prev).add(project.id));
      return label;
    },
    []
  );

  const reattachPane = useCallback(async (paneId: string) => {
    localStorage.removeItem(`detached-pane-${paneId}`);
    await invoke("close_detached_window", { label: `pane-${paneId}` });
    setDetachedPanes((prev) => {
      const next = new Set(prev);
      next.delete(paneId);
      return next;
    });
  }, []);

  const reattachProject = useCallback(async (projectId: string) => {
    localStorage.removeItem(`detached-project-${projectId}`);
    await invoke("close_detached_window", { label: `project-${projectId}` });
    setDetachedProjects((prev) => {
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });
  }, []);

  return {
    detachedPanes,
    detachedProjects,
    isPaneDetached: (id: string) => detachedPanes.has(id),
    isProjectDetached: (id: string) => detachedProjects.has(id),
    detachPane,
    detachProject,
    reattachPane,
    reattachProject,
  };
}
