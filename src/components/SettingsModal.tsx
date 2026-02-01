import { useTheme } from "../context/ThemeContext";
import { getThemeList } from "../lib/themes";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const { themeId, setThemeId, theme } = useTheme();
  const themes = getThemeList();

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Theme</h3>
            <div style={styles.themeGrid}>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  style={{
                    ...styles.themeCard,
                    ...(themeId === t.id ? styles.themeCardSelected : {}),
                  }}
                >
                  <div
                    style={{
                      ...styles.themePreview,
                      backgroundColor: t.colors.bg,
                    }}
                  >
                    <div
                      style={{
                        ...styles.previewSidebar,
                        backgroundColor: t.colors.bgSecondary,
                      }}
                    />
                    <div style={styles.previewMain}>
                      <div
                        style={{
                          ...styles.previewAccent,
                          backgroundColor: t.colors.accent,
                        }}
                      />
                      <div
                        style={{
                          ...styles.previewText,
                          backgroundColor: t.colors.textMuted,
                        }}
                      />
                      <div
                        style={{
                          ...styles.previewText,
                          backgroundColor: t.colors.textMuted,
                          width: "60%",
                        }}
                      />
                    </div>
                  </div>
                  <span style={styles.themeName}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>About</h3>
            <p style={styles.aboutText}>
              aTerm v0.1.0 — Agent-focused terminal workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    width: "500px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border-subtle)",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text)",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "20px",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "20px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "12px",
  },
  themeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  themeCard: {
    padding: "8px",
    backgroundColor: "var(--bg-tertiary)",
    border: "2px solid transparent",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.15s ease",
  },
  themeCardSelected: {
    borderColor: "var(--accent)",
  },
  themePreview: {
    width: "100%",
    height: "50px",
    borderRadius: "4px",
    display: "flex",
    overflow: "hidden",
  },
  previewSidebar: {
    width: "25%",
    height: "100%",
  },
  previewMain: {
    flex: 1,
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  previewAccent: {
    width: "40%",
    height: "6px",
    borderRadius: "2px",
  },
  previewText: {
    width: "80%",
    height: "4px",
    borderRadius: "2px",
    opacity: 0.5,
  },
  themeName: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  aboutText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
  },
};
