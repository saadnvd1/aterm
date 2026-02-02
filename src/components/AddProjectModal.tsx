import { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChevronUp, ChevronRight, Folder, GitBranch, Circle, Search } from "lucide-react";
import { ProviderId, getProviderList, PROVIDERS } from "../lib/providers";
import { createProject, ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  isGitRepo: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (project: ProjectConfig) => void;
  layouts: Layout[];
  profiles: TerminalProfile[];
}

function LayoutPreview({ layout, profiles }: { layout: Layout; profiles: TerminalProfile[] }) {
  return (
    <div className="w-12 h-8 flex flex-col gap-px bg-background rounded-sm overflow-hidden shrink-0 border border-border">
      {layout.rows.map((row) => (
        <div key={row.id} className="flex gap-px" style={{ flex: row.flex }}>
          {row.panes.map((pane) => {
            const profile = profiles.find((p) => p.id === pane.profileId);
            return (
              <div
                key={pane.id}
                className="min-h-1 opacity-80"
                style={{ flex: pane.flex, backgroundColor: profile?.color || "#888" }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function AddProjectModal({ isOpen, onClose, onProjectAdded, layouts, profiles }: Props) {
  const [mode, setMode] = useState<"browse" | "clone">("browse");
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [projectName, setProjectName] = useState("");
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [layoutId, setLayoutId] = useState(layouts[0]?.id || "ai-shell");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneDestination, setCloneDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderSearch, setFolderSearch] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);

  const providers = getProviderList();

  // Sync pathInput with currentPath
  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  function handlePathSubmit() {
    if (pathInput.trim()) {
      loadDirectory(pathInput.trim());
      setFolderSearch("");
    }
  }

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: ["name"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [entries]
  );

  const filteredEntries = folderSearch.trim()
    ? fuse.search(folderSearch).map((result) => result.item)
    : entries;

  useEffect(() => {
    if (isOpen) {
      invoke<string>("get_home_dir").then((home) => {
        const devDir = `${home}/dev`;
        setCurrentPath(devDir);
        setCloneDestination(devDir);
        loadDirectory(devDir);
      });
    }
  }, [isOpen]);

  async function loadDirectory(path: string) {
    try {
      const result = await invoke<DirEntry[]>("list_directory", { path });
      setEntries(result);
      setCurrentPath(path);
      // Auto-set project name from folder name
      const folderName = path.split("/").pop() || "project";
      setProjectName(folderName);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleEntryClick(entry: DirEntry) {
    if (entry.isDir) {
      // Single click navigates into the folder
      loadDirectory(entry.path);
      setFolderSearch("");
    }
  }

  function goUp() {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadDirectory(parent);
    setFolderSearch("");
  }

  async function handleAddProject() {
    if (!currentPath || !projectName) return;

    setLoading(true);
    try {
      const gitRemote = await invoke<string | null>("get_git_remote", {
        path: currentPath,
      });

      const project = createProject(
        projectName,
        currentPath,
        provider,
        gitRemote || undefined,
        layoutId,
        skipPermissions
      );

      onProjectAdded(project);
      onClose();
      resetForm();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleCloneProject() {
    if (!cloneUrl) return;

    setLoading(true);
    setError(null);

    try {
      const repoName =
        projectName ||
        cloneUrl.split("/").pop()?.replace(".git", "") ||
        "project";
      const destination = `${cloneDestination}/${repoName}`;

      await invoke("clone_repo", { url: cloneUrl, destination });

      const project = createProject(repoName, destination, provider, cloneUrl, layoutId, skipPermissions);

      onProjectAdded(project);
      onClose();
      resetForm();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setProjectName("");
    setProvider("claude");
    setLayoutId(layouts[0]?.id || "ai-shell");
    setCloneUrl("");
    setError(null);
    setMode("browse");
    setFolderSearch("");
    setPathInput("");
    setAdvancedOpen(false);
    setSkipPermissions(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[520px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "browse" | "clone")} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="clone">Clone</TabsTrigger>
          </TabsList>

          {error && (
            <div className="mt-3 px-4 py-2.5 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs">
              {error}
            </div>
          )}

          <TabsContent value="browse" className="flex-1 overflow-auto mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={goUp}
                title="Go up"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePathSubmit()}
                onBlur={handlePathSubmit}
                className="flex-1 h-8 text-xs font-mono"
                placeholder="/path/to/directory"
              />
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search folders..."
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="max-h-[180px] overflow-auto border border-border rounded-md mb-4">
              {filteredEntries.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {folderSearch ? "No matching folders" : "No folders"}
                </div>
              ) : filteredEntries.map((entry) => (
                <button
                  key={entry.path}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 bg-transparent border-none border-b border-border text-foreground cursor-pointer text-left text-xs transition-colors hover:bg-accent last:border-b-0",
                    !entry.isDir && "opacity-40 cursor-default"
                  )}
                  onClick={() => handleEntryClick(entry)}
                  disabled={!entry.isDir}
                >
                  <span className="text-[10px] text-primary w-3.5">
                    {entry.isGitRepo ? (
                      <GitBranch className="h-3 w-3" />
                    ) : entry.isDir ? (
                      <Folder className="h-3 w-3" />
                    ) : (
                      <Circle className="h-2 w-2" />
                    )}
                  </span>
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {entry.name}
                  </span>
                  {entry.isGitRepo && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-muted border border-border rounded text-green-500 uppercase tracking-wider">
                      git
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </span>
                  <Input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Provider
                  </span>
                  <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Layout
                  </span>
                  <div className="flex items-center gap-2">
                    <Select value={layoutId} onValueChange={setLayoutId}>
                      <SelectTrigger className="flex-1">
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
                    {layouts.find((l) => l.id === layoutId) && (
                      <LayoutPreview
                        layout={layouts.find((l) => l.id === layoutId)!}
                        profiles={profiles}
                      />
                    )}
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="border border-border rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-90")}
                    />
                    Advanced Settings
                  </button>
                  {advancedOpen && (
                    <div className="border-t border-border px-3 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="skipPermissions-browse"
                          checked={skipPermissions}
                          onChange={(e) => setSkipPermissions(e.target.checked)}
                          className="h-4 w-4 rounded border-border bg-background accent-primary"
                        />
                        <label htmlFor="skipPermissions-browse" className="cursor-pointer text-sm">
                          Auto-approve tool calls
                          <span className="ml-1 text-muted-foreground">
                            {PROVIDERS[provider].autoApproveFlag
                              ? `(${PROVIDERS[provider].autoApproveFlag})`
                              : "(not supported)"}
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          </TabsContent>

          <TabsContent value="clone" className="flex-1 overflow-auto mt-4">
            <div className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Repository URL
                </span>
                <Input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Name (optional)
                </span>
                <Input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Auto-detected from URL"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Destination
                </span>
                <Input
                  type="text"
                  value={cloneDestination}
                  onChange={(e) => setCloneDestination(e.target.value)}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Provider
                </span>
                <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Layout
                </span>
                <div className="flex items-center gap-2">
                  <Select value={layoutId} onValueChange={setLayoutId}>
                    <SelectTrigger className="flex-1">
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
                  {layouts.find((l) => l.id === layoutId) && (
                    <LayoutPreview
                      layout={layouts.find((l) => l.id === layoutId)!}
                      profiles={profiles}
                    />
                  )}
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="border border-border rounded-lg">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight
                    className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-90")}
                  />
                  Advanced Settings
                </button>
                {advancedOpen && (
                  <div className="border-t border-border px-3 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="skipPermissions-clone"
                        checked={skipPermissions}
                        onChange={(e) => setSkipPermissions(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-background accent-primary"
                      />
                      <label htmlFor="skipPermissions-clone" className="cursor-pointer text-sm">
                        Auto-approve tool calls
                        <span className="ml-1 text-muted-foreground">
                          {PROVIDERS[provider].autoApproveFlag
                            ? `(${PROVIDERS[provider].autoApproveFlag})`
                            : "(not supported)"}
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={mode === "browse" ? handleAddProject : handleCloneProject}
            disabled={loading || (mode === "browse" ? !currentPath : !cloneUrl)}
          >
            {loading ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
