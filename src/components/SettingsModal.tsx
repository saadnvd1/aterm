import { useState } from "react";
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

type Tab = "appearance" | "profiles" | "layouts";

export function SettingsModal({ isOpen, onClose, config, onConfigChange }: Props) {
  const { themeId, setThemeId } = useTheme();
  const themes = getThemeList();
  const [activeTab, setActiveTab] = useState<Tab>("appearance");
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(null);
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null);

  if (!isOpen) return null;

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
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(activeTab === "appearance" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("appearance")}
          >
            Appearance
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "profiles" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("profiles")}
          >
            Profiles
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === "layouts" ? styles.tabActive : {}) }}
            onClick={() => setActiveTab("layouts")}
          >
            Layouts
          </button>
        </div>

        <div style={styles.content}>
          {activeTab === "appearance" && (
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
          )}

          {activeTab === "profiles" && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Terminal Profiles</h3>
                <button
                  style={styles.addButton}
                  onClick={() =>
                    setEditingProfile({
                      id: crypto.randomUUID(),
                      name: "",
                      command: "",
                      color: "#888888",
                    })
                  }
                >
                  + New
                </button>
              </div>

              {editingProfile ? (
                <ProfileEditor
                  profile={editingProfile}
                  onSave={handleProfileSave}
                  onCancel={() => setEditingProfile(null)}
                />
              ) : (
                <div style={styles.itemList}>
                  {config.profiles.map((profile) => (
                    <div key={profile.id} style={styles.item}>
                      <div style={styles.itemInfo}>
                        <span
                          style={{
                            ...styles.colorDot,
                            backgroundColor: profile.color,
                          }}
                        />
                        <div>
                          <div style={styles.itemName}>{profile.name}</div>
                          <div style={styles.itemMeta}>
                            {profile.command || "Default shell"}
                          </div>
                        </div>
                      </div>
                      <div style={styles.itemActions}>
                        <button
                          style={styles.iconBtn}
                          onClick={() => setEditingProfile(profile)}
                        >
                          Edit
                        </button>
                        <button
                          style={styles.iconBtn}
                          onClick={() => handleProfileDelete(profile.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "layouts" && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Window Layouts</h3>
                <button
                  style={styles.addButton}
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
                  + New
                </button>
              </div>

              {editingLayout ? (
                <LayoutEditor
                  layout={editingLayout}
                  profiles={config.profiles}
                  onSave={handleLayoutSave}
                  onCancel={() => setEditingLayout(null)}
                />
              ) : (
                <div style={styles.itemList}>
                  {config.layouts.map((layout) => (
                    <div key={layout.id} style={styles.item}>
                      <div style={styles.itemInfo}>
                        <LayoutPreview layout={layout} profiles={config.profiles} />
                        <div>
                          <div style={styles.itemName}>{layout.name}</div>
                          <div style={styles.itemMeta}>
                            {layout.rows.reduce((acc, r) => acc + r.panes.length, 0)} panes
                          </div>
                        </div>
                      </div>
                      <div style={styles.itemActions}>
                        <button
                          style={styles.iconBtn}
                          onClick={() => setEditingLayout(layout)}
                        >
                          Edit
                        </button>
                        <button
                          style={styles.iconBtn}
                          onClick={() => handleLayoutDelete(layout.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Profile Editor Component
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

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      ...profile,
      name: name.trim(),
      command: command.trim() || undefined,
      color,
    });
  }

  return (
    <div style={styles.editor}>
      <label style={styles.label}>
        <span style={styles.labelText}>Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          placeholder="e.g., Dev Server"
        />
      </label>

      <label style={styles.label}>
        <span style={styles.labelText}>Command (optional)</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          style={styles.input}
          placeholder="e.g., npm run dev"
        />
      </label>

      <label style={styles.label}>
        <span style={styles.labelText}>Color</span>
        <div style={styles.colorRow}>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={styles.colorInput}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ ...styles.input, flex: 1 }}
          />
        </div>
      </label>

      <div style={styles.editorActions}>
        <button style={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button style={styles.saveBtn} onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}

// Layout Editor Component
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
    <div style={styles.editor}>
      <label style={styles.label}>
        <span style={styles.labelText}>Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          placeholder="e.g., AI + Dev + Shell"
        />
      </label>

      <div style={styles.layoutBuilder}>
        <div style={styles.layoutBuilderHeader}>
          <span style={styles.labelText}>Pane Configuration</span>
          <button style={styles.smallBtn} onClick={addRow}>
            + Row
          </button>
        </div>

        {rows.map((row, rowIndex) => (
          <div key={row.id} style={styles.rowBuilder}>
            <div style={styles.rowHeader}>
              <span style={styles.rowLabel}>Row {rowIndex + 1}</span>
              <button style={styles.smallBtn} onClick={() => addPane(row.id)}>
                + Pane
              </button>
            </div>
            <div style={styles.panesRow}>
              {row.panes.map((pane) => (
                <div key={pane.id} style={styles.paneItem}>
                  <select
                    value={pane.profileId}
                    onChange={(e) =>
                      updatePaneProfile(row.id, pane.id, e.target.value)
                    }
                    style={styles.paneSelect}
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {row.panes.length > 1 && (
                    <button
                      style={styles.removeBtn}
                      onClick={() => removePane(row.id, pane.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.editorActions}>
        <button style={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button style={styles.saveBtn} onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}

// Layout Preview Component
function LayoutPreview({
  layout,
  profiles,
}: {
  layout: Layout;
  profiles: TerminalProfile[];
}) {
  return (
    <div style={styles.layoutPreview}>
      {layout.rows.map((row) => (
        <div key={row.id} style={{ ...styles.previewRow, flex: row.flex }}>
          {row.panes.map((pane) => {
            const profile = profiles.find((p) => p.id === pane.profileId);
            return (
              <div
                key={pane.id}
                style={{
                  ...styles.previewPane,
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
    width: "560px",
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
  tabs: {
    display: "flex",
    padding: "0 20px",
    borderBottom: "1px solid var(--border-subtle)",
    gap: "4px",
  },
  tab: {
    padding: "12px 16px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "-1px",
    transition: "all 0.15s ease",
  },
  tabActive: {
    color: "var(--text)",
    borderBottomColor: "var(--accent)",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "20px",
  },
  section: {
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
  },
  addButton: {
    padding: "4px 10px",
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
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
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "6px",
    border: "1px solid var(--border-subtle)",
  },
  itemInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  colorDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  itemName: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text)",
  },
  itemMeta: {
    fontSize: "10px",
    color: "var(--text-muted)",
    marginTop: "2px",
  },
  itemActions: {
    display: "flex",
    gap: "6px",
  },
  iconBtn: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "10px",
    cursor: "pointer",
  },
  editor: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "16px",
    backgroundColor: "var(--bg-tertiary)",
    borderRadius: "8px",
    border: "1px solid var(--border-subtle)",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  labelText: {
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    padding: "8px 10px",
    backgroundColor: "var(--bg)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    color: "var(--text)",
    fontSize: "12px",
    outline: "none",
  },
  colorRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  colorInput: {
    width: "32px",
    height: "32px",
    padding: 0,
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  editorActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "8px",
  },
  cancelBtn: {
    padding: "6px 14px",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text)",
    fontSize: "11px",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "6px 14px",
    backgroundColor: "var(--accent)",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
  },
  layoutBuilder: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  layoutBuilderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smallBtn: {
    padding: "3px 8px",
    backgroundColor: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "10px",
    cursor: "pointer",
  },
  rowBuilder: {
    padding: "10px",
    backgroundColor: "var(--bg)",
    borderRadius: "4px",
    border: "1px solid var(--border-subtle)",
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  rowLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontWeight: 500,
  },
  panesRow: {
    display: "flex",
    gap: "6px",
  },
  paneItem: {
    flex: 1,
    display: "flex",
    gap: "4px",
  },
  paneSelect: {
    flex: 1,
    padding: "6px 8px",
    backgroundColor: "var(--bg-secondary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "4px",
    color: "var(--text)",
    fontSize: "11px",
    outline: "none",
  },
  removeBtn: {
    padding: "0 6px",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "12px",
    cursor: "pointer",
  },
  layoutPreview: {
    width: "36px",
    height: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    backgroundColor: "var(--bg)",
    borderRadius: "3px",
    overflow: "hidden",
    flexShrink: 0,
  },
  previewRow: {
    display: "flex",
    gap: "1px",
  },
  previewPane: {
    minHeight: "4px",
    opacity: 0.8,
  },
};
