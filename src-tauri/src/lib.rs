mod zip_filesystem;
mod search;
mod git_lines;
mod git_commit;

use std::{sync::Arc, time::Instant};
use git2::Repository;
use git_commit::{get_commit_metadata, CommitMetadata};
use git_lines::{get_file_diff_as_strings, get_file_lines_at_revision};
use serde::{Deserialize, Serialize};
use tauri::{async_runtime::Mutex, State};
use zip_filesystem::FileSystem;
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
    repo: Arc<Mutex<Option<Repository>>>,
}

impl AppState {
    fn new(fs: FileSystem, search: SearchIndex) -> Self {
        Self {
            fs,
            search,
            repo: Arc::new(Mutex::new(None)),
        }
    }
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

    // Create files from index without extracting files
    let mut files = Vec::with_capacity(index_entries.len());
    for entry in index_entries {
        // Construct the PR path relative to the archive (for future reference)
        let pr_path = format!("prs/{}", entry.filename);
        let pr_number = entry.id.to_string();

        files.push(PrFile {
            filename: entry.filename.clone(),
            path: pr_path,  // Store the relative path within the archive
            pr_number,
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

    // Create files from search results without extracting files
    let mut files = Vec::with_capacity(results.len());
    for entry in results {
        // Construct the PR path relative to the archive
        let pr_path = format!("prs/{}", entry.filename);
        let pr_number = entry.id.to_string();

        files.push(PrFile {
            filename: entry.filename.clone(),
            path: pr_path,  // Store the relative path within the archive
            pr_number,
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
    // For better performance, try to read directly from memory if possible
    match state.fs.read_file_from_memory(&path) {
        Ok(content) => Ok(content),
        // Fall back to extracting and reading the file
        Err(_) => state.fs.read_file(&path)
    }
}

#[tauri::command(async)]
fn get_index_content(state: State<AppState>) -> Result<String, String> {
    state.fs.get_index_content()
}

#[tauri::command(async)]
fn list_files(state: State<AppState>) -> Result<Vec<String>, String> {
    state.fs.list_files()
}

#[tauri::command(async)]
async fn set_git_repo(
    file_path: String,
    state: State<'_, AppState>
) -> Result<String, String> {
    let repo = Repository::open(file_path);
    match repo {
        Ok(r) => {
            // Lock the mutex and update the option
            let mut repo_guard = state.repo.lock().await;
            *repo_guard = Some(r);
            Ok("OK".to_string())
        },
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
async fn get_git_commit(
    revision: String,
    state: State<'_, AppState>
) -> Result<CommitMetadata, String> {
    let repo_lock = state.repo.lock().await;
    match &*repo_lock {
        Some(r) => {
            get_commit_metadata(r, &revision)
                .map_err(|err| err.to_string())
        },
        None => Err("No repository selected".to_string()),
    }
}

#[tauri::command(async)]
async fn get_git_file_lines_at_revision(
    file_path: String,
    revision: String,
    start_line: usize,
    end_line: usize,
    state: State<'_, AppState>
) -> Result<Vec<String>, String> {
    let repo_lock = state.repo.lock().await;

    match &*repo_lock {
        Some(r) => {
            get_file_lines_at_revision(r, &file_path, &revision, std::ops::Range { start: start_line, end: end_line })
                .map_err(|err| err.to_string())
        },
        None => Err("No repository selected".to_string()),
    }
}

#[tauri::command(async)]
async fn git_get_file_diff_between_revisions(
    file_path: String,
    from_revision: String,
    to_revision: String,
    start_line: usize,
    end_line: usize,
    state: State<'_, AppState>
) -> Result<String, String> {
    let repo_lock = state.repo.lock().await;

    match &*repo_lock {
        Some(r) => {
            get_file_diff_as_strings(
                r,
                &file_path,
                &from_revision,
                &to_revision,
                std::ops::Range { start: start_line, end: end_line }
            )
                .map_err(|err| err.to_string())
        },
        None => Err("No repository selected".to_string()),
    }
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
            repo: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pr_files,
            set_archive_file,
            read_pr_file,
            get_index_content,
            search_prs,
            list_files,
            set_git_repo,
            get_git_commit,
            get_git_file_lines_at_revision,
            git_get_file_diff_between_revisions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}