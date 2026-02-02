import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, X, Download } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { Checkbox } from "@/components/ui/checkbox";
import { useTheme } from "../context/ThemeContext";
import { getThemeList } from "../lib/themes";
import type { AppConfig } from "../lib/config";
import type { TerminalProfile } from "../lib/profiles";
import type { Layout } from "../lib/layouts";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
}

interface ITermProfile {
  name: string;
  guid: string;
  command: string | null;
  workingDirectory: string | null;
}

// Generate a color from a string (deterministic hash)
function stringToColor(str: string): string {
  const colors = [
    "#7c5cff", "#00d4aa", "#ff6b6b", "#4ecdc4", "#ffe66d",
    "#f97316", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function SettingsModal({ isOpen, onClose, config, onConfigChange }: Props) {
  const { themeId, setThemeId } = useTheme();
  const themes = getThemeList();
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [itermProfiles, setItermProfiles] = useState<ITermProfile[]>([]);
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
  }, []);

  async function handleImportClick() {
    setImportError(null);
    try {
      const profiles = await invoke<ITermProfile[]>("get_iterm_profiles");
      setItermProfiles(profiles);
      setSelectedImports(new Set(profiles.map(p => p.guid)));
      setShowImportModal(true);
    } catch (e) {
      setImportError(e as string);
    }
  }

  function handleImportConfirm() {
    const newProfiles: TerminalProfile[] = itermProfiles
      .filter(p => selectedImports.has(p.guid))
      .map(p => ({
        id: `iterm-${p.guid}`,
        name: p.name,
        command: p.command || undefined,
        color: stringToColor(p.guid),
      }));

    // Merge with existing, avoiding duplicates by id
    const existingIds = new Set(config.profiles.map(p => p.id));
    const toAdd = newProfiles.filter(p => !existingIds.has(p.id));

    if (toAdd.length > 0) {
      onConfigChange({ ...config, profiles: [...config.profiles, ...toAdd] });
    }

    setShowImportModal(false);
  }

  function toggleImport(guid: string) {
    const newSet = new Set(selectedImports);
    if (newSet.has(guid)) {
      newSet.delete(guid);
    } else {
      newSet.add(guid);
    }
    setSelectedImports(newSet);
  }

  function handleProfileSave(profile: TerminalProfile) {
    const exists = config.profiles.some((p) => p.id === profile.id);
    const newProfiles = exists
      ? config.profiles.map((p) => (p.id === profile.id ? profile : p))
      : [...config.profiles, profile];
    onConfigChange({ ...config, profiles: newProfiles });
    setEditingProfile(null);
  }

  function handleProfileDelete(profileId: string) {
    const newProfiles = config.profiles.filter((p) => p.id !== profileId);
    onConfigChange({ ...config, profiles: newProfiles });
  }

  function handleLayoutSave(layout: Layout) {
    const exists = config.layouts.some((l) => l.id === layout.id);
    const newLayouts = exists
      ? config.layouts.map((l) => (l.id === layout.id ? layout : l))
      : [...config.layouts, layout];
    onConfigChange({ ...config, layouts: newLayouts });
    setEditingLayout(null);
  }

  function handleLayoutDelete(layoutId: string) {
    const newLayouts = config.layouts.filter((l) => l.id !== layoutId);
    onConfigChange({ ...config, layouts: newLayouts });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="flex-1 overflow-auto mt-4">
            <div className="mb-6">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Theme
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThemeId(t.id)}
                    className={cn(
                      "p-2 bg-muted border-2 border-transparent rounded-lg cursor-pointer flex flex-col items-center gap-2 transition-all hover:border-muted-foreground/30",
                      themeId === t.id && "border-primary"
                    )}
                  >
                    <div
                      className="w-full h-[50px] rounded flex overflow-hidden"
                      style={{ backgroundColor: t.colors.bg }}
                    >
                      <div
                        className="w-1/4 h-full"
                        style={{ backgroundColor: t.colors.bgSecondary }}
                      />
                      <div className="flex-1 p-1.5 flex flex-col gap-1">
                        <div
                          className="w-2/5 h-1.5 rounded-sm"
                          style={{ backgroundColor: t.colors.accent }}
                        />
                        <div
                          className="w-4/5 h-1 rounded-sm opacity-50"
                          style={{ backgroundColor: t.colors.textMuted }}
                        />
                        <div
                          className="w-3/5 h-1 rounded-sm opacity-50"
                          style={{ backgroundColor: t.colors.textMuted }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Terminal Font Size
              </h3>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={8}
                  max={32}
                  value={config.defaultFontSize ?? 13}
                  onChange={(e) => {
                    const size = Math.min(32, Math.max(8, parseInt(e.target.value, 10) || 13));
                    onConfigChange({ ...config, defaultFontSize: size });
                  }}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground">
                  Default: 13px (range: 8-32)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Use Cmd+Plus/Minus in a terminal to adjust individual panes. Per-pane sizes are remembered.
              </p>
            </div>

            <div className="mb-6">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Scrollback Buffer
              </h3>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={config.defaultScrollback ?? 10000}
                  onChange={(e) => {
                    const size = Math.min(100000, Math.max(1000, parseInt(e.target.value, 10) || 10000));
                    onConfigChange({ ...config, defaultScrollback: size });
                  }}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">
                  Default: 10,000 lines (range: 1k-100k)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Lines kept in terminal history. Higher values use more memory (~7MB per 10k lines per terminal).
              </p>
            </div>

            {appVersion && (
              <div className="pt-4 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  aTerm v{appVersion}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="profiles" className="flex-1 overflow-auto mt-4">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Terminal Profiles
                </h3>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={handleImportClick}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Import iTerm2
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() =>
                      setEditingProfile({
                        id: crypto.randomUUID(),
                        name: "",
                        command: "",
                        color: "#888888",
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </div>
              </div>

              {importError && (
                <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-[11px] text-destructive">
                  {importError}
                </div>
              )}

              {editingProfile ? (
                <ProfileEditor
                  profile={editingProfile}
                  onSave={handleProfileSave}
                  onCancel={() => setEditingProfile(null)}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {config.profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex justify-between items-center px-3 py-2.5 bg-muted rounded-md border border-border"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: profile.color }}
                        />
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {profile.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {profile.command || "Default shell"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setEditingProfile(profile)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-6 w-6"
                          onClick={() => handleProfileDelete(profile.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="layouts" className="flex-1 overflow-auto mt-4">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Window Layouts
                </h3>
                <Button
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() =>
                    setEditingLayout({
                      id: crypto.randomUUID(),
                      name: "",
                      rows: [
                        {
                          id: crypto.randomUUID(),
                          flex: 1,
                          panes: [
                            { id: crypto.randomUUID(), profileId: "shell", flex: 1 },
                          ],
                        },
                      ],
                    })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>

              {editingLayout ? (
                <LayoutEditor
                  layout={editingLayout}
                  profiles={config.profiles}
                  onSave={handleLayoutSave}
                  onCancel={() => setEditingLayout(null)}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {config.layouts.map((layout) => (
                    <div
                      key={layout.id}
                      className="flex justify-between items-center px-3 py-2.5 bg-muted rounded-md border border-border"
                    >
                      <div className="flex items-center gap-2.5">
                        <LayoutPreview layout={layout} profiles={config.profiles} />
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {layout.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {layout.rows.reduce((acc, r) => acc + r.panes.length, 0)} panes
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setEditingLayout(layout)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-6 w-6"
                          onClick={() => handleLayoutDelete(layout.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* iTerm2 Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-[400px] max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import iTerm2 Profiles</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <p className="text-xs text-muted-foreground mb-3">
              Select profiles to import ({selectedImports.size} of {itermProfiles.length} selected)
            </p>

            <div className="flex flex-col gap-1.5">
              {itermProfiles.map((profile) => (
                <label
                  key={profile.guid}
                  className="flex items-center gap-2.5 px-3 py-2 bg-muted rounded-md border border-border cursor-pointer hover:border-muted-foreground/30"
                >
                  <Checkbox
                    checked={selectedImports.has(profile.guid)}
                    onCheckedChange={() => toggleImport(profile.guid)}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: stringToColor(profile.guid) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">
                      {profile.name}
                    </div>
                    {profile.command && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {profile.command}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-border">
            <div className="flex gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-6 px-0 text-[11px]"
                onClick={() => setSelectedImports(new Set(itermProfiles.map(p => p.guid)))}
              >
                Select all
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-6 px-0 text-[11px]"
                onClick={() => setSelectedImports(new Set())}
              >
                Select none
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImportConfirm}
                disabled={selectedImports.size === 0}
              >
                Import {selectedImports.size}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: TerminalProfile;
  onSave: (p: TerminalProfile) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [command, setCommand] = useState(profile.command || "");
  const [color, setColor] = useState(profile.color);
  const [scrollback, setScrollback] = useState<string>(
    profile.scrollback?.toString() || ""
  );

  function handleSave() {
    if (!name.trim()) return;
    const scrollbackNum = scrollback ? parseInt(scrollback, 10) : undefined;
    onSave({
      ...profile,
      name: name.trim(),
      command: command.trim() || undefined,
      color,
      scrollback: scrollbackNum && scrollbackNum >= 1000 ? scrollbackNum : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3.5 p-4 bg-muted rounded-lg border border-border">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Name
        </span>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Dev Server"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Command (optional)
        </span>
        <Input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="e.g., npm run dev"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Color
        </span>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 p-0 border-none rounded cursor-pointer"
          />
          <Input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="flex-1"
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Scrollback (optional)
        </span>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={1000}
            max={100000}
            step={1000}
            value={scrollback}
            onChange={(e) => setScrollback(e.target.value)}
            placeholder="Use default"
            className="w-28"
          />
          <span className="text-[10px] text-muted-foreground">
            Override global scrollback for this profile
          </span>
        </div>
      </label>

      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

function LayoutEditor({
  layout,
  profiles,
  onSave,
  onCancel,
}: {
  layout: Layout;
  profiles: TerminalProfile[];
  onSave: (l: Layout) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(layout.name);
  const [rows, setRows] = useState(layout.rows);

  function handleSave() {
    if (!name.trim()) return;
    onSave({ ...layout, name: name.trim(), rows });
  }

  function addRow() {
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        flex: 1,
        panes: [{ id: crypto.randomUUID(), profileId: "shell", flex: 1 }],
      },
    ]);
  }

  function addPane(rowId: string) {
    setRows(
      rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              panes: [
                ...r.panes,
                { id: crypto.randomUUID(), profileId: "shell", flex: 1 },
              ],
            }
          : r
      )
    );
  }

  function removePane(rowId: string, paneId: string) {
    setRows(
      rows
        .map((r) =>
          r.id === rowId
            ? { ...r, panes: r.panes.filter((p) => p.id !== paneId) }
            : r
        )
        .filter((r) => r.panes.length > 0)
    );
  }

  function updatePaneProfile(rowId: string, paneId: string, profileId: string) {
    setRows(
      rows.map((r) =>
        r.id === rowId
          ? {
              ...r,
              panes: r.panes.map((p) =>
                p.id === paneId ? { ...p, profileId } : p
              ),
            }
          : r
      )
    );
  }

  return (
    <div className="flex flex-col gap-3.5 p-4 bg-muted rounded-lg border border-border">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Name
        </span>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., AI + Dev + Shell"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Pane Configuration
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px]"
            onClick={addRow}
          >
            <Plus className="h-3 w-3 mr-1" />
            Row
          </Button>
        </div>

        {rows.map((row, rowIndex) => (
          <div
            key={row.id}
            className="p-2.5 bg-background rounded border border-border"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-muted-foreground font-medium">
                Row {rowIndex + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-5 text-[10px] px-2"
                onClick={() => addPane(row.id)}
              >
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Pane
              </Button>
            </div>
            <div className="flex gap-1.5">
              {row.panes.map((pane) => (
                <div key={pane.id} className="flex-1 flex gap-1">
                  <Select
                    value={pane.profileId}
                    onValueChange={(v) => updatePaneProfile(row.id, pane.id, v)}
                  >
                    <SelectTrigger className="flex-1 h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {row.panes.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-6"
                      onClick={() => removePane(row.id, pane.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

function LayoutPreview({
  layout,
  profiles,
}: {
  layout: Layout;
  profiles: TerminalProfile[];
}) {
  return (
    <div className="w-9 h-6 flex flex-col gap-px bg-background rounded-sm overflow-hidden shrink-0">
      {layout.rows.map((row) => (
        <div key={row.id} className="flex gap-px" style={{ flex: row.flex }}>
          {row.panes.map((pane) => {
            const profile = profiles.find((p) => p.id === pane.profileId);
            return (
              <div
                key={pane.id}
                className="min-h-1 opacity-80"
                style={{
                  flex: pane.flex,
                  backgroundColor: profile?.color || "#888",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
