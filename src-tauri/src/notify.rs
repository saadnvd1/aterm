use std::sync::Arc;
use tauri::{AppHandle, Manager};
use user_notify::{NotificationResponseAction, get_notification_manager};

pub fn init_notifications(app: &AppHandle) {
    let bundle_id = app
        .config()
        .identifier
        .clone();

    let manager = get_notification_manager(bundle_id, None);

    let app_handle = app.clone();
    manager
        .register(
            Box::new(move |response| {
                log::info!("[notify] response: {:?}", response.action);
                if response.action == NotificationResponseAction::Default {
                    // User clicked the notification — bring window to focus
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }),
            vec![], // No custom action categories needed
        )
        .unwrap_or_else(|e| log::error!("[notify] register failed: {e}"));

    #[cfg(target_os = "macos")]
    {
        let manager_clone = manager.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(e) = manager_clone
                .first_time_ask_for_notification_permission()
                .await
            {
                log::warn!("[notify] permission request failed: {e}");
            }
        });
    }

    // Store manager in app state for use by the send command
    app.manage(NotifyState(manager));
}

pub struct NotifyState(pub Arc<dyn user_notify::NotificationManager>);

#[tauri::command]
pub async fn send_bell_notification(
    state: tauri::State<'_, NotifyState>,
    title: String,
    body: String,
) -> Result<(), String> {
    let notification = user_notify::NotificationBuilder::new()
        .title(&title)
        .body(&body);

    state
        .0
        .send_notification(notification)
        .await
        .map_err(|e| format!("{e}"))?;

    Ok(())
}
