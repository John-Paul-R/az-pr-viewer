// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Seek};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;
use flate2::read::GzDecoder;
use tar::Archive;
use std::io::prelude::*;
use tempfile::tempdir;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PrFile {
    filename: String,
    path: String,
    pr_number: String,
    num: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct PrIndexEntry {
    id: i32,
    title: String,
    created_by: String,
    creation_date: String,
    status: String,
    repository: String,
    source_branch: String,
    target_branch: String,
    filename: String,
}

// The index is just an array of entries
type PrIndex = Vec<PrIndexEntry>;

struct AppState {
    archive_path: Mutex<String>,
    temp_dir: Mutex<Option<tempfile::TempDir>>,
}

#[tauri::command]
fn get_pr_files(state: State<AppState>) -> Result<Vec<PrFile>, String> {
    let archive_path = state.archive_path.lock().unwrap();

    if archive_path.is_empty() {
        return Err("No archive file selected".to_string());
    }

    let path = Path::new(&*archive_path);
    if !path.exists() {
        return Err(format!("Archive file does not exist: {}", archive_path));
    }

    // First, make sure we have an extracted temp directory
    let temp_dir = {
        let mut temp_dir_guard = state.temp_dir.lock().unwrap();
        if temp_dir_guard.is_none() {
            // Extract the archive if not already done
            let extracted_dir = extract_archive(&archive_path)?;
            *temp_dir_guard = Some(extracted_dir);
        }
        temp_dir_guard.as_ref().unwrap().path().to_path_buf()
    };

    // Find and read the index file
    let index_files = fs::read_dir(&temp_dir)
        .map_err(|e| format!("Failed to read temp directory: {}", e))?
        .filter_map(Result::ok)
        .filter(|entry| {
            let path = entry.path();
            if let Some(file_name) = path.file_name() {
                let name = file_name.to_string_lossy();
                name.starts_with("pr_index_") && name.ends_with(".json")
            } else {
                false
            }
        })
        .collect::<Vec<_>>();

    if index_files.is_empty() {
        return Err("Index file not found in archive".to_string());
    }

    // Use the first found index file
    let index_path = index_files[0].path();
    let index_content = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read index file: {}", e))?;

    // Parse the index or fallback to scanning
    let mut files = Vec::new();

    match serde_json::from_str::<PrIndex>(&index_content) {
        Ok(index_entries) => {
            // Use index to populate files
            for entry in index_entries {
                let pr_path = temp_dir.join("prs").join(&entry.filename);
                let path_str = pr_path.to_string_lossy().to_string();
                let pr_number = entry.id.to_string();

                files.push(PrFile {
                    filename: entry.filename,
                    path: path_str,
                    pr_number: pr_number.clone(),
                    num: entry.id,
                });
            }
        },
        Err(e) => {
            return Err(format!("Failed to parse index file: {}", e));
        }
    }

    files.sort_by(|a, b| b.num.cmp(&a.num));

    Ok(files)
}

fn extract_archive(archive_path: &str) -> Result<tempfile::TempDir, String> {
    // Create a temporary directory
    let temp_dir = tempdir().map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Open the .tar.gz file
    let tar_gz = fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive file: {}", e))?;

    // Decompress the gzip
    let tar = GzDecoder::new(tar_gz);

    // Extract the archive
    let mut archive = Archive::new(tar);
    archive.unpack(temp_dir.path())
        .map_err(|e| format!("Failed to extract archive: {}", e))?;

    Ok(temp_dir)
}

#[tauri::command]
fn set_archive_file(new_archive: String, state: State<AppState>) -> Result<(), String> {
    let path = Path::new(&new_archive);

    if !path.exists() {
        return Err(format!("Archive file does not exist: {}", new_archive));
    }

    if !path.is_file() {
        return Err(format!("Not a file: {}", new_archive));
    }

    // Make sure it's a .tar.gz file
    if path.extension().map_or(true, |ext| ext != "gz") {
        return Err(format!("Not a .tar.gz file: {}", new_archive));
    }

    // Clear any existing temp directory
    {
        let mut temp_dir_guard = state.temp_dir.lock().unwrap();
        *temp_dir_guard = None;
    }

    // Update the archive path
    let mut archive_path = state.archive_path.lock().unwrap();
    *archive_path = new_archive;

    Ok(())
}

#[tauri::command]
fn read_pr_file(path: String, state: State<AppState>) -> Result<String, String> {
    // Check if we have an extracted archive
    let temp_dir = {
        let mut temp_dir_guard = state.temp_dir.lock().unwrap();

        // If no temp directory exists, we need to extract the archive first
        if temp_dir_guard.is_none() {
            let archive_path = state.archive_path.lock().unwrap();
            if archive_path.is_empty() {
                return Err("No archive file selected".to_string());
            }

            // Extract the archive
            let extracted_dir = extract_archive(&archive_path)?;
            *temp_dir_guard = Some(extracted_dir);
        }

        // Get a path to the temp directory
        temp_dir_guard.as_ref().unwrap().path().to_path_buf()
    };

    // The path should now be a path relative to the extracted contents
    // If it's an absolute path (from PrFile.path), we'll use it directly
    let file_path = if Path::new(&path).is_absolute() {
        Path::new(&path).to_path_buf()
    } else {
        // For relative paths, join with the temp directory
        temp_dir.join(&path)
    };

    // Read the file content
    let content = match fs::read_to_string(&file_path) {
        Ok(content) => content,
        Err(e) => return Err(format!("Failed to read file '{}': {}", file_path.display(), e)),
    };

    Ok(content)
}

#[tauri::command]
fn get_index_content(state: State<AppState>) -> Result<String, String> {
    let archive_path = state.archive_path.lock().unwrap();

    if archive_path.is_empty() {
        return Err("No archive file selected".to_string());
    }

    // Make sure we have an extracted temp directory
    let temp_dir = {
        let mut temp_dir_guard = state.temp_dir.lock().unwrap();
        if temp_dir_guard.is_none() {
            // Extract the archive if not already done
            let extracted_dir = extract_archive(&archive_path)?;
            *temp_dir_guard = Some(extracted_dir);
        }
        temp_dir_guard.as_ref().unwrap().path().to_path_buf()
    };

    // Find the index file
    let index_files = fs::read_dir(&temp_dir)
        .map_err(|e| format!("Failed to read temp directory: {}", e))?
        .filter_map(Result::ok)
        .filter(|entry| {
            let path = entry.path();
            if let Some(file_name) = path.file_name() {
                let name = file_name.to_string_lossy();
                name.starts_with("pr_index_") && name.ends_with(".json")
            } else {
                false
            }
        })
        .collect::<Vec<_>>();

    if index_files.is_empty() {
        return Err("Index file not found in archive".to_string());
    }

    // Use the first found index file
    let index_path = index_files[0].path();
    let content = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read index file: {}", e))?;

    Ok(content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            archive_path: Mutex::new(String::new()),
            temp_dir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pr_files,
            set_archive_file,
            read_pr_file,
            get_index_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}