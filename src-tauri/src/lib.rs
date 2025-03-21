mod filesystem;

use std::time::Instant;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::State;
use filesystem::FileSystem;

#[tauri::command]
fn greet(name: &str) -> String {
    let start = Instant::now();
    let result = format!("Hello, {}! You've been greeted from Rust!", name);
    println!("Performance: greet took {:?}", start.elapsed());
    result
}

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

#[tauri::command]
fn get_pr_files(fs: State<FileSystem>) -> Result<Vec<PrFile>, String> {
    let start = Instant::now();

    // Get and parse the index
    let index_content = fs.get_index_content()?;
    let index_entries = fs.parse_json::<PrIndex>(&index_content)?;

    // Get the temp directory path for file paths
    let temp_dir = fs.ensure_extracted()?;

    // Create files from index
    let mut files = Vec::with_capacity(index_entries.len());
    for entry in index_entries {
        let pr_path = temp_dir.join("prs").join(&entry.filename);
        let path_str = pr_path.to_string_lossy().to_string();
        let pr_number = entry.id.to_string();

        files.push(PrFile {
            filename: entry.filename,
            path: path_str,
            pr_number: pr_number,
            num: entry.id,
        });
    }

    // Sort by PR number descending
    files.sort_by(|a, b| b.num.cmp(&a.num));

    println!("Performance: get_pr_files successful with {} files in {:?}",
             files.len(), start.elapsed());

    Ok(files)
}

#[tauri::command]
fn set_archive_file(new_archive: String, fs: State<FileSystem>) -> Result<(), String> {
    let start = Instant::now();
    let result = fs.set_archive(&new_archive);
    println!("Performance: set_archive_file completed in {:?}", start.elapsed());
    result
}

#[tauri::command]
fn read_pr_file(path: String, fs: State<FileSystem>) -> Result<String, String> {
    fs.read_file(&path)
}

#[tauri::command]
fn get_index_content(fs: State<FileSystem>) -> Result<String, String> {
    fs.get_index_content()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(FileSystem::new())
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