use std::fs::OpenOptions;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

struct BackendProcess(Mutex<Option<Child>>);

/// Locate the portable Python backend (server.py) in dev and in bundled builds.
fn find_server_script(app: &tauri::App) -> Option<PathBuf> {
    let candidates = [
        // Bundled resource: <resource_dir>/portable/server.py
        app.path().resource_dir().ok()?.join("portable").join("server.py"),
        // Dev layout: <src-tauri>/../../portable/server.py
        std::env::current_dir()
            .ok()?
            .join("../../portable/server.py"),
        // Dev layout fallback: <src-tauri>/../portable/server.py
        std::env::current_dir().ok()?.join("../portable/server.py"),
    ];
    candidates.into_iter().find(|p| p.exists())
}

/// Resolve a writable per-user data directory for the backend runtime data.
fn data_dir_override() -> PathBuf {
    let base = if cfg!(windows) {
        std::env::var("APPDATA").map(PathBuf::from)
    } else {
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".local/share")))
    }
    .unwrap_or_else(|_| std::env::temp_dir().join("techbench"));

    let dir = base.join("TechBench");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            if let Some(script) = find_server_script(app) {
                let python = if cfg!(windows) { "python" } else { "python3" };
                let log_path = std::env::temp_dir().join("techbench-server.log");
                let stdout = match OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                {
                    Ok(f) => f.into(),
                    Err(_) => Stdio::null(),
                };

                let child = Command::new(python)
                    .arg(&script)
                    .current_dir(script.parent().unwrap_or(std::path::Path::new(".")))
                    .env("TECHBENCH_DATA_DIR", data_dir_override())
                    .env("TECHBENCH_PARENT_PID", std::process::id().to_string())
                    .stdin(Stdio::null())
                    .stdout(stdout)
                    .stderr(Stdio::null())
                    .spawn();

                match child {
                    Ok(c) => {
                        let state = app.state::<BackendProcess>();
                        if let Ok(mut guard) = state.0.lock() {
                            *guard = Some(c);
                        }
                        eprintln!("[TechBench] backend started: {}", script.display());
                    }
                    Err(e) => eprintln!("[TechBench] failed to start backend: {}", e),
                }
            } else {
                eprintln!("[TechBench] server.py not found - API features will be unavailable");
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building TechBench")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        });
}
