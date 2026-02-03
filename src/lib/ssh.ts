export interface SSHConnection {
  id: string;
  name: string; // User-friendly name (e.g., "Home Server")
  host: string; // Hostname or IP
  port: number; // Default: 22
  user: string; // SSH username
  keyPath?: string; // Optional private key path (uses ssh-agent if not set)
}

export function createSSHConnection(
  name: string,
  host: string,
  user: string,
  port: number = 22,
  keyPath?: string
): SSHConnection {
  return {
    id: crypto.randomUUID(),
    name,
    host,
    port,
    user,
    keyPath,
  };
}
