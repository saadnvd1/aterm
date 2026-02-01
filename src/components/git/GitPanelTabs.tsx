export type GitTab = "changes" | "history";

interface Props {
  activeTab: GitTab;
  onTabChange: (tab: GitTab) => void;
}

export function GitPanelTabs({ activeTab, onTabChange }: Props) {
  return (
    <div style={styles.container}>
      <button
        style={{
          ...styles.tab,
          ...(activeTab === "changes" ? styles.activeTab : {}),
        }}
        onClick={() => onTabChange("changes")}
      >
        Changes
      </button>
      <button
        style={{
          ...styles.tab,
          ...(activeTab === "history" ? styles.activeTab : {}),
        }}
        onClick={() => onTabChange("history")}
      >
        History
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    borderBottom: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-secondary)",
  },
  tab: {
    flex: 1,
    padding: "8px 16px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 0.1s, border-color 0.1s",
  },
  activeTab: {
    color: "var(--text)",
    borderBottomColor: "#f97316",
  },
};
