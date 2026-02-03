import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Check, X } from "lucide-react";
import type { SSHConnection } from "../../lib/ssh";

export interface RemoteExecutionSectionProps {
  sshConnections: SSHConnection[];
  sshConnectionId: string;
  onConnectionChange: (id: string) => void;
  remoteProjectPath: string;
  onRemotePathChange: (path: string) => void;
  remoteOpen: boolean;
  onRemoteOpenChange: (open: boolean) => void;
  validatingPath: boolean;
  pathValid: boolean | null;
  onValidatePath: () => void;
}

export function RemoteExecutionSection({
  sshConnections,
  sshConnectionId,
  onConnectionChange,
  remoteProjectPath,
  onRemotePathChange,
  remoteOpen,
  onRemoteOpenChange,
  validatingPath,
  pathValid,
  onValidatePath,
}: RemoteExecutionSectionProps) {
  if (sshConnections.length === 0) {
    return null;
  }

  const selectedConnection = sshConnections.find((c) => c.id === sshConnectionId);

  return (
    <div className="border border-border rounded-lg mt-3.5">
      <button
        type="button"
        onClick={() => onRemoteOpenChange(!remoteOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn("h-4 w-4 transition-transform", remoteOpen && "rotate-90")}
        />
        Remote Execution
        {sshConnectionId && selectedConnection && (
          <span className="ml-auto text-xs text-primary">
            {selectedConnection.name}
          </span>
        )}
      </button>
      {remoteOpen && (
        <div className="border-t border-border px-3 py-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              SSH Connection
            </span>
            <Select value={sshConnectionId || "_none"} onValueChange={(v) => onConnectionChange(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None (local execution)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None (local execution)</SelectItem>
                {sshConnections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.name} ({conn.user}@{conn.host})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sshConnectionId && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Remote Project Path
              </span>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={remoteProjectPath}
                  onChange={(e) => onRemotePathChange(e.target.value)}
                  placeholder="/home/user/dev/project"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onValidatePath}
                  disabled={!remoteProjectPath || validatingPath}
                >
                  {validatingPath ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : pathValid === true ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : pathValid === false ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
              {pathValid === false && (
                <span className="text-[10px] text-destructive">
                  Path does not exist on remote server
                </span>
              )}
              {pathValid === true && (
                <span className="text-[10px] text-green-500">
                  Path verified
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
