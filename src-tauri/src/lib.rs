use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

// ============================================================================
// Config - stored as flexible JSON to allow frontend to manage schema
// ============================================================================

fn get_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("aterm")
        .join("config.json")
}

fn ensure_config_dir() -> std::io::Result<()> {
    let config_path = get_config_path();
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

#[tauri::command]
fn load_config() -> Result<Value, String> {
    let config_path = get_config_path();

    if !config_path.exists() {
        // Return null, frontend will use defaults
        return Ok(Value::Null);
    }

    let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn save_config(config: Value) -> Result<(), String> {
    ensure_config_dir().map_err(|e| e.to_string())?;
    let config_path = get_config_path();
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================================
// Directory Browsing
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    is_git_repo: bool,
}

#[tauri::command]
fn list_directory(path: Option<String>) -> Result<Vec<DirEntry>, String> {
    let dir_path = path
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from("/")));

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') && name != ".." {
            continue;
        }

        let is_dir = path.is_dir();
        let is_git_repo = is_dir && path.join(".git").exists();

        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            is_git_repo,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
fn get_home_dir() -> String {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/"))
        .to_string_lossy()
        .to_string()
}

// ============================================================================
// Git Operations
// ============================================================================

#[tauri::command]
fn clone_repo(url: String, destination: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["clone", &url, &destination])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(destination)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn get_git_remote(path: String) -> Result<Option<String>, String> {
    let output = std::process::Command::new("git")
        .args(["-C", &path, "remote", "get-url", "origin"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let remote = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(if remote.is_empty() { None } else { Some(remote) })
    } else {
        Ok(None)
    }
}

// ============================================================================
// PTY Management
// ============================================================================

type PtyMap = Arc<Mutex<HashMap<String, PtyHandle>>>;

struct PtyHandle {
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

#[tauri::command]
fn spawn_pty(
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
        let mut c = CommandBuilder::new(&shell);
        c.args(["-i", "-c", command]);
        c
    } else {
        let mut c = CommandBuilder::new(&shell);
        c.arg("-i");
        c
    };
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    {
        let mut ptys = state.lock().unwrap();
        ptys.insert(id.clone(), PtyHandle { writer, child });
    }

    let event_id = id.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(&format!("pty-output-{}", event_id), data);
                }
                Err(_) => break,
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn write_pty(id: String, data: String, state: tauri::State<'_, PtyMap>) -> Result<(), String> {
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
fn resize_pty(
    id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyMap>,
) -> Result<(), String> {
    let _ = (id, cols, rows, state);
    Ok(())
}

#[tauri::command]
fn kill_pty(id: String, state: tauri::State<'_, PtyMap>) -> Result<(), String> {
    let mut ptys = state.lock().unwrap();
    if let Some(mut pty) = ptys.remove(&id) {
        let _ = pty.child.kill();
    }
    Ok(())
}

// ============================================================================
// App Entry Point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_map: PtyMap = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .manage(pty_map)
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            list_directory,
            get_home_dir,
            clone_repo,
            get_git_remote,
            spawn_pty,
            write_pty,
            resize_pty,
            kill_pty,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
