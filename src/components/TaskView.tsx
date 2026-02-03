import type { ProjectConfig } from "../lib/config";
import type { Layout } from "../lib/layouts";
import type { TerminalProfile } from "../lib/profiles";
import type { Task } from "../lib/tasks";
import type { SSHConnection } from "../lib/ssh";
import { TerminalLayout } from "./TerminalLayout";

interface Props {
  project: ProjectConfig;
  task: Task;
  layout: Layout;
  profiles: TerminalProfile[];
  sshConnections: SSHConnection[];
  defaultFontSize: number;
  defaultScrollback: number;
  paneFontSizes: Record<string, number>;
  onPaneFontSizeChange: (paneInstanceId: string, fontSize: number) => void;
  onLayoutChange: (layout: Layout) => void;
  onPromptInjected: () => void;
}

export function TaskView({
  project,
  task,
  layout,
  profiles,
  sshConnections,
  defaultFontSize,
  defaultScrollback,
  paneFontSizes,
  onPaneFontSizeChange,
  onLayoutChange,
  onPromptInjected,
}: Props) {
  const shouldInject = !!task.initialPrompt && !task.promptInjected;
  const taskProject: ProjectConfig = {
    ...project,
    id: `task-${task.id}`,
    name: `${project.name} / ${task.name}`,
    path: task.worktreePath,
  };

  // Get SSH connection for remote tasks
  const sshConnection = task.isRemote && project.sshConnectionId
    ? sshConnections.find((c) => c.id === project.sshConnectionId)
    : undefined;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            {task.name}
            {task.isRemote && (
              <span className="ml-2 text-[10px] font-normal text-primary">Remote</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{task.branch}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <TerminalLayout
          project={taskProject}
          layout={layout}
          profiles={profiles}
          defaultFontSize={defaultFontSize}
          defaultScrollback={defaultScrollback}
          paneFontSizes={paneFontSizes}
          onPaneFontSizeChange={onPaneFontSizeChange}
          onLayoutChange={onLayoutChange}
          initialInputByPaneId={
            shouldInject && task.initialPrompt
              ? { main: task.initialPrompt }
              : undefined
          }
          onInitialInputSentByPaneId={
            shouldInject ? { main: onPromptInjected } : undefined
          }
          isProjectActive={true}
          remoteExecution={
            task.isRemote && sshConnection && task.remoteTmuxSession
              ? {
                  sshHost: sshConnection.host,
                  sshPort: sshConnection.port,
                  sshUser: sshConnection.user,
                  sshKeyPath: sshConnection.keyPath,
                  tmuxSession: task.remoteTmuxSession,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
