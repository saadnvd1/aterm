import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

/**
 * Custom clipboard provider for xterm.js ClipboardAddon that uses Tauri's
 * clipboard plugin instead of the browser's Clipboard API.
 *
 * This bypasses browser restrictions that require user gestures for clipboard
 * access, enabling OSC 52 sequences from tmux/remote terminals to work.
 */
export const TauriClipboardProvider = {
  async readText(): Promise<string> {
    try {
      return await readText();
    } catch (e) {
      console.error("Failed to read clipboard:", e);
      return "";
    }
  },

  async writeText(_selection: string, text: string): Promise<void> {
    try {
      await writeText(text);
    } catch (e) {
      console.error("Failed to write to clipboard:", e);
    }
  },
};
