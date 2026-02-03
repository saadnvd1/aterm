/**
 * StatusAddon - Custom xterm.js addon for session status detection
 *
 * Monitors terminal content for patterns that indicate:
 * - "running": AI is actively working (spinners, "esc to interrupt")
 * - "waiting": AI needs user input ([Y/n], Allow?, etc.)
 * - "idle": No activity, user has acknowledged
 *
 * Based on agent-os status-detector.ts patterns.
 */

import type { Terminal, ITerminalAddon, IDisposable } from "@xterm/xterm";
import { checkBusyIndicators, checkWaitingPatterns } from "../lib/status-patterns";

export type PaneStatus = "idle" | "running" | "waiting";

export interface StatusChangeEvent {
  paneId: string;
  status: PaneStatus;
  previousStatus: PaneStatus;
  isAgent: boolean; // True if we've detected AI agent patterns
}

// Configuration
const CONFIG = {
  ACTIVITY_COOLDOWN_MS: 2000,    // Grace period after activity stops
  SPIKE_WINDOW_MS: 1000,         // Window to detect sustained activity
  SUSTAINED_THRESHOLD: 2,        // Changes needed to confirm activity
  CHECK_INTERVAL_MS: 500,        // How often to check status
  MAX_LINES_TO_CHECK: 50,        // Maximum lines to read from buffer
};

interface StateTracker {
  lastChangeTime: number;
  acknowledged: boolean;
  spikeWindowStart: number | null;
  spikeChangeCount: number;
  lastBufferSnapshot: string;
  isAgentDetected: boolean; // True once we've seen AI-specific patterns
}

export class StatusAddon implements ITerminalAddon {
  private terminal: Terminal | null = null;
  private paneId: string;
  private tracker: StateTracker;
  private checkInterval: number | null = null;
  private disposables: IDisposable[] = [];
  private onStatusChangeCallbacks: ((event: StatusChangeEvent) => void)[] = [];
  private currentStatus: PaneStatus = "idle";

  constructor(paneId: string) {
    this.paneId = paneId;
    this.tracker = {
      lastChangeTime: Date.now() - CONFIG.ACTIVITY_COOLDOWN_MS,
      acknowledged: true,
      spikeWindowStart: null,
      spikeChangeCount: 0,
      lastBufferSnapshot: "",
      isAgentDetected: false,
    };
  }

  activate(terminal: Terminal): void {
    this.terminal = terminal;

    // Listen for data writes (activity detection)
    const dataDisposable = terminal.onData(() => {
      this.onActivity();
    });
    this.disposables.push(dataDisposable);

    // Start periodic status checking
    this.checkInterval = window.setInterval(() => {
      this.checkStatus();
    }, CONFIG.CHECK_INTERVAL_MS);
  }

  dispose(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.terminal = null;
    this.onStatusChangeCallbacks = [];
  }

  /**
   * Register a callback for status changes
   */
  onStatusChange(callback: (event: StatusChangeEvent) => void): IDisposable {
    this.onStatusChangeCallbacks.push(callback);
    return {
      dispose: () => {
        const index = this.onStatusChangeCallbacks.indexOf(callback);
        if (index !== -1) {
          this.onStatusChangeCallbacks.splice(index, 1);
        }
      },
    };
  }

  /**
   * Get current status
   */
  getStatus(): PaneStatus {
    return this.currentStatus;
  }

  /**
   * Acknowledge waiting status (marks as idle)
   */
  acknowledge(): void {
    this.tracker.acknowledged = true;
    if (this.currentStatus === "waiting") {
      this.updateStatus("idle");
    }
  }

  /**
   * Called when there's terminal activity (user types, output received)
   */
  private onActivity(): void {
    const now = Date.now();

    // Spike detection: detect sustained activity vs single spikes
    const windowExpired =
      this.tracker.spikeWindowStart === null ||
      now - this.tracker.spikeWindowStart > CONFIG.SPIKE_WINDOW_MS;

    if (windowExpired) {
      this.tracker.spikeWindowStart = now;
      this.tracker.spikeChangeCount = 1;
    } else {
      this.tracker.spikeChangeCount++;
      if (this.tracker.spikeChangeCount >= CONFIG.SUSTAINED_THRESHOLD) {
        this.tracker.lastChangeTime = now;
        this.tracker.acknowledged = false;
        this.tracker.spikeWindowStart = null;
        this.tracker.spikeChangeCount = 0;
      }
    }
  }

  /**
   * Get terminal buffer content (last N lines)
   */
  private getBufferContent(): string {
    if (!this.terminal) return "";

    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];
    // buffer.length is the total number of lines (including scrollback)
    const totalLines = buffer.length;
    const startLine = Math.max(0, totalLines - CONFIG.MAX_LINES_TO_CHECK);

    for (let i = startLine; i < totalLines; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines.join("\n");
  }

  /**
   * Check and update status based on current terminal state
   */
  private checkStatus(): void {
    if (!this.terminal) return;

    const content = this.getBufferContent();
    const now = Date.now();

    // Detect buffer changes for activity tracking
    if (content !== this.tracker.lastBufferSnapshot) {
      this.tracker.lastBufferSnapshot = content;
      this.onActivity();
    }

    let newStatus: PaneStatus;
    const hasBusyIndicators = checkBusyIndicators(content);
    const hasWaitingPatterns = checkWaitingPatterns(content);

    // Mark as agent if we detect AI-specific patterns
    if (hasBusyIndicators || hasWaitingPatterns) {
      this.tracker.isAgentDetected = true;
    }

    // Priority 1: Check for busy indicators (actively running)
    if (hasBusyIndicators) {
      this.tracker.lastChangeTime = now;
      this.tracker.acknowledged = false;
      newStatus = "running";
    }
    // Priority 2: Check for waiting patterns
    else if (hasWaitingPatterns) {
      this.tracker.acknowledged = false;
      newStatus = "waiting";
    }
    // Priority 3: Check cooldown period (only for detected agents)
    else if (this.tracker.isAgentDetected && now - this.tracker.lastChangeTime < CONFIG.ACTIVITY_COOLDOWN_MS) {
      newStatus = "running";
    }
    // Priority 4: Cooldown expired, no patterns - idle
    else {
      this.tracker.acknowledged = true;
      newStatus = "idle";
    }

    this.updateStatus(newStatus);
  }

  /**
   * Update status and notify listeners if changed
   */
  private updateStatus(newStatus: PaneStatus): void {
    if (newStatus !== this.currentStatus) {
      const event: StatusChangeEvent = {
        paneId: this.paneId,
        status: newStatus,
        previousStatus: this.currentStatus,
        isAgent: this.tracker.isAgentDetected,
      };
      this.currentStatus = newStatus;

      // Notify all listeners
      this.onStatusChangeCallbacks.forEach((cb) => cb(event));
    }
  }

  /**
   * Check if this pane has been detected as an AI agent
   */
  isAgent(): boolean {
    return this.tracker.isAgentDetected;
  }
}
