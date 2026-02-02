use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
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
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem};

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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFile {
    path: String,
    status: String,
    staged: bool,
    old_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    branch: String,
    ahead: i32,
    behind: i32,
    staged: Vec<GitFile>,
    unstaged: Vec<GitFile>,
    untracked: Vec<GitFile>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    hash: String,
    short_hash: String,
    subject: String,
    author: String,
    timestamp: i64,
    relative_time: String,
    files_changed: i32,
    additions: i32,
    deletions: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitFile {
    path: String,
    status: String,
    additions: i32,
    deletions: i32,
}

fn parse_status_code(code: &str) -> &'static str {
    match code {
        "M" => "modified",
        "A" => "added",
        "D" => "deleted",
        "R" => "renamed",
        "C" => "copied",
        "U" => "unmerged",
        "?" => "untracked",
        _ => "unknown",
    }
}

fn parse_relative_time(seconds_ago: i64) -> String {
    if seconds_ago < 60 {
        "just now".to_string()
    } else if seconds_ago < 3600 {
        let mins = seconds_ago / 60;
        format!("{}m ago", mins)
    } else if seconds_ago < 86400 {
        let hours = seconds_ago / 3600;
        format!("{}h ago", hours)
    } else if seconds_ago < 604800 {
        let days = seconds_ago / 86400;
        format!("{}d ago", days)
    } else if seconds_ago < 2592000 {
        let weeks = seconds_ago / 604800;
        format!("{}w ago", weeks)
    } else {
        let months = seconds_ago / 2592000;
        format!("{}mo ago", months)
    }
}

#[tauri::command]
fn get_git_status(path: String) -> Result<GitStatus, String> {
    // Get current branch
    let branch_output = std::process::Command::new("git")
        .args(["-C", &path, "branch", "--show-current"])
        .output()
        .map_err(|e| e.to_string())?;
    let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();

    // Get ahead/behind counts
    let mut ahead = 0;
    let mut behind = 0;
    let revlist_output = std::process::Command::new("git")
        .args(["-C", &path, "rev-list", "--left-right", "--count", "@{upstream}...HEAD"])
        .output();

    if let Ok(output) = revlist_output {
        if output.status.success() {
            let counts = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = counts.trim().split_whitespace().collect();
            if parts.len() == 2 {
                behind = parts[0].parse().unwrap_or(0);
                ahead = parts[1].parse().unwrap_or(0);
            }
        }
    }

    // Get status with porcelain v1
    let status_output = std::process::Command::new("git")
        .args(["-C", &path, "status", "--porcelain=v1"])
        .output()
        .map_err(|e| e.to_string())?;

    let status_text = String::from_utf8_lossy(&status_output.stdout);

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for line in status_text.lines() {
        if line.len() < 3 {
            continue;
        }

        let index_status = &line[0..1];
        let worktree_status = &line[1..2];
        let file_path = line[3..].to_string();

        // Handle renames (format: "R  old_path -> new_path")
        let (actual_path, old_path) = if file_path.contains(" -> ") {
            let parts: Vec<&str> = file_path.split(" -> ").collect();
            (parts[1].to_string(), Some(parts[0].to_string()))
        } else {
            (file_path, None)
        };

        // Untracked files
        if index_status == "?" {
            untracked.push(GitFile {
                path: actual_path,
                status: "untracked".to_string(),
                staged: false,
                old_path: None,
            });
            continue;
        }

        // Staged changes (index status)
        if index_status != " " && index_status != "?" {
            staged.push(GitFile {
                path: actual_path.clone(),
                status: parse_status_code(index_status).to_string(),
                staged: true,
                old_path: old_path.clone(),
            });
        }

        // Unstaged changes (worktree status)
        if worktree_status != " " {
            unstaged.push(GitFile {
                path: actual_path,
                status: parse_status_code(worktree_status).to_string(),
                staged: false,
                old_path,
            });
        }
    }

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
    })
}

#[tauri::command]
fn get_file_diff(path: String, file: String, staged: bool) -> Result<String, String> {
    let mut args = vec!["-C", &path, "diff"];
    if staged {
        args.push("--staged");
    }
    args.push("--");
    args.push(&file);

    let output = std::process::Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    // If no diff (e.g., untracked file), show the file content
    if output.stdout.is_empty() {
        let file_path = PathBuf::from(&path).join(&file);
        if file_path.exists() {
            let content = fs::read_to_string(&file_path).unwrap_or_default();
            // Format as a pseudo-diff for new files
            let lines: Vec<String> = content.lines().map(|l| format!("+{}", l)).collect();
            return Ok(format!("New file: {}\n\n{}", file, lines.join("\n")));
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn stage_files(path: String, files: Vec<String>) -> Result<(), String> {
    let mut args = vec!["-C".to_string(), path, "add".to_string(), "--".to_string()];
    args.extend(files);

    let output = std::process::Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn stage_all(path: String) -> Result<(), String> {
    let output = std::process::Command::new("git")
        .args(["-C", &path, "add", "-A"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn unstage_files(path: String, files: Vec<String>) -> Result<(), String> {
    let mut args = vec!["-C".to_string(), path, "reset".to_string(), "HEAD".to_string(), "--".to_string()];
    args.extend(files);

    let output = std::process::Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn unstage_all(path: String) -> Result<(), String> {
    let output = std::process::Command::new("git")
        .args(["-C", &path, "reset", "HEAD"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn discard_changes(path: String, file: String, is_untracked: bool) -> Result<(), String> {
    if is_untracked {
        // Delete untracked file
        let file_path = PathBuf::from(&path).join(&file);
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    } else {
        // Restore tracked file
        let output = std::process::Command::new("git")
            .args(["-C", &path, "checkout", "--", &file])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
    }
    Ok(())
}

#[tauri::command]
fn git_commit(path: String, message: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["-C", &path, "commit", "-m", &message])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn git_push(path: String) -> Result<String, String> {
    // First try normal push
    let output = std::process::Command::new("git")
        .args(["-C", &path, "push"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    // If that fails, try to set upstream
    let branch_output = std::process::Command::new("git")
        .args(["-C", &path, "branch", "--show-current"])
        .output()
        .map_err(|e| e.to_string())?;
    let branch = String::from_utf8_lossy(&branch_output.stdout).trim().to_string();

    let output = std::process::Command::new("git")
        .args(["-C", &path, "push", "-u", "origin", &branch])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn get_commit_history(path: String, limit: i32) -> Result<Vec<CommitSummary>, String> {
    // Get commit info with custom format
    let format = "%H|%h|%s|%an|%ct";
    let output = std::process::Command::new("git")
        .args(["-C", &path, "log", &format!("--format={}", format), &format!("-n{}", limit)])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let mut commits = Vec::new();
    let log_text = String::from_utf8_lossy(&output.stdout);

    for line in log_text.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 5 {
            let timestamp: i64 = parts[4].parse().unwrap_or(0);
            let seconds_ago = now - timestamp;

            commits.push(CommitSummary {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                subject: parts[2].to_string(),
                author: parts[3].to_string(),
                timestamp,
                relative_time: parse_relative_time(seconds_ago),
                files_changed: 0,
                additions: 0,
                deletions: 0,
            });
        }
    }

    // Get stats for each commit
    for commit in &mut commits {
        let stat_output = std::process::Command::new("git")
            .args(["-C", &path, "show", "--stat", "--format=", &commit.hash])
            .output();

        if let Ok(output) = stat_output {
            let stat_text = String::from_utf8_lossy(&output.stdout);
            // Parse the summary line like "3 files changed, 10 insertions(+), 5 deletions(-)"
            for line in stat_text.lines() {
                if line.contains("changed") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    for (i, part) in parts.iter().enumerate() {
                        if *part == "file" || *part == "files" {
                            if i > 0 {
                                commit.files_changed = parts[i - 1].parse().unwrap_or(0);
                            }
                        } else if part.contains("insertion") {
                            if i > 0 {
                                commit.additions = parts[i - 1].parse().unwrap_or(0);
                            }
                        } else if part.contains("deletion") {
                            if i > 0 {
                                commit.deletions = parts[i - 1].parse().unwrap_or(0);
                            }
                        }
                    }
                    break;
                }
            }
        }
    }

    Ok(commits)
}

#[tauri::command]
fn get_commit_files(path: String, hash: String) -> Result<Vec<CommitFile>, String> {
    let output = std::process::Command::new("git")
        .args(["-C", &path, "show", "--numstat", "--name-status", "--format=", &hash])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let lines: Vec<&str> = text.lines().collect();

    let mut files = Vec::new();
    let mut numstat_map: HashMap<String, (i32, i32)> = HashMap::new();

    // First pass: collect numstat (additions/deletions)
    for line in &lines {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() == 3 {
            let additions: i32 = parts[0].parse().unwrap_or(0);
            let deletions: i32 = parts[1].parse().unwrap_or(0);
            let file_path = parts[2].to_string();
            numstat_map.insert(file_path, (additions, deletions));
        }
    }

    // Second pass: collect name-status
    for line in &lines {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 2 && parts[0].len() == 1 {
            let status_code = parts[0];
            let file_path = if parts.len() == 3 {
                // Rename: "R\told_path\tnew_path"
                parts[2].to_string()
            } else {
                parts[1].to_string()
            };

            let (additions, deletions) = numstat_map.get(&file_path).copied().unwrap_or((0, 0));

            let status = match status_code {
                "A" => "added",
                "M" => "modified",
                "D" => "deleted",
                "R" => "renamed",
                _ => "modified",
            };

            files.push(CommitFile {
                path: file_path,
                status: status.to_string(),
                additions,
                deletions,
            });
        }
    }

    Ok(files)
}

#[tauri::command]
fn get_commit_diff(path: String, hash: String, file: Option<String>) -> Result<String, String> {
    let mut args = vec!["-C", &path, "show", &hash];

    let file_ref;
    if let Some(ref f) = file {
        args.push("--");
        file_ref = f.as_str();
        args.push(file_ref);
    }

    let output = std::process::Command::new("git")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn open_in_editor(path: String, editor: Option<String>) -> Result<(), String> {
    let editor = editor.unwrap_or_else(|| "default".to_string());

    let result = match editor.as_str() {
        "vscode" | "code" => {
            std::process::Command::new("code")
                .arg(&path)
                .spawn()
        }
        "cursor" => {
            std::process::Command::new("cursor")
                .arg(&path)
                .spawn()
        }
        _ => {
            // Use system default - 'open' on macOS
            #[cfg(target_os = "macos")]
            {
                std::process::Command::new("open")
                    .arg("-t") // Open in default text editor
                    .arg(&path)
                    .spawn()
            }
            #[cfg(not(target_os = "macos"))]
            {
                std::process::Command::new("xdg-open")
                    .arg(&path)
                    .spawn()
            }
        }
    };

    result.map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_content(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

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
// iTerm2 Import
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ITermProfile {
    name: String,
    guid: String,
    command: Option<String>,
    working_directory: Option<String>,
}

#[tauri::command]
fn get_iterm_profiles() -> Result<Vec<ITermProfile>, String> {
    let plist_path = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/"))
        .join("Library/Preferences/com.googlecode.iterm2.plist");

    if !plist_path.exists() {
        return Err("iTerm2 preferences not found".to_string());
    }

    let plist_value: plist::Value = plist::from_file(&plist_path)
        .map_err(|e| format!("Failed to read iTerm2 plist: {}", e))?;

    let dict = plist_value.as_dictionary()
        .ok_or("Invalid plist format")?;

    let bookmarks = dict.get("New Bookmarks")
        .and_then(|v| v.as_array())
        .ok_or("No profiles found in iTerm2")?;

    let mut profiles = Vec::new();

    for bookmark in bookmarks {
        if let Some(bookmark_dict) = bookmark.as_dictionary() {
            let name = bookmark_dict.get("Name")
                .and_then(|v| v.as_string())
                .unwrap_or("Unnamed")
                .to_string();

            let guid = bookmark_dict.get("Guid")
                .and_then(|v| v.as_string())
                .unwrap_or("")
                .to_string();

            // Get command if not empty
            let command = bookmark_dict.get("Command")
                .and_then(|v| v.as_string())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());

            let working_directory = bookmark_dict.get("Working Directory")
                .and_then(|v| v.as_string())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());

            if !guid.is_empty() {
                profiles.push(ITermProfile {
                    name,
                    guid,
                    command,
                    working_directory,
                });
            }
        }
    }

    Ok(profiles)
}

// ============================================================================
// PTY Management
// ============================================================================

type PtyMap = Arc<Mutex<HashMap<String, PtyHandle>>>;

struct PtyHandle {
    master: Box<dyn portable_pty::MasterPty + Send>,
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
            get_git_status,
            get_file_diff,
            stage_files,
            stage_all,
            unstage_files,
            unstage_all,
            discard_changes,
            git_commit,
            git_push,
            get_commit_history,
            get_commit_files,
            get_commit_diff,
            open_in_editor,
            read_file_content,
            write_file_content,
            get_iterm_profiles,
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

            // Create custom menu with Cmd+W bound to close-pane instead of close-window
            let handle = app.handle().clone();
            let close_pane = MenuItemBuilder::new("Close Pane")
                .id("close-pane")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&close_pane)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, Some("Close Window"))?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, Some("Quit"))?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |_app, event| {
                if event.id().as_ref() == "close-pane" {
                    let _ = handle.emit("close-pane", ());
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
