use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

pub type PtyMap = Arc<Mutex<HashMap<String, PtyHandle>>>;

pub struct PtyHandle {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

#[tauri::command]
pub fn spawn_pty(
    id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    command: Option<String>,
    app: AppHandle,
    state: tauri::State<'_, PtyMap>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let mut cmd = if let Some(ref command) = command {
        // Run command, then exec a new shell when it exits
        let mut c = CommandBuilder::new(&shell);
        c.args(["-l", "-i", "-c", &format!("{}; exec {} -l -i", command, shell)]);
        c
    } else {
        let mut c = CommandBuilder::new(&shell);
        c.args(["-l", "-i"]);
        c
    };
    cmd.cwd(&cwd);
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    {
        let mut ptys = state.lock().unwrap();
        ptys.insert(id.clone(), PtyHandle { master: pair.master, writer, child });
    }

    let event_id = id.clone();
    thread::spawn(move || {
        // 64KB buffer for better throughput on fast output
        let mut buf = [0u8; 65536];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // Encode as base64 - much more efficient than JSON array
                    // JSON array: [72,101,108,108,111] = ~20 bytes for "Hello"
                    // Base64: "SGVsbG8=" = 8 bytes for "Hello"
                    let encoded = BASE64.encode(&buf[..n]);
                    let _ = app.emit(&format!("pty-output-{}", event_id), encoded);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(id: String, data: String, state: tauri::State<'_, PtyMap>) -> Result<(), String> {
    let mut ptys = state.lock().unwrap();
    if let Some(pty) = ptys.get_mut(&id) {
        pty.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        pty.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyMap>,
) -> Result<(), String> {
    let ptys = state.lock().unwrap();
    if let Some(pty) = ptys.get(&id) {
        pty.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn kill_pty(id: String, state: tauri::State<'_, PtyMap>) -> Result<(), String> {
    let mut ptys = state.lock().unwrap();
    if let Some(mut pty) = ptys.remove(&id) {
        let _ = pty.child.kill();
    }
    Ok(())
}

#[tauri::command]
pub fn get_active_pty_count(state: tauri::State<'_, PtyMap>) -> usize {
    let ptys = state.lock().unwrap();
    ptys.len()
}

#[tauri::command]
pub fn kill_all_ptys(state: tauri::State<'_, PtyMap>) -> Result<(), String> {
    let mut ptys = state.lock().unwrap();
    for (_, mut pty) in ptys.drain() {
        let _ = pty.child.kill();
    }
    Ok(())
}

#[tauri::command]
pub fn force_exit(state: tauri::State<'_, PtyMap>) {
    // Kill all PTYs first
    {
        let mut ptys = state.lock().unwrap();
        for (_, mut pty) in ptys.drain() {
            let _ = pty.child.kill();
        }
    }
    // Exit the process
    std::process::exit(0);
}

/// Spawn a PTY that connects to a remote server via SSH and attaches to a tmux session.
/// The tmux session persists on the remote, allowing reconnection.
#[tauri::command]
pub fn spawn_remote_pty(
    id: String,
    ssh_host: String,
    ssh_port: u16,
    ssh_user: String,
    ssh_key_path: Option<String>,
    remote_cwd: String,
    tmux_session: String,
    command: Option<String>,
    cols: u16,
    rows: u16,
    app: AppHandle,
    state: tauri::State<'_, PtyMap>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    // Build the tmux command to run on remote
    // -A: attach to existing session or create new one
    // -s: session name
    // -c: start directory
    let tmux_cmd = if let Some(ref cmd) = command {
        format!(
            "tmux new-session -A -s '{}' -c '{}' '{}'",
            tmux_session, remote_cwd, cmd
        )
    } else {
        format!(
            "tmux new-session -A -s '{}' -c '{}'",
            tmux_session, remote_cwd
        )
    };

    // Build SSH command
    let mut cmd = CommandBuilder::new("ssh");
    cmd.arg("-t"); // Force TTY allocation
    cmd.args(["-o", "StrictHostKeyChecking=accept-new"]);
    cmd.args(["-p", &ssh_port.to_string()]);

    if let Some(ref key) = ssh_key_path {
        cmd.args(["-i", key]);
    }

    cmd.arg(format!("{}@{}", ssh_user, ssh_host));
    cmd.arg(&tmux_cmd);
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    {
        let mut ptys = state.lock().unwrap();
        ptys.insert(id.clone(), PtyHandle { master: pair.master, writer, child });
    }

    let event_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 65536];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = BASE64.encode(&buf[..n]);
                    let _ = app.emit(&format!("pty-output-{}", event_id), encoded);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}
