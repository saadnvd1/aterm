import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProviderId } from "../lib/providers";
import { createProject, ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";
import type { SSHConnection } from "../lib/ssh";
import { DirectoryBrowser, ProjectFormFields, RemoteExecutionSection, DirEntry } from "./add-project";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProjectAdded: (project: ProjectConfig) => void;
  layouts: Layout[];
  profiles: TerminalProfile[];
  sshConnections: SSHConnection[];
}

export function AddProjectModal({ isOpen, onClose, onProjectAdded, layouts, profiles, sshConnections }: Props) {
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
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [sshConnectionId, setSshConnectionId] = useState<string>("");
  const [remoteProjectPath, setRemoteProjectPath] = useState("");
  const [validatingPath, setValidatingPath] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);

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
      const folderName = path.split("/").pop() || "project";
      setProjectName(folderName);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleEntryClick(entry: DirEntry) {
    if (entry.isDir) {
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

      const project = createProject(projectName, currentPath, provider, {
        gitRemote: gitRemote || undefined,
        layoutId,
        skipPermissions,
        sshConnectionId: sshConnectionId || undefined,
        remoteProjectPath: remoteProjectPath || undefined,
      });

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

      const project = createProject(repoName, destination, provider, {
        gitRemote: cloneUrl,
        layoutId,
        skipPermissions,
        sshConnectionId: sshConnectionId || undefined,
        remoteProjectPath: remoteProjectPath || undefined,
      });

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
    setRemoteOpen(false);
    setSshConnectionId("");
    setRemoteProjectPath("");
    setValidatingPath(false);
    setPathValid(null);
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
            <DirectoryBrowser
              currentPath={currentPath}
              pathInput={pathInput}
              onPathInputChange={setPathInput}
              onPathSubmit={handlePathSubmit}
              onGoUp={goUp}
              entries={entries}
              folderSearch={folderSearch}
              onFolderSearchChange={setFolderSearch}
              onEntryClick={handleEntryClick}
            />
            <ProjectFormFields
              projectName={projectName}
              onProjectNameChange={setProjectName}
              provider={provider}
              onProviderChange={setProvider}
              layoutId={layoutId}
              onLayoutIdChange={setLayoutId}
              layouts={layouts}
              profiles={profiles}
              advancedOpen={advancedOpen}
              onAdvancedOpenChange={setAdvancedOpen}
              skipPermissions={skipPermissions}
              onSkipPermissionsChange={setSkipPermissions}
            />
            <RemoteExecutionSection
              sshConnections={sshConnections}
              sshConnectionId={sshConnectionId}
              onConnectionChange={setSshConnectionId}
              remoteProjectPath={remoteProjectPath}
              onRemotePathChange={setRemoteProjectPath}
              remoteOpen={remoteOpen}
              onRemoteOpenChange={setRemoteOpen}
              validatingPath={validatingPath}
              pathValid={pathValid}
              onValidatePath={validateRemotePath}
              className="mt-3.5"
            />
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

              <ProjectFormFields
                projectName={projectName}
                onProjectNameChange={setProjectName}
                provider={provider}
                onProviderChange={setProvider}
                layoutId={layoutId}
                onLayoutIdChange={setLayoutId}
                layouts={layouts}
                profiles={profiles}
                advancedOpen={advancedOpen}
                onAdvancedOpenChange={setAdvancedOpen}
                skipPermissions={skipPermissions}
                onSkipPermissionsChange={setSkipPermissions}
                showNameField={false}
              />
              <RemoteExecutionSection
                sshConnections={sshConnections}
                sshConnectionId={sshConnectionId}
                onConnectionChange={setSshConnectionId}
                remoteProjectPath={remoteProjectPath}
                onRemotePathChange={setRemoteProjectPath}
                remoteOpen={remoteOpen}
                onRemoteOpenChange={setRemoteOpen}
                validatingPath={validatingPath}
                pathValid={pathValid}
                onValidatePath={validateRemotePath}
                className="mt-3.5"
              />
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
