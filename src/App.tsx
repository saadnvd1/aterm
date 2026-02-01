import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TerminalLayout } from "./components/TerminalLayout";
import type { ProjectConfig, AppConfig } from "./lib/config";

export default function App() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await invoke<AppConfig>("load_config");
      setProjects(config.projects);
      if (config.projects.length > 0 && !selectedProject) {
        setSelectedProject(config.projects[0]);
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleProjectsChange(newProjects: ProjectConfig[]) {
    setProjects(newProjects);
  }

  function handleSelectProject(project: ProjectConfig | null) {
    setSelectedProject(project);
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <span style={styles.loadingText}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <ProjectSidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onProjectsChange={handleProjectsChange}
      />
      <div style={styles.main}>
        {selectedProject ? (
          <TerminalLayout key={selectedProject.id} project={selectedProject} />
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyContent}>
              <div style={styles.emptyIcon}>⚡</div>
              <h2 style={styles.emptyTitle}>Welcome to aTerm</h2>
              <p style={styles.emptyText}>
                Add a project to start your AI-powered terminal workspace
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    height: "100%",
    width: "100%",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "var(--bg)",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    backgroundColor: "var(--bg)",
  },
  loadingText: {
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  empty: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContent: {
    textAlign: "center",
    maxWidth: "320px",
    padding: "40px",
  },
  emptyIcon: {
    fontSize: "40px",
    marginBottom: "16px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: "8px",
  },
  emptyText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
};
