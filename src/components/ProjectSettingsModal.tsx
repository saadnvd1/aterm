import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import { PROVIDERS, ProviderId } from "../lib/providers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectConfig;
  layouts: Layout[];
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
  onSave,
}: Props) {
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);
  const [provider, setProvider] = useState<ProviderId>(project.provider);
  const [layoutId, setLayoutId] = useState(project.layoutId);
  const [icon, setIcon] = useState(project.icon || "");
  const [color, setColor] = useState(project.color || "");

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
    });
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
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
