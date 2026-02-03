use std::process::Command;

/// Test if an SSH connection works by running a simple command
#[tauri::command]
pub fn test_ssh_connection(
    host: String,
    port: u16,
    user: String,
    key_path: Option<String>,
) -> Result<bool, String> {
    let mut cmd = Command::new("ssh");

    // Build SSH arguments
    cmd.arg("-o").arg("BatchMode=yes")
       .arg("-o").arg("ConnectTimeout=10")
       .arg("-o").arg("StrictHostKeyChecking=accept-new")
       .arg("-p").arg(port.to_string());

    if let Some(key) = key_path {
        cmd.arg("-i").arg(key);
    }

    cmd.arg(format!("{}@{}", user, host))
       .arg("echo").arg("ok");

    let output = cmd.output().map_err(|e| format!("Failed to execute ssh: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim() == "ok")
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("SSH connection failed: {}", stderr.trim()))
    }
}

/// Execute a command on a remote server via SSH and return the output
#[tauri::command]
pub fn remote_command(
    host: String,
    port: u16,
    user: String,
    key_path: Option<String>,
    command: String,
) -> Result<String, String> {
    let mut cmd = Command::new("ssh");

    cmd.arg("-o").arg("BatchMode=yes")
       .arg("-o").arg("ConnectTimeout=10")
       .arg("-o").arg("StrictHostKeyChecking=accept-new")
       .arg("-p").arg(port.to_string());

    if let Some(key) = key_path {
        cmd.arg("-i").arg(key);
    }

    cmd.arg(format!("{}@{}", user, host))
       .arg(&command);

    let output = cmd.output().map_err(|e| format!("Failed to execute ssh: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Remote command failed: {}", stderr.trim()))
    }
}

/// Check if a path exists on a remote server
#[tauri::command]
pub fn remote_path_exists(
    host: String,
    port: u16,
    user: String,
    key_path: Option<String>,
    path: String,
) -> Result<bool, String> {
    let mut cmd = Command::new("ssh");

    cmd.arg("-o").arg("BatchMode=yes")
       .arg("-o").arg("ConnectTimeout=10")
       .arg("-o").arg("StrictHostKeyChecking=accept-new")
       .arg("-p").arg(port.to_string());

    if let Some(key) = key_path {
        cmd.arg("-i").arg(key);
    }

    cmd.arg(format!("{}@{}", user, host))
       .arg(format!("test -d '{}' && echo exists", path));

    let output = cmd.output().map_err(|e| format!("Failed to execute ssh: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim() == "exists")
    } else {
        // Command failed - path doesn't exist or other error
        Ok(false)
    }
}
