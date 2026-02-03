use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    pub window_type: String, // "pane" or "project"
    pub id: String,          // pane_id or project_id
    pub title: String,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub label: String,
    pub window_type: String,
    pub id: String,
}

#[tauri::command]
pub async fn create_detached_window(
    app: AppHandle,
    config: WindowConfig,
) -> Result<String, String> {
    let label = format!("{}-{}", config.window_type, config.id);
    let url = format!(
        "index.html?mode={}&id={}",
        config.window_type, config.id
    );

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&config.title)
        .inner_size(
            config.width.unwrap_or(1200.0),
            config.height.unwrap_or(800.0),
        )
        .build()
        .map_err(|e| e.to_string())?;

    Ok(label)
}

#[tauri::command]
pub fn close_detached_window(app: AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_detached_windows(app: AppHandle) -> Vec<WindowInfo> {
    app.webview_windows()
        .iter()
        .filter_map(|(label, _)| {
            if label == "main" {
                return None;
            }
            let parts: Vec<&str> = label.splitn(2, '-').collect();
            if parts.len() == 2 {
                Some(WindowInfo {
                    label: label.clone(),
                    window_type: parts[0].to_string(),
                    id: parts[1].to_string(),
                })
            } else {
                None
            }
        })
        .collect()
}
