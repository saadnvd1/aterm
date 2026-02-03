import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRight, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import type { SSHConnection } from "../lib/ssh";
import { PROVIDERS, ProviderId } from "../lib/providers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectConfig;
  layouts: Layout[];
  sshConnections: SSHConnection[];
  onSave: (project: ProjectConfig) => void;
}

const PRESET_COLORS = [
  "#7c5cff", // Purple
  "#00d4aa", // Teal
  "#ff6b6b", // Red
  "#4ecdc4", // Cyan
  "#ffe66d", // Yellow
  "#f97316", // Orange
  "#06b6d4", // Sky
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#888888", // Gray (default/none)
];

const PRESET_ICONS = [
  "🚀", "💻", "🔧", "📦", "🎯", "⚡", "🔥", "🌟", "🎨", "📱",
  "🌐", "🔒", "📊", "🎮", "🤖", "💡", "📝", "🏠", "🛠️", "✨",
];

export function ProjectSettingsModal({
  isOpen,
  onClose,
  project,
  layouts,
  sshConnections,
  onSave,
}: Props) {
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);
  const [provider, setProvider] = useState<ProviderId>(project.provider);
  const [layoutId, setLayoutId] = useState(project.layoutId);
  const [icon, setIcon] = useState(project.icon || "");
  const [color, setColor] = useState(project.color || "");
  const [skipPermissions, setSkipPermissions] = useState(project.skipPermissions || false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [sshConnectionId, setSshConnectionId] = useState(project.sshConnectionId || "");
  const [remoteProjectPath, setRemoteProjectPath] = useState(project.remoteProjectPath || "");
  const [validatingPath, setValidatingPath] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);

  async function handleBrowse() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
        defaultPath: path || undefined,
      });
      if (selected) {
        setPath(selected as string);
      }
    } catch (err) {
      console.error("Failed to open directory picker:", err);
    }
  }

  async function validateRemotePath() {
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
  }

  function handleSave() {
    if (!name.trim() || !path.trim()) return;
    onSave({
      ...project,
      name: name.trim(),
      path: path.trim(),
      provider,
      layoutId,
      icon: icon || undefined,
      color: color || undefined,
      skipPermissions,
      sshConnectionId: sshConnectionId || undefined,
      remoteProjectPath: remoteProjectPath || undefined,
    });
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2 overflow-y-auto pr-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </span>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Working Directory
            </span>
            <div className="flex gap-2">
              <Input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/project"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                Browse
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              AI Provider
            </span>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDERS).map(([id, p]) => (
                  <SelectItem key={id} value={id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Default Layout
            </span>
            <Select value={layoutId} onValueChange={setLayoutId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {layouts.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Icon
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setIcon("")}
                className={`w-8 h-8 rounded border text-xs flex items-center justify-center transition-colors ${
                  !icon
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                ✕
              </button>
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 rounded border text-base flex items-center justify-center transition-colors ${
                    icon === emoji
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Color
            </span>
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                <button
                  onClick={() => setColor("")}
                  className={`w-6 h-6 rounded border text-[10px] flex items-center justify-center transition-colors ${
                    !color
                      ? "border-primary"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  ✕
                </button>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded transition-all ${
                      color === c
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={color || "#888888"}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 p-0 border-none rounded cursor-pointer"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              Applied to all terminal headers in this project
            </span>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Advanced
            </span>
            <div className="flex items-center justify-between mt-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">Skip Permissions</span>
                <span className="text-[10px] text-muted-foreground">
                  Auto-accept tool calls in AI providers (Claude --dangerously-skip-permissions)
                </span>
              </div>
              <Switch
                checked={skipPermissions}
                onCheckedChange={setSkipPermissions}
              />
            </div>
          </div>

          {sshConnections.length > 0 && (
            <div className="border border-border rounded-lg">
              <button
                type="button"
                onClick={() => setRemoteOpen(!remoteOpen)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight
                  className={cn("h-4 w-4 transition-transform", remoteOpen && "rotate-90")}
                />
                Remote Execution
                {sshConnectionId && (
                  <span className="ml-auto text-xs text-primary">
                    {sshConnections.find((c) => c.id === sshConnectionId)?.name}
                  </span>
                )}
              </button>
              {remoteOpen && (
                <div className="border-t border-border px-3 py-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      SSH Connection
                    </span>
                    <Select value={sshConnectionId || "_none"} onValueChange={(v) => setSshConnectionId(v === "_none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="None (local execution)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None (local execution)</SelectItem>
                        {sshConnections.map((conn) => (
                          <SelectItem key={conn.id} value={conn.id}>
                            {conn.name} ({conn.user}@{conn.host})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {sshConnectionId && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Remote Project Path
                      </span>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={remoteProjectPath}
                          onChange={(e) => setRemoteProjectPath(e.target.value)}
                          placeholder="/home/user/dev/project"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={validateRemotePath}
                          disabled={!remoteProjectPath || validatingPath}
                        >
                          {validatingPath ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : pathValid === true ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : pathValid === false ? (
                            <X className="h-4 w-4 text-destructive" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                      {pathValid === false && (
                        <span className="text-[10px] text-destructive">
                          Path does not exist on remote server
                        </span>
                      )}
                      {pathValid === true && (
                        <span className="text-[10px] text-green-500">
                          Path verified
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || !path.trim()}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
