/**
 * SessionContext - Global session status tracking
 *
 * Aggregates status across all terminal panes and projects.
 * Provides per-project status rollup for sidebar badges.
 */

import { createContext, useContext, useCallback, useState, useMemo, type ReactNode } from "react";
import type { PaneStatus } from "../addons/StatusAddon";

export interface PaneStatusInfo {
  paneId: string;
  projectId: string;
  status: PaneStatus;
  acknowledged: boolean;
}

export interface ProjectStatusSummary {
  projectId: string;
  aggregateStatus: PaneStatus;
  waitingCount: number;
  runningCount: number;
}

interface SessionContextValue {
  /** Get status for a specific pane */
  getPaneStatus: (paneId: string) => PaneStatus;

  /** Update status for a pane */
  updatePaneStatus: (paneId: string, projectId: string, status: PaneStatus) => void;

  /** Acknowledge waiting status for a pane */
  acknowledgePaneStatus: (paneId: string) => void;

  /** Remove a pane from tracking */
  removePaneStatus: (paneId: string) => void;

  /** Get aggregate status summary for a project */
  getProjectStatus: (projectId: string) => ProjectStatusSummary;

  /** Get all pane statuses */
  allPaneStatuses: Map<string, PaneStatusInfo>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [paneStatuses, setPaneStatuses] = useState<Map<string, PaneStatusInfo>>(new Map());

  const getPaneStatus = useCallback((paneId: string): PaneStatus => {
    return paneStatuses.get(paneId)?.status ?? "idle";
  }, [paneStatuses]);

  const updatePaneStatus = useCallback((paneId: string, projectId: string, status: PaneStatus) => {
    setPaneStatuses((prev) => {
      const next = new Map(prev);
      const existing = prev.get(paneId);

      // If transitioning to waiting, mark as unacknowledged
      const acknowledged = status === "waiting" ? false : (existing?.acknowledged ?? true);

      next.set(paneId, {
        paneId,
        projectId,
        status,
        acknowledged,
      });
      return next;
    });
  }, []);

  const acknowledgePaneStatus = useCallback((paneId: string) => {
    setPaneStatuses((prev) => {
      const existing = prev.get(paneId);
      if (!existing) return prev;

      const next = new Map(prev);
      next.set(paneId, { ...existing, acknowledged: true });
      return next;
    });
  }, []);

  const removePaneStatus = useCallback((paneId: string) => {
    setPaneStatuses((prev) => {
      const next = new Map(prev);
      next.delete(paneId);
      return next;
    });
  }, []);

  const getProjectStatus = useCallback((projectId: string): ProjectStatusSummary => {
    let waitingCount = 0;
    let runningCount = 0;
    let hasWaiting = false;
    let hasRunning = false;

    for (const info of paneStatuses.values()) {
      if (info.projectId !== projectId) continue;

      if (info.status === "waiting" && !info.acknowledged) {
        waitingCount++;
        hasWaiting = true;
      } else if (info.status === "running") {
        runningCount++;
        hasRunning = true;
      }
    }

    // Priority: waiting > running > idle
    let aggregateStatus: PaneStatus = "idle";
    if (hasWaiting) {
      aggregateStatus = "waiting";
    } else if (hasRunning) {
      aggregateStatus = "running";
    }

    return { projectId, aggregateStatus, waitingCount, runningCount };
  }, [paneStatuses]);

  const value = useMemo<SessionContextValue>(() => ({
    getPaneStatus,
    updatePaneStatus,
    acknowledgePaneStatus,
    removePaneStatus,
    getProjectStatus,
    allPaneStatuses: paneStatuses,
  }), [getPaneStatus, updatePaneStatus, acknowledgePaneStatus, removePaneStatus, getProjectStatus, paneStatuses]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

/**
 * Hook to get project status summary
 */
export function useProjectStatus(projectId: string): ProjectStatusSummary {
  const { getProjectStatus } = useSession();
  return getProjectStatus(projectId);
}
