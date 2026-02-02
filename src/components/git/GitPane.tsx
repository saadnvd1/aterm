import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { GitStatus, GitFile } from "../../lib/git";
import { PaneHeader } from "../PaneHeader";
import { GitPanelTabs, GitTab } from "./GitPanelTabs";
import { FileChanges } from "./FileChanges";
import { DiffViewer } from "./DiffViewer";
import { DiffModal } from "./DiffModal";
import { FileEditor } from "./FileEditor";
import { CommitForm } from "./CommitForm";
import { CommitHistory } from "./CommitHistory";

interface Props {
  id: string;
  title: string;
  cwd: string;
  accentColor?: string;
  projectColor?: string;
  onFocus?: () => void;
  isFocused?: boolean;
  onClose?: () => void;
  onRename?: (name: string) => void;
  triggerRename?: boolean;
  onTriggerRenameComplete?: () => void;
  canClose?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const POLL_INTERVAL = 5000;

export function GitPane({ title, cwd, accentColor, projectColor, onFocus, isFocused, onClose, onRename, triggerRename, onTriggerRenameComplete, canClose, dragHandleProps }: Props) {
  const [activeTab, setActiveTab] = useState<GitTab>("changes");
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<GitFile | null>(null);
  const [modalDiff, setModalDiff] = useState<string>("");
  const [editorFile, setEditorFile] = useState<GitFile | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const gitStatus = await invoke<GitStatus>("get_git_status", { path: cwd });
      setStatus(gitStatus);
      setError(null);
    } catch (err) {
      console.error("Failed to load git status:", err);
      setError(String(err));
    }
  }, [cwd]);

  useEffect(() => {
    loadStatus();
    pollRef.current = window.setInterval(loadStatus, POLL_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [loadStatus]);

  async function loadDiff(file: GitFile) {
    try {
      const diffContent = await invoke<string>("get_file_diff", {
        path: cwd,
        file: file.path,
        staged: file.staged,
      });
      setDiff(diffContent);
    } catch (err) {
      console.error("Failed to load diff:", err);
      setDiff("");
    }
  }

  function handleSelectFile(file: GitFile) {
    setSelectedFile(file);
    loadDiff(file);
  }

  async function handleStageFile(file: GitFile) {
    try {
      await invoke("stage_files", { path: cwd, files: [file.path] });
      await loadStatus();
      if (selectedFile?.path === file.path) {
        const updatedFile = { ...file, staged: true };
        setSelectedFile(updatedFile);
        loadDiff(updatedFile);
      }
    } catch (err) {
      console.error("Failed to stage file:", err);
    }
  }

  async function handleUnstageFile(file: GitFile) {
    try {
      await invoke("unstage_files", { path: cwd, files: [file.path] });
      await loadStatus();
      if (selectedFile?.path === file.path) {
        const updatedFile = { ...file, staged: false };
        setSelectedFile(updatedFile);
        loadDiff(updatedFile);
      }
    } catch (err) {
      console.error("Failed to unstage file:", err);
    }
  }

  async function handleDiscardFile(file: GitFile) {
    const isUntracked = file.status === "untracked";
    const confirmMessage = isUntracked
      ? `Delete untracked file "${file.path}"?`
      : `Discard changes to "${file.path}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await invoke("discard_changes", {
        path: cwd,
        file: file.path,
        isUntracked,
      });
      await loadStatus();
      if (selectedFile?.path === file.path) {
        setSelectedFile(null);
        setDiff("");
      }
    } catch (err) {
      console.error("Failed to discard changes:", err);
    }
  }

  async function handleStageAll() {
    try {
      await invoke("stage_all", { path: cwd });
      await loadStatus();
    } catch (err) {
      console.error("Failed to stage all:", err);
    }
  }

  async function handleUnstageAll() {
    try {
      await invoke("unstage_all", { path: cwd });
      await loadStatus();
    } catch (err) {
      console.error("Failed to unstage all:", err);
    }
  }

  async function handleViewInModal(file: GitFile) {
    try {
      const diffContent = await invoke<string>("get_file_diff", {
        path: cwd,
        file: file.path,
        staged: file.staged,
      });
      setModalDiff(diffContent);
      setModalFile(file);
    } catch (err) {
      console.error("Failed to load diff for modal:", err);
    }
  }

  function handleEdit(file: GitFile) {
    setEditorFile(file);
  }

  async function handleOpenInEditor(file: GitFile, editor: string) {
    try {
      const fullPath = `${cwd}/${file.path}`;
      await invoke("open_in_editor", { path: fullPath, editor });
    } catch (err) {
      console.error("Failed to open in editor:", err);
    }
  }

  function handleEditorSave() {
    loadStatus();
    if (selectedFile) {
      loadDiff(selectedFile);
    }
  }

  async function handleCommit(message: string) {
    setIsCommitting(true);
    try {
      await invoke("git_commit", { path: cwd, message });
      await loadStatus();
      setSelectedFile(null);
      setDiff("");
    } catch (err) {
      console.error("Failed to commit:", err);
      alert(`Commit failed: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleCommitAndPush(message: string) {
    setIsCommitting(true);
    try {
      await invoke("git_commit", { path: cwd, message });
      await invoke("git_push", { path: cwd });
      await loadStatus();
      setSelectedFile(null);
      setDiff("");
    } catch (err) {
      console.error("Failed to commit and push:", err);
      alert(`Operation failed: ${err}`);
    } finally {
      setIsCommitting(false);
    }
  }

  const branchDisplay = status ? (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-blue-400 font-mono px-1.5 py-0.5 bg-muted rounded">
        {status.branch || "HEAD"}
      </span>
      {(status.ahead > 0 || status.behind > 0) && (
        <span className="flex gap-1 text-[11px]">
          {status.ahead > 0 && <span className="text-green-400">↑{status.ahead}</span>}
          {status.behind > 0 && <span className="text-red-400">↓{status.behind}</span>}
        </span>
      )}
    </div>
  ) : null;

  const refreshButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => loadStatus()}
      title="Refresh"
      className="opacity-60 hover:opacity-100"
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background rounded-lg border border-border overflow-hidden" onClick={onFocus}>
      <PaneHeader
        title={title}
        accentColor={accentColor}
        projectColor={projectColor}
        isFocused={isFocused}
        canClose={canClose}
        onClose={onClose}
        onRename={onRename}
        triggerRename={triggerRename}
        onTriggerRenameComplete={onTriggerRenameComplete}
        dragHandleProps={dragHandleProps}
        titleExtra={branchDisplay}
        actions={refreshButton}
      />

      <GitPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {error ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          <span>Not a git repository</span>
        </div>
      ) : activeTab === "changes" ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <div className="w-2/5 min-w-[200px] max-w-[400px] flex flex-col border-r border-border overflow-hidden">
              {status && (
                <FileChanges
                  staged={status.staged}
                  unstaged={status.unstaged}
                  untracked={status.untracked}
                  selectedFile={selectedFile}
                  onSelectFile={handleSelectFile}
                  onStageFile={handleStageFile}
                  onUnstageFile={handleUnstageFile}
                  onDiscardFile={handleDiscardFile}
                  onStageAll={handleStageAll}
                  onUnstageAll={handleUnstageAll}
                  onViewInModal={handleViewInModal}
                  onEdit={handleEdit}
                  onOpenInEditor={handleOpenInEditor}
                />
              )}
            </div>
            <div className="flex-1 flex overflow-hidden">
              <DiffViewer diff={diff} fileName={selectedFile?.path} />
            </div>
          </div>
          <CommitForm
            hasStaged={status ? status.staged.length > 0 : false}
            onCommit={handleCommit}
            onCommitAndPush={handleCommitAndPush}
            isCommitting={isCommitting}
          />
        </div>
      ) : (
        <CommitHistory cwd={cwd} />
      )}

      <DiffModal
        isOpen={modalFile !== null}
        onClose={() => setModalFile(null)}
        diff={modalDiff}
        fileName={modalFile?.path || ""}
        onEdit={modalFile ? () => {
          setEditorFile(modalFile);
          setModalFile(null);
        } : undefined}
        onOpenInEditor={modalFile ? (editor) => {
          handleOpenInEditor(modalFile, editor);
        } : undefined}
      />

      {editorFile && (
        <FileEditor
          filePath={`${cwd}/${editorFile.path}`}
          onClose={() => setEditorFile(null)}
          onSave={handleEditorSave}
        />
      )}
    </div>
  );
}
