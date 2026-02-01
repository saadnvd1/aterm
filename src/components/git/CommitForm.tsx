import { useState } from "react";

interface Props {
  hasStaged: boolean;
  onCommit: (message: string) => void;
  onCommitAndPush: (message: string) => void;
  isCommitting: boolean;
}

export function CommitForm({ hasStaged, onCommit, onCommitAndPush, isCommitting }: Props) {
  const [message, setMessage] = useState("");

  const canCommit = hasStaged && message.trim().length > 0 && !isCommitting;

  function handleCommit() {
    if (canCommit) {
      onCommit(message.trim());
      setMessage("");
    }
  }

  function handleCommitAndPush() {
    if (canCommit) {
      onCommitAndPush(message.trim());
      setMessage("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.metaKey && canCommit) {
      e.preventDefault();
      handleCommit();
    }
  }

  return (
    <div style={styles.container}>
      <textarea
        style={styles.textarea}
        placeholder={hasStaged ? "Commit message..." : "Stage changes to commit"}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!hasStaged || isCommitting}
        rows={2}
      />
      <div style={styles.buttons}>
        <button
          style={{
            ...styles.button,
            ...(!canCommit ? styles.buttonDisabled : {}),
          }}
          onClick={handleCommit}
          disabled={!canCommit}
        >
          {isCommitting ? "Committing..." : "Commit"}
        </button>
        <button
          style={{
            ...styles.button,
            ...styles.pushButton,
            ...(!canCommit ? styles.buttonDisabled : {}),
          }}
          onClick={handleCommitAndPush}
          disabled={!canCommit}
        >
          Commit & Push
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "8px",
    borderTop: "1px solid var(--border-subtle)",
    backgroundColor: "var(--bg-secondary)",
  },
  textarea: {
    width: "100%",
    padding: "8px",
    backgroundColor: "var(--bg)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    fontFamily: "inherit",
    resize: "none",
    outline: "none",
    boxSizing: "border-box",
  },
  buttons: {
    display: "flex",
    gap: "8px",
    marginTop: "8px",
  },
  button: {
    flex: 1,
    padding: "8px 12px",
    backgroundColor: "var(--bg-tertiary)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "6px",
    color: "var(--text)",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.1s",
  },
  pushButton: {
    backgroundColor: "#f97316",
    border: "none",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};
