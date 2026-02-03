import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ATSectionHeader } from "@/components/ui/at-section-header";
import { ATFormField } from "@/components/ui/at-form-field";
import { ATListItem, ATListItemContent } from "@/components/ui/at-list-item";
import { Plus, X, Server, Loader2, Check } from "lucide-react";
import type { SSHConnection } from "../../lib/ssh";
import { createSSHConnection } from "../../lib/ssh";

interface SSHConnectionsTabProps {
  connections: SSHConnection[];
  onConnectionsChange: (connections: SSHConnection[]) => void;
}

export function SSHConnectionsTab({
  connections,
  onConnectionsChange,
}: SSHConnectionsTabProps) {
  const [editing, setEditing] = useState<SSHConnection | null>(null);

  function handleSave(connection: SSHConnection) {
    const exists = connections.some((c) => c.id === connection.id);
    const updated = exists
      ? connections.map((c) => (c.id === connection.id ? connection : c))
      : [...connections, connection];
    onConnectionsChange(updated);
    setEditing(null);
  }

  function handleDelete(connectionId: string) {
    onConnectionsChange(connections.filter((c) => c.id !== connectionId));
  }

  return (
    <div className="mb-6">
      <ATSectionHeader
        actions={
          <Button
            size="sm"
            className="h-6 text-[11px]"
            onClick={() =>
              setEditing(createSSHConnection("", "", "", 22))
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        }
      >
        SSH Connections
      </ATSectionHeader>

      {editing ? (
        <ConnectionEditor
          connection={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <ConnectionList
          connections={connections}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function ConnectionEditor({
  connection,
  onSave,
  onCancel,
}: {
  connection: SSHConnection;
  onSave: (c: SSHConnection) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(connection.name);
  const [host, setHost] = useState(connection.host);
  const [port, setPort] = useState(connection.port.toString());
  const [user, setUser] = useState(connection.user);
  const [keyPath, setKeyPath] = useState(connection.keyPath || "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTest() {
    if (!host || !user) return;

    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const success = await invoke<boolean>("test_ssh_connection", {
        host,
        port: parseInt(port, 10) || 22,
        user,
        keyPath: keyPath || null,
      });
      setTestResult(success ? "success" : "error");
      if (!success) {
        setTestError("Connection test returned false");
      }
    } catch (e) {
      setTestResult("error");
      setTestError(String(e));
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    if (!name.trim() || !host.trim() || !user.trim()) return;
    onSave({
      ...connection,
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port, 10) || 22,
      user: user.trim(),
      keyPath: keyPath.trim() || undefined,
    });
  }

  const canSave = name.trim() && host.trim() && user.trim();
  const canTest = host.trim() && user.trim();

  return (
    <div className="flex flex-col gap-3.5 p-4 bg-muted rounded-lg border border-border">
      <ATFormField label="Name" hint="A friendly name for this connection">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Home Server"
        />
      </ATFormField>

      <div className="grid grid-cols-2 gap-3">
        <ATFormField label="Host">
          <Input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="hostname or IP"
          />
        </ATFormField>

        <ATFormField label="Port">
          <Input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="22"
          />
        </ATFormField>
      </div>

      <ATFormField label="Username">
        <Input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="e.g., root"
        />
      </ATFormField>

      <ATFormField label="Key Path (optional)" hint="Leave empty to use ssh-agent">
        <Input
          type="text"
          value={keyPath}
          onChange={(e) => setKeyPath(e.target.value)}
          placeholder="~/.ssh/id_ed25519"
        />
      </ATFormField>

      {testResult === "error" && testError && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          {testError}
        </div>
      )}

      {testResult === "success" && (
        <div className="px-3 py-2 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center gap-2">
          <Check className="h-3.5 w-3.5" />
          Connection successful
        </div>
      )}

      <div className="flex justify-between items-center mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!canTest || testing}
        >
          {testing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConnectionList({
  connections,
  onEdit,
  onDelete,
}: {
  connections: SSHConnection[];
  onEdit: (c: SSHConnection) => void;
  onDelete: (id: string) => void;
}) {
  if (connections.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-xs">
        No SSH connections configured.
        <br />
        Add a connection to enable remote task execution.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {connections.map((conn) => (
        <ATListItem
          key={conn.id}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => onEdit(conn)}
              >
                Edit
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="h-6 w-6"
                onClick={() => onDelete(conn.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          }
        >
          <ATListItemContent
            title={conn.name}
            subtitle={`${conn.user}@${conn.host}:${conn.port}`}
            icon={<Server className="h-4 w-4 text-muted-foreground" />}
          />
        </ATListItem>
      ))}
    </div>
  );
}
