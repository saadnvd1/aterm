/**
 * NotificationManager - Global notification handler
 *
 * Monitors session status changes and triggers notifications.
 * Should be placed near the root of the app.
 */

import { useEffect, useRef } from "react";
import { useSession } from "../context/SessionContext";
import { useNotifications } from "../hooks/useNotifications";
import type { PaneStatus } from "../addons/StatusAddon";

interface Props {
  /** Map of pane IDs to display names */
  paneNames?: Map<string, string>;
  /** Map of pane IDs to project names */
  projectNames?: Map<string, string>;
}

export function NotificationManager({ paneNames, projectNames }: Props) {
  const { allPaneStatuses } = useSession();
  const { handleStatusChange, updateWindowTitle } = useNotifications();
  const previousStatuses = useRef<Map<string, PaneStatus>>(new Map());

  useEffect(() => {
    // Check for status changes
    let waitingCount = 0;
    let runningCount = 0;

    for (const [paneId, info] of allPaneStatuses) {
      const previousStatus = previousStatuses.current.get(paneId);

      // Count aggregates
      if (info.status === "waiting" && !info.acknowledged) {
        waitingCount++;
      } else if (info.status === "running") {
        runningCount++;
      }

      // Detect transitions
      if (previousStatus && previousStatus !== info.status) {
        handleStatusChange(
          {
            paneId,
            status: info.status,
            previousStatus,
          },
          paneNames?.get(paneId),
          projectNames?.get(paneId)
        );
      }

      // Update tracking
      previousStatuses.current.set(paneId, info.status);
    }

    // Clean up removed panes
    for (const paneId of previousStatuses.current.keys()) {
      if (!allPaneStatuses.has(paneId)) {
        previousStatuses.current.delete(paneId);
      }
    }

    // Update window title based on aggregate status
    updateWindowTitle(waitingCount, runningCount);
  }, [allPaneStatuses, handleStatusChange, updateWindowTitle, paneNames, projectNames]);

  return null;
}
