/**
 * useNotifications - Hook for session status notifications
 *
 * Provides:
 * - Subtle audio notifications using Web Audio API
 * - Browser notifications for waiting/completed states
 * - Window title updates
 */

import { useEffect, useRef, useCallback } from "react";
import type { StatusChangeEvent } from "../components/terminal-pane";

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  browserNotifications: boolean;
  notifyOnWaiting: boolean;
  notifyOnComplete: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  soundEnabled: true,
  browserNotifications: true,
  notifyOnWaiting: true,
  notifyOnComplete: false,
};

// Audio context singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/**
 * Play a subtle two-tone notification sound
 */
function playNotificationSound(type: "waiting" | "complete" | "error") {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Define frequencies for different notification types
    const frequencies: Record<typeof type, [number, number]> = {
      waiting: [880, 660],   // Descending - needs attention
      complete: [660, 880],  // Ascending - task done
      error: [440, 330],     // Low tones - error
    };

    const [freq1, freq2] = frequencies[type];

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.value = freq1;
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (slightly delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = freq2;
    gain2.gain.setValueAtTime(0.1, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.25);
  } catch (e) {
    console.warn("Failed to play notification sound:", e);
  }
}

/**
 * Request browser notification permission
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Show a browser notification
 */
function showBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification(title, {
    body,
    icon: "/icon.png",
    silent: true, // We handle our own sounds
  });
}

export function useNotifications(settings: NotificationSettings = DEFAULT_SETTINGS) {
  const settingsRef = useRef(settings);
  const originalTitle = useRef(document.title);

  // Keep settings ref updated
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Request notification permission on mount if enabled
  useEffect(() => {
    if (settings.enabled && settings.browserNotifications) {
      requestNotificationPermission();
    }
  }, [settings.enabled, settings.browserNotifications]);

  /**
   * Handle a status change event
   */
  const handleStatusChange = useCallback((
    event: StatusChangeEvent,
    paneName?: string,
    projectName?: string
  ) => {
    const s = settingsRef.current;
    if (!s.enabled) return;

    const { status, previousStatus } = event;
    const displayName = paneName || "Terminal";
    const context = projectName ? ` (${projectName})` : "";

    // running → waiting: Needs attention
    if (previousStatus === "running" && status === "waiting") {
      if (s.notifyOnWaiting) {
        if (s.soundEnabled) {
          playNotificationSound("waiting");
        }
        if (s.browserNotifications) {
          showBrowserNotification(
            `${displayName} needs input`,
            `${displayName}${context} is waiting for your response`
          );
        }
        // Update window title
        document.title = `⚠️ ${displayName} waiting - aTerm`;
      }
    }

    // running → idle: Task completed
    if (previousStatus === "running" && status === "idle") {
      if (s.notifyOnComplete) {
        if (s.soundEnabled) {
          playNotificationSound("complete");
        }
        if (s.browserNotifications) {
          showBrowserNotification(
            `${displayName} completed`,
            `${displayName}${context} has finished`
          );
        }
      }
      // Restore window title
      document.title = originalTitle.current;
    }

    // Back to idle - restore title
    if (status === "idle") {
      document.title = originalTitle.current;
    }
  }, []);

  /**
   * Update window title based on aggregate status
   */
  const updateWindowTitle = useCallback((waitingCount: number, runningCount: number) => {
    if (waitingCount > 0) {
      document.title = `⚠️ ${waitingCount} waiting - aTerm`;
    } else if (runningCount > 0) {
      document.title = `🔵 ${runningCount} running - aTerm`;
    } else {
      document.title = originalTitle.current;
    }
  }, []);

  return {
    handleStatusChange,
    updateWindowTitle,
    playNotificationSound,
  };
}
