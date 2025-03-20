// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PrFile {
    filename: String,
    path: String,
    pr_number: String,
    num: i32,
}

struct AppState {
    current_dir: Mutex<String>,
}

#[tauri::command]
fn get_pr_files(state: State<AppState>) -> Result<Vec<PrFile>, String> {
    let current_dir = state.current_dir.lock().unwrap();
    let path = Path::new(&*current_dir);

    if !path.exists() {
        return Err(format!("Directory does not exist: {}", current_dir));
    }

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    };

    let mut files = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path = entry.path();

        if let Some(extension) = path.extension() {
            if extension == "json" {
                let filename = path.file_name().unwrap().to_string_lossy().to_string();
                if filename.starts_with("pr_") && filename.ends_with(".json") {
                    // Extract PR number from filename (pr_NUMBER.json)
                    let pr_number = filename
                        .strip_prefix("pr_")
                        .unwrap()
                        .strip_suffix(".json")
                        .unwrap()
                        .to_string();

                    files.push(PrFile {
                        filename,
                        path: path.to_string_lossy().to_string(),
                        pr_number: pr_number.clone(),
                        num: pr_number.parse::<i32>().unwrap_or_else(|_| 0)
                    });
                }
            }
        }
    }

    files.sort_by(|a, b| b.num.cmp(&a.num));

    Ok(files)
}

#[tauri::command]
fn set_directory(new_dir: String, state: State<AppState>) -> Result<(), String> {
    let path = Path::new(&new_dir);

    if !path.exists() {
        return Err(format!("Directory does not exist: {}", new_dir));
    }

    if !path.is_dir() {
        return Err(format!("Not a directory: {}", new_dir));
    }

    let mut current_dir = state.current_dir.lock().unwrap();
    *current_dir = new_dir;

    Ok(())
}

#[tauri::command]
fn read_pr_file(path: String) -> Result<String, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(e) => return Err(format!("Failed to read file: {}", e)),
    };

    Ok(content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            current_dir: Mutex::new(String::new()),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pr_files,
            set_directory,
            read_pr_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
