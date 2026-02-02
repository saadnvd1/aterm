import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, GitBranch } from "lucide-react";
import type { ProjectConfig, AppConfig } from "../lib/config";
import { PROVIDERS } from "../lib/providers";
import { AddProjectModal } from "./AddProjectModal";
import { SettingsModal } from "./SettingsModal";
import { ProjectSettingsModal } from "./ProjectSettingsModal";

interface Props {
  config: AppConfig;
  selectedProject: ProjectConfig | null;
  onSelectProject: (project: ProjectConfig | null) => void;
  onConfigChange: (config: AppConfig) => void;
  onSaveWindowArrangement: (projectId: string) => void;
  onRestoreWindowArrangement: (projectId: string) => void;
  onAddGitPane: () => void;
}

export function ProjectSidebar({
  config,
  selectedProject,
  onSelectProject,
  onConfigChange,
  onSaveWindowArrangement,
  onRestoreWindowArrangement,
  onAddGitPane,
}: Props) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    project: ProjectConfig;
    x: number;
    y: number;
  } | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectConfig | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(config.projects, {
        keys: ["name", "path"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [config.projects]
  );

  const filtered = search.trim()
    ? fuse.search(search).map((result) => result.item)
    : config.projects;

  function handleProjectAdded(project: ProjectConfig) {
    onConfigChange({
      ...config,
      projects: [...config.projects, project],
    });
    onSelectProject(project);
  }

  function handleRemoveProject(projectId: string) {
    const newProjects = config.projects.filter((p) => p.id !== projectId);
    onConfigChange({ ...config, projects: newProjects });
    if (selectedProject?.id === projectId) {
      onSelectProject(newProjects[0] || null);
    }
    setContextMenu(null);
  }

  function handleProjectSave(updatedProject: ProjectConfig) {
    const newProjects = config.projects.map((p) =>
      p.id === updatedProject.id ? updatedProject : p
    );
    onConfigChange({ ...config, projects: newProjects });
    setEditingProject(null);
  }

  function handleContextMenu(e: React.MouseEvent, project: ProjectConfig) {
    e.preventDefault();
    setContextMenu({ project, x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <div className="w-[220px] bg-secondary border-r border-border flex flex-col">
        <div className="px-4 py-3.5 flex justify-between items-center border-b border-border">
          {import.meta.env.DEV ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 uppercase tracking-wide">
              Dev
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onAddGitPane}
              title="Open Git Panel"
              disabled={!selectedProject}
            >
              <GitBranch className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowAddModal(true)}
              title="Add Project"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-3">
          <Input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {filtered.length === 0 ? (
            <div className="py-5 px-3 text-muted-foreground text-xs text-center">
              {config.projects.length === 0
                ? "No projects yet"
                : "No matches"}
            </div>
          ) : (
            filtered.map((project) => {
              const layout = config.layouts.find((l) => l.id === project.layoutId);
              return (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  onContextMenu={(e) => handleContextMenu(e, project)}
                  className={cn(
                    "w-full px-3 py-2.5 flex items-center gap-2.5 bg-transparent border-none rounded-md text-foreground cursor-pointer text-left mb-0.5 transition-colors hover:bg-accent",
                    selectedProject?.id === project.id && "bg-accent"
                  )}
                >
                  {project.icon ? (
                    <span className="text-base shrink-0">{project.icon}</span>
                  ) : project.color ? (
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                  ) : null}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                      {project.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {PROVIDERS[project.provider]?.name || project.provider}
                      {layout && ` · ${layout.name}`}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-popover"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed bg-popover border border-border rounded-md shadow-lg z-modal min-w-[120px] p-1 animate-popover-in"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className="w-full px-3 py-2 bg-transparent border-none rounded text-foreground text-xs cursor-pointer text-left transition-colors hover:bg-accent"
              onClick={() => {
                setEditingProject(contextMenu.project);
                setContextMenu(null);
              }}
            >
              Project Settings...
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="w-full px-3 py-2 bg-transparent border-none rounded text-foreground text-xs cursor-pointer text-left transition-colors hover:bg-accent"
              onClick={() => {
                onSaveWindowArrangement(contextMenu.project.id);
                setContextMenu(null);
              }}
            >
              Save Window Arrangement
            </button>
            <button
              className="w-full px-3 py-2 bg-transparent border-none rounded text-foreground text-xs cursor-pointer text-left transition-colors hover:bg-accent"
              onClick={() => {
                onRestoreWindowArrangement(contextMenu.project.id);
                setContextMenu(null);
              }}
            >
              Restore Window Arrangement
            </button>
            <div className="h-px bg-border my-1" />
            <button
              className="w-full px-3 py-2 bg-transparent border-none rounded text-destructive text-xs cursor-pointer text-left transition-colors hover:bg-destructive/10"
              onClick={() => handleRemoveProject(contextMenu.project.id)}
            >
              Remove Project
            </button>
          </div>
        </>
      )}

      <AddProjectModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProjectAdded={handleProjectAdded}
        layouts={config.layouts}
        profiles={config.profiles}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onConfigChange={onConfigChange}
      />

      {editingProject && (
        <ProjectSettingsModal
          isOpen={true}
          onClose={() => setEditingProject(null)}
          project={editingProject}
          layouts={config.layouts}
          onSave={handleProjectSave}
        />
      )}
    </>
  );
}
