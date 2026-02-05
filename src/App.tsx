import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TerminalLayout } from "./components/TerminalLayout";
import { ExitConfirmDialog } from "./components/ExitConfirmDialog";
import { StatusBar } from "./components/StatusBar";
import { CreateTaskModal } from "./components/CreateTaskModal";
import { TaskView } from "./components/TaskView";
import { FileSearchModal } from "./components/editor/FileSearchModal";
import { useConfig, useTasks, useLayouts, useKeyboardShortcuts, useTransientTerminals } from "./hooks";
import { useDetachedWindows } from "./hooks/useDetachedWindows";
import { NewTerminalModal } from "./components/NewTerminalModal";
import { TransientTerminalView } from "./components/TransientTerminalView";
import type { ProjectConfig } from "./lib/config";
import appIcon from "./assets/icon.png";

export default function App() {
  const {
    config,
    updateConfig,
    selectedProject,
    setSelectedProject,
    handleSelectProject: baseHandleSelectProject,
    loading,
    sidebarVisible,
    setSidebarVisible,
    handlePaneFontSizeChange,
  } = useConfig();

  const {
    selectedTask,
    setSelectedTask,
    taskLayouts,
    taskPaneFontSizes,
    getTaskProviderProfile,
    handleSelectTask,
    handleTaskCreated,
    handleDeleteTask,
    handleTaskPromptInjected,
    handleTaskPaneFontSizeChange,
    handleAddGitPaneToTask,
    handleTaskLayoutChange,
    cleanupRemovedProjectTasks,
  } = useTasks({
    config,
    updateConfig,
    selectedProject,
    setSelectedProject,
  });

  const {
    openedProjects,
    runtimeLayouts,
    handleRuntimeLayoutChange,
    handlePersistentLayoutChange,
    handleSaveWindowArrangement,
    handleRestoreWindowArrangement,
    handleAddGitPane,
    handleAddEditorPane,
    ensureEditorPane,
    cleanupRemovedProjects,
  } = useLayouts({ config, updateConfig, selectedProject });

  const { detachPane, detachProject } = useDetachedWindows();

  const {
    terminals: transientTerminals,
    selectedTerminalId,
    createTerminal,
    selectTerminal,
    closeTerminal,
    deselectTerminal,
  } = useTransientTerminals();

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [activePtyCount, setActivePtyCount] = useState(0);
  const [createTaskProject, setCreateTaskProject] = useState<ProjectConfig | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [pendingFileToOpen, setPendingFileToOpen] = useState<string | null>(null);
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [homeDir, setHomeDir] = useState<string>("");

  // Wrap handleSelectProject to also clear selectedTask and deselect terminal
  const handleSelectProject = useCallback((project: ProjectConfig | null) => {
    baseHandleSelectProject(project);
    setSelectedTask(null);
    deselectTerminal();
  }, [baseHandleSelectProject, setSelectedTask, deselectTerminal]);

  // Wrap selectTerminal to also clear project/task selection
  const handleSelectTerminal = useCallback((id: string) => {
    selectTerminal(id);
    setSelectedProject(null);
    setSelectedTask(null);
  }, [selectTerminal, setSelectedProject, setSelectedTask]);

  useKeyboardShortcuts({
    projects: config.projects,
    selectedProject,
    onSelectProject: handleSelectProject,
    onToggleSidebar: () => setSidebarVisible((prev) => !prev),
    onOpenScratchNotes: () => setShowNotesModal(true),
    onAddEditorPane: handleAddEditorPane,
    onAddGitPane: handleAddGitPane,
    onOpenFileSearch: () => setShowFileSearch(true),
    onOpenNewTerminalModal: () => setShowNewTerminalModal(true),
  });

  // Handler for detaching panes to separate windows
  const handleDetachPane = useCallback(
    (project: ProjectConfig, paneId: string, layout: import("./lib/layouts").Layout) => {
      const pane = layout.rows.flatMap((r) => r.panes).find((p) => p.id === paneId);
      if (!pane) return;

      const profile = config.profiles.find((p) => p.id === pane.profileId);
      if (!profile) return;

      const terminalId = `${project.id}-${paneId}`;
      detachPane(paneId, terminalId, project, profile);
    },
    [config.profiles, detachPane]
  );

  // Handler for detaching entire projects to separate windows
  const handleDetachProject = useCallback(
    (project: ProjectConfig) => {
      const layout = runtimeLayouts[project.id];
      if (!layout) return;

      detachProject(
        project,
        layout,
        config.profiles,
        config.defaultFontSize ?? 13,
        config.defaultScrollback ?? 10000
      );
    },
    [config.profiles, config.defaultFontSize, config.defaultScrollback, detachProject, runtimeLayouts]
  );

  // Set window title in dev mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      getCurrentWindow().setTitle("aTerm [DEV]");
    }
  }, []);

  // Get home directory for new terminal modal
  useEffect(() => {
    invoke<string>("get_home_dir").then(setHomeDir).catch(console.error);
  }, []);

  // Listen for exit request
  useEffect(() => {
    const unlisten = listen("exit-requested", async () => {
      const count = await invoke<number>("get_active_pty_count");
      setActivePtyCount(count);
      setShowExitDialog(true);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen for close-pane event (Cmd+W) to close selected transient terminal
  useEffect(() => {
    if (!selectedTerminalId) return;

    const unlisten = listen("close-pane", () => {
      closeTerminal(selectedTerminalId);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [selectedTerminalId, closeTerminal]);

  async function handleExitConfirm() {
    await invoke("force_exit");
  }

  function handleOpenGitFromStatusBar() {
    if (selectedTask && selectedProject) {
      handleAddGitPaneToTask(selectedTask);
      return;
    }
    handleAddGitPane();
  }

  function handleConfigChange(newConfig: typeof config) {
    const projectIds = new Set(newConfig.projects.map((p) => p.id));
    const removedProjects = config.projects.filter((p) => !projectIds.has(p.id));

    if (removedProjects.length > 0) {
      cleanupRemovedProjectTasks(removedProjects);
    }
    cleanupRemovedProjects(projectIds);

    // Update selected project/task if removed
    const updatedSelectedProject = selectedProject
      ? newConfig.projects.find((p) => p.id === selectedProject.id) || null
      : null;
    if (selectedProject && !updatedSelectedProject) {
      setSelectedProject(newConfig.projects[0] || null);
    } else if (updatedSelectedProject && updatedSelectedProject !== selectedProject) {
      setSelectedProject(updatedSelectedProject);
    }

    if (selectedTask) {
      const updatedTaskProject = newConfig.projects.find((p) => p.id === selectedTask.projectId);
      const updatedTask = updatedTaskProject?.tasks?.find((t) => t.id === selectedTask.id);
      if (!updatedTask) {
        setSelectedTask(null);
      } else if (updatedTask !== selectedTask) {
        setSelectedTask(updatedTask);
      }
    }

    updateConfig(newConfig);
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <span style={styles.loadingText}>Loading...</span>
      </div>
    );
  }

  const openedProjectsList = config.projects.filter((p) => openedProjects.has(p.id));

  return (
    <div style={styles.container}>
      <ExitConfirmDialog
        isOpen={showExitDialog}
        activePtyCount={activePtyCount}
        onConfirm={handleExitConfirm}
        onCancel={() => setShowExitDialog(false)}
      />
      <div style={styles.mainArea}>
        {sidebarVisible && (
          <ProjectSidebar
            config={config}
            selectedProject={selectedProject}
            selectedTaskId={selectedTask?.id || null}
            onSelectProject={handleSelectProject}
            onSelectTask={handleSelectTask}
            onConfigChange={handleConfigChange}
            onSaveWindowArrangement={handleSaveWindowArrangement}
            onRestoreWindowArrangement={handleRestoreWindowArrangement}
            onAddGitPane={handleAddGitPane}
            onAddEditorPane={handleAddEditorPane}
            onCreateTask={(project) => setCreateTaskProject(project)}
            onDeleteTask={handleDeleteTask}
            onDetachProject={handleDetachProject}
            showNotesModal={showNotesModal}
            onShowNotesModalChange={setShowNotesModal}
            transientTerminals={transientTerminals}
            selectedTerminalId={selectedTerminalId}
            onSelectTerminal={handleSelectTerminal}
            onCloseTerminal={closeTerminal}
          />
        )}
        <div style={styles.main}>
          {/* Transient terminal view */}
          {selectedTerminalId && (() => {
            const terminal = transientTerminals.find((t) => t.id === selectedTerminalId);
            if (!terminal) return null;
            return (
              <TransientTerminalView
                terminal={terminal}
                defaultFontSize={config.defaultFontSize ?? 13}
                defaultScrollback={config.defaultScrollback ?? 10000}
                onClose={() => closeTerminal(terminal.id)}
              />
            );
          })()}

          {/* Task view */}
          {!selectedTerminalId && selectedTask && selectedProject && (
            <TaskViewContainer
              selectedProject={selectedProject}
              selectedTask={selectedTask}
              taskLayouts={taskLayouts}
              taskPaneFontSizes={taskPaneFontSizes}
              config={config}
              getTaskProviderProfile={getTaskProviderProfile}
              handleTaskPaneFontSizeChange={handleTaskPaneFontSizeChange}
              handleTaskLayoutChange={handleTaskLayoutChange}
              handleTaskPromptInjected={handleTaskPromptInjected}
            />
          )}

          {/* Project terminals - always render opened ones, hide inactive */}
          {!selectedTerminalId && openedProjectsList.map((project) => {
            const savedLayout = config.layouts.find((l) => l.id === project.layoutId) || config.layouts[0];
            const layout = runtimeLayouts[project.id] || savedLayout;
            const isActive = selectedProject?.id === project.id && !selectedTask;

            return (
              <div
                key={project.id}
                style={{ ...styles.terminalContainer, display: isActive ? "flex" : "none" }}
              >
                <TerminalLayout
                  project={project}
                  layout={layout}
                  profiles={config.profiles}
                  defaultFontSize={config.defaultFontSize ?? 13}
                  defaultScrollback={config.defaultScrollback ?? 10000}
                  paneFontSizes={config.paneFontSizes || {}}
                  onPaneFontSizeChange={handlePaneFontSizeChange}
                  onLayoutChange={(newLayout) => handleRuntimeLayoutChange(project.id, newLayout)}
                  onPersistentLayoutChange={(newLayout) => handlePersistentLayoutChange(project.id, newLayout)}
                  onDetachPane={(paneId) => handleDetachPane(project, paneId, layout)}
                  isProjectActive={isActive}
                  pendingFileToOpen={isActive ? pendingFileToOpen : null}
                  onPendingFileOpened={() => setPendingFileToOpen(null)}
                />
              </div>
            );
          })}

          {/* Empty state - show when no terminal, no task, and no active project */}
          {!selectedTerminalId && !selectedTask && openedProjectsList.length === 0 && (
            <div style={styles.empty}>
              <div style={styles.emptyContent}>
                <img src={appIcon} alt="aTerm" style={styles.emptyIcon} />
                <h2 style={styles.emptyTitle}>Welcome to aTerm</h2>
                <p style={styles.emptyText}>Add a project to start your AI-powered terminal workspace</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <CreateTaskModal
        isOpen={!!createTaskProject}
        project={createTaskProject}
        onClose={() => setCreateTaskProject(null)}
        onTaskCreated={handleTaskCreated}
      />
      <StatusBar
        selectedProject={selectedProject}
        selectedTask={selectedTask}
        onOpenGitPane={handleOpenGitFromStatusBar}
      />
      {/* Global file search modal */}
      {selectedProject && (
        <FileSearchModal
          isOpen={showFileSearch}
          projectRoot={selectedProject.path}
          onClose={() => setShowFileSearch(false)}
          onSelectFile={(filePath) => {
            ensureEditorPane();
            setPendingFileToOpen(filePath);
            setShowFileSearch(false);
          }}
        />
      )}
      {/* New terminal modal */}
      <NewTerminalModal
        isOpen={showNewTerminalModal}
        onClose={() => setShowNewTerminalModal(false)}
        onSelect={(cwd) => {
          createTerminal(cwd);
          setShowNewTerminalModal(false);
        }}
        currentProjectPath={selectedProject?.path || null}
        homeDir={homeDir}
      />
    </div>
  );
}

// Extracted to avoid complex inline logic
function TaskViewContainer({
  selectedProject,
  selectedTask,
  taskLayouts,
  taskPaneFontSizes,
  config,
  getTaskProviderProfile,
  handleTaskPaneFontSizeChange,
  handleTaskLayoutChange,
  handleTaskPromptInjected,
}: {
  selectedProject: ProjectConfig;
  selectedTask: NonNullable<ReturnType<typeof useTasks>["selectedTask"]>;
  taskLayouts: ReturnType<typeof useTasks>["taskLayouts"];
  taskPaneFontSizes: ReturnType<typeof useTasks>["taskPaneFontSizes"];
  config: ReturnType<typeof useConfig>["config"];
  getTaskProviderProfile: ReturnType<typeof useTasks>["getTaskProviderProfile"];
  handleTaskPaneFontSizeChange: ReturnType<typeof useTasks>["handleTaskPaneFontSizeChange"];
  handleTaskLayoutChange: ReturnType<typeof useTasks>["handleTaskLayoutChange"];
  handleTaskPromptInjected: ReturnType<typeof useTasks>["handleTaskPromptInjected"];
}) {
  const { profiles: taskProfiles } = getTaskProviderProfile(selectedProject);
  const taskLayout = taskLayouts[selectedTask.id];
  if (!taskLayout) return null;

  return (
    <TaskView
      project={selectedProject}
      task={selectedTask}
      layout={taskLayout}
      profiles={taskProfiles}
      defaultFontSize={config.defaultFontSize ?? 13}
      defaultScrollback={config.defaultScrollback ?? 10000}
      paneFontSizes={taskPaneFontSizes}
      onPaneFontSizeChange={handleTaskPaneFontSizeChange}
      onLayoutChange={(newLayout) => handleTaskLayoutChange(selectedTask.id, newLayout)}
      onPromptInjected={() => handleTaskPromptInjected(selectedTask.id)}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", height: "100%", width: "100%" },
  mainArea: { display: "flex", flex: 1, overflow: "hidden" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--bg)", position: "relative" },
  terminalContainer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "column" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100%", backgroundColor: "var(--bg)" },
  loadingText: { color: "var(--text-muted)", fontSize: "13px" },
  empty: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  emptyContent: { textAlign: "center", maxWidth: "320px", padding: "40px" },
  emptyIcon: { width: "80px", height: "80px", marginBottom: "16px", borderRadius: "16px", display: "block", marginLeft: "auto", marginRight: "auto" },
  emptyTitle: { fontSize: "18px", fontWeight: 600, color: "var(--text)", marginBottom: "8px" },
  emptyText: { fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 },
};
