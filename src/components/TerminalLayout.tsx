import { TerminalPane } from "./TerminalPane";
import type { ProjectConfig } from "../lib/config";

interface Props {
  project: ProjectConfig;
}

export function TerminalLayout({ project }: Props) {
  const mainTerminals = project.terminals.filter((t) => t.position === "main");
  const sideTerminals = project.terminals.filter((t) => t.position === "side");

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        {mainTerminals.map((term) => (
          <TerminalPane
            key={`${project.id}-${term.id}`}
            id={`${project.id}-${term.id}`}
            title={term.title}
            cwd={project.path}
            command={term.command}
          />
        ))}
      </div>

      {sideTerminals.length > 0 && (
        <div style={styles.right}>
          {sideTerminals.map((term) => (
            <TerminalPane
              key={`${project.id}-${term.id}`}
              id={`${project.id}-${term.id}`}
              title={term.title}
              cwd={project.path}
              command={term.command}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flex: 1,
    gap: "6px",
    padding: "6px",
    backgroundColor: "var(--bg)",
    minHeight: 0,
  },
  left: {
    flex: 2,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
  right: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },
};
