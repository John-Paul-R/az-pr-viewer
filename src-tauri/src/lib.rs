mod filesystem;
mod search;

use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::State;
use filesystem::FileSystem;
use search::SearchIndex;

#[tauri::command(async)]
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
    title: Option<String>,
    author: Option<String>,
    status: Option<String>,
    creation_date: Option<String>,
    repository: Option<String>,
    source_branch: Option<String>,
    target_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    fs: FileSystem,
    search: SearchIndex,
}

#[tauri::command(async)]
fn get_pr_files(state: State<AppState>) -> Result<Vec<PrFile>, String> {
    let start = Instant::now();

    // Get and parse the index
    let index_content = state.fs.get_index_content()?;
    let index_entries = state.fs.parse_json::<PrIndex>(&index_content)?;

    // Rebuild search index if needed
    if !state.search.is_initialized() {
        state.search.rebuild_index(&index_entries)?;
    }

    // Get the temp directory path for file paths
    let temp_dir = state.fs.ensure_extracted()?;

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
            title: Some(entry.title),
            author: Some(entry.created_by),
            status: Some(entry.status),
            creation_date: Some(entry.creation_date),
            repository: Some(entry.repository),
            source_branch: Some(entry.source_branch),
            target_branch: Some(entry.target_branch),
        });
    }

    // Sort by PR number descending
    files.sort_by(|a, b| b.num.cmp(&a.num));

    println!("Performance: get_pr_files successful with {} files in {:?}",
             files.len(), start.elapsed());

    Ok(files)
}

#[tauri::command(async)]
fn search_prs(query: String, state: State<AppState>) -> Result<Vec<PrFile>, String> {
    let start = Instant::now();

    // Make sure we have an initialized search index
    if !state.search.is_initialized() {
        // Get and parse the index to build the search index
        let index_content = state.fs.get_index_content()?;
        let index_entries = state.fs.parse_json::<PrIndex>(&index_content)?;
        state.search.rebuild_index(&index_entries)?;
    }

    // Search for matching PRs
    let results = state.search.search(&query)?;

    // Get the temp directory path for file paths
    let temp_dir = state.fs.ensure_extracted()?;

    // Convert results to PrFile objects
    let mut files = Vec::with_capacity(results.len());
    for entry in results {
        let pr_path = temp_dir.join("prs").join(&entry.filename);
        let path_str = pr_path.to_string_lossy().to_string();
        let pr_number = entry.id.to_string();

        files.push(PrFile {
            filename: entry.filename,
            path: path_str,
            pr_number: pr_number,
            num: entry.id,
            title: Some(entry.title),
            author: Some(entry.created_by),
            status: Some(entry.status),
            creation_date: Some(entry.creation_date),
            repository: Some(entry.repository),
            source_branch: Some(entry.source_branch),
            target_branch: Some(entry.target_branch),
        });
    }

    println!("Performance: search_prs found {} matches for '{}' in {:?}",
             files.len(), query, start.elapsed());

    Ok(files)
}

#[tauri::command(async)]
fn set_archive_file(new_archive: String, state: State<AppState>) -> Result<(), String> {
    let start = Instant::now();

    // Set the archive in the filesystem
    let result = state.fs.set_archive(&new_archive);

    // Clear the search index to force rebuild on next search
    if result.is_ok() {
        // We'll rebuild the search index when needed
    }

    println!("Performance: set_archive_file completed in {:?}", start.elapsed());
    result
}

#[tauri::command(async)]
fn read_pr_file(path: String, state: State<AppState>) -> Result<String, String> {
    state.fs.read_file(&path)
}

#[tauri::command(async)]
fn get_index_content(state: State<AppState>) -> Result<String, String> {
    state.fs.get_index_content()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            fs: FileSystem::new(),
            search: SearchIndex::new(),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pr_files,
            set_archive_file,
            read_pr_file,
            get_index_content,
            search_prs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}