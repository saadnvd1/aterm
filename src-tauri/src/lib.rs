use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;

mod config;
mod directory;
mod file_ops;
mod git;
mod iterm;
mod pty;
mod window;
mod worktree;

use config::{load_config, save_config};
use directory::{get_home_dir, list_directory};
use file_ops::{open_in_editor, read_file_content, write_file_content};
use git::{
    clone_repo,
    discard_changes,
    get_commit_diff,
    get_commit_files,
    get_commit_history,
    get_file_diff,
    get_git_remote,
    get_git_status,
    git_commit,
    git_push,
    stage_all,
    stage_files,
    unstage_all,
    unstage_files,
};
use iterm::get_iterm_profiles;
use pty::{
    force_exit,
    get_active_pty_count,
    kill_all_ptys,
    kill_pty,
    resize_pty,
    spawn_pty,
    write_pty,
    PtyMap,
};
use window::{close_detached_window, create_detached_window, list_detached_windows};
use worktree::{create_worktree, list_git_branches, list_worktrees, remove_worktree};

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
            create_worktree,
            remove_worktree,
            list_worktrees,
            list_git_branches,
            spawn_pty,
            write_pty,
            resize_pty,
            kill_pty,
            get_active_pty_count,
            kill_all_ptys,
            force_exit,
            create_detached_window,
            close_detached_window,
            list_detached_windows,
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Only show confirmation dialog for main window
                if window.label() == "main" {
                    // Prevent default close behavior
                    api.prevent_close();
                    // Emit event to frontend to show confirmation dialog
                    let _ = window.emit("exit-requested", ());
                }
                // Detached windows close normally without confirmation
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
