mod zip_filesystem;
mod search;
mod git_lines;
mod git_commit;
mod git_diff;

use std::{sync::Arc, time::Instant};
use git2::Repository;
use git_commit::{get_commit_metadata, CommitMetadata};
use git_diff::{get_tree_diff_between_revisions, get_filtered_tree_diff, TreeDiff};
use git_lines::{get_file_diff_as_strings, get_file_lines_at_revision};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{async_runtime::Mutex, http::HeaderValue, Manager, State, UriSchemeContext, Wry};
use zip_filesystem::FileSystem;
use search::SearchIndex;
use memory_stats::memory_stats;

fn log_memory_usage(label: &str) {
    if let Some(usage) = memory_stats() {
        println!("Memory usage at {}: Physical: {} MB, Virtual: {} MB", 
                 label, 
                 usage.physical_mem / (1024 * 1024), 
                 usage.virtual_mem / (1024 * 1024));
    } else {
        println!("Memory stats not available");
    }
}

#[tauri::command(async)]
fn greet(name: &str) -> String {
    let start = Instant::now();
    let result = format!("Hello, {}! You've been greeted from Rust!", name);
    println!("Performance: greet took {:?}", start.elapsed());
    result
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PrFile {
    archive_path: String,
    pr_number: i32,
    title: String,
    author: String,
    status: String,
    creation_date: String,
    source_branch: String,
    target_branch: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PrIndexEntry {
    id: i32,
    title: String,
    created_by: String,
    creation_date: String,
    status: String,
    source_branch: String,
    target_branch: String,
    filename: String,
}

// The index is just an array of entries
type PrIndex = Vec<PrIndexEntry>;

struct AppState {
    fs: FileSystem,                          // Main archive for PR data
    images_fs: FileSystem,                   // Separate archive for images
    search: SearchIndex,
    repo: Arc<Mutex<Option<Repository>>>,
}

// Helper function to convert index entries to PrFile objects
fn index_entries_to_pr_files(entries: Vec<PrIndexEntry>) -> Vec<PrFile> {
    let mut files = Vec::with_capacity(entries.len());

    for entry in entries {
        // Construct the PR path relative to the archive (for future reference)
        let pr_path = format!("prs/{}", entry.filename);

        files.push(PrFile {
            archive_path: pr_path,
            pr_number: entry.id,
            title: entry.title,
            author: entry.created_by,
            status: entry.status,
            creation_date: entry.creation_date,
            source_branch: entry.source_branch,
            target_branch: entry.target_branch,
        });
    }

    files
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

    // Create files from index using the extracted function
    let mut files = index_entries_to_pr_files(index_entries);

    // Sort by PR number descending
    files.sort_by(|a, b| b.pr_number.cmp(&a.pr_number));

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

    // Create files from search results using the extracted function
    let files = index_entries_to_pr_files(results);

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
fn set_images_archive_file(new_archive: String, state: State<AppState>) -> Result<(), String> {
    let start = Instant::now();

    // Set the archive in the images filesystem
    let result = state.images_fs.set_archive(&new_archive);

    println!("Performance: set_images_archive_file completed in {:?}", start.elapsed());
    result
}

#[tauri::command(async)]
async fn get_archive_path(
    state: State<'_, AppState>
) -> Result<String, String> {
    Ok(state.fs.get_archive_path())
}

#[tauri::command(async)]
async fn get_images_archive_path(
    state: State<'_, AppState>
) -> Result<String, String> {
    Ok(state.images_fs.get_archive_path())
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

#[tauri::command(async)]
async fn get_git_repo(
    state: State<'_, AppState>
) -> Result<String, String> {
    let repo_guard = state.repo.lock().await;
    Ok(match *repo_guard {
        Some(ref repo) => {
            repo.path().to_str()
                .map(|s|
                    if let Some(index) = s.find("/.git") {
                        &s[0..index]
                    } else {
                        s
                    }
                )
                .unwrap_or("")
        }
        None => ""
    }.to_owned())
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

#[tauri::command(async)]
async fn git_get_tree_diff_between_revisions(
    from_revision: String,
    to_revision: String,
    state: State<'_, AppState>
) -> Result<TreeDiff, String> {
    let repo_lock = state.repo.lock().await;

    match &*repo_lock {
        Some(r) => {
            get_tree_diff_between_revisions(
                r,
                &from_revision,
                &to_revision
            )
                .map_err(|err| err.to_string())
        },
        None => Err("No repository selected".to_string()),
    }
}

#[tauri::command(async)]
async fn git_get_filtered_tree_diff(
    from_revision: String,
    to_revision: String,
    file_pattern: String,
    state: State<'_, AppState>
) -> Result<TreeDiff, String> {
    let repo_lock = state.repo.lock().await;

    match &*repo_lock {
        Some(r) => {
            get_filtered_tree_diff(
                r,
                &from_revision,
                &to_revision,
                &file_pattern,
            )
                .map_err(|err| err.to_string())
        },
        None => Err("No repository selected".to_string()),
    }
}

// Define the InitialState struct
pub struct InitialState {
    pub archive_path: Option<String>,
    pub images_archive_path: Option<String>,
    pub repo_path: Option<String>,
    // You can easily add more initialization parameters in the future
}

// Implement Default to make it easier to work with
impl Default for InitialState {
    fn default() -> Self {
        Self {
            archive_path: None,
            images_archive_path: None,
            repo_path: None,
        }
    }
}

// Helper function to initialize a file system with an optional archive path
fn initialize_filesystem(archive_path: &Option<String>, archive_type: &str) -> Result<FileSystem, String> {
    let fs = FileSystem::new();

    if let Some(path) = archive_path {
        fs.set_archive(path)?;
        println!("{} archive set to: {}", archive_type, path);
    }

    Ok(fs)
}

// Helper function to initialize a git repository from a path
fn initialize_git_repo(repo_path: &Option<String>) -> Result<Option<Repository>, String> {
    match repo_path {
        Some(path) => {
            match Repository::open(path) {
                Ok(r) => {
                    println!("Git repository set to: {}", path);
                    Ok(Some(r))
                },
                Err(e) => {
                    Err(format!("Failed to open git repository '{}': {}", path, e))
                }
            }
        }
        None => Ok(None),
    }
}

// Helper function to create the AppState from initialized components
fn create_app_state(
    fs: FileSystem,
    images_fs: FileSystem,
    repo_option: Option<Repository>
) -> AppState {
    AppState {
        fs,                              // Main PR data archive
        images_fs,                       // Separate images archive
        search: SearchIndex::new(),
        repo: Arc::new(Mutex::new(repo_option)),
    }
}

// Helper function to handle zip image protocol requests
fn handle_zip_image_protocol<'a>(
    ctx: UriSchemeContext<'a, Wry>,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    // Get the state from the app handle
    let state = ctx.app_handle().state::<AppState>();

    // Strip the scheme prefix to get the image path
    let uri = request.uri().to_string();
    let image_path = uri.strip_prefix("zip-image://")
        .unwrap_or_default()
        .to_string();

    // Use the existing get_image_from_index logic but extract just what we need
    // First, get the images index file
    let index_content = match state.images_fs.read_file_from_memory("image_index.json") {
        Ok(content) => content,
        Err(e) => {
            println!("Failed to read images index: {}", e);
            return tauri::http::Response::builder()
                .status(404)
                .body(Vec::new())
                .unwrap();
        }
    };

    // Parse the index
    let index: Value = match serde_json::from_str(&index_content) {
        Ok(idx) => idx,
        Err(e) => {
            println!("Failed to parse images index JSON: {}", e);
            return tauri::http::Response::builder()
                .status(500)
                .body(Vec::new())
                .unwrap();
        }
    };

    // Look up the requested path in the index
    let index_obj = match index.as_object() {
        Some(obj) => obj,
        None => {
            println!("Images index is not a valid JSON object");
            return tauri::http::Response::builder()
                .status(500)
                .body(Vec::new())
                .unwrap();
        }
    };

    // Get the actual path in the zip file
    let actual_path = match index_obj.get(&format!("{}{}", "https://", &image_path)) {
        Some(path_value) => match path_value.as_str() {
            Some(path) => path,
            None => {
                println!("Path value for '{}' is not a string", image_path);
                return tauri::http::Response::builder()
                    .status(400)
                    .body(Vec::new())
                    .unwrap();
            }
        },
        None => {
            println!("Image path '{}' not found in index", image_path);
            return tauri::http::Response::builder()
                .status(404)
                .body(Vec::new())
                .unwrap();
        }
    };

    println!("Image protocol request: '{}' maps to '{}'", image_path, actual_path);

    // Read the binary image data
    let image_data = match state.images_fs.read_binary_file_from_memory(actual_path) {
        Ok(data) => data,
        Err(e) => {
            println!("Failed to read image file: {}", e);
            return tauri::http::Response::builder()
                .status(500)
                .body(Vec::new())
                .unwrap();
        }
    };

    // Try to determine MIME type from the requested path (for correct browser rendering)
    let mime_type = if image_path.ends_with(".png") {
        "image/png"
    } else if image_path.ends_with(".jpg") || image_path.ends_with(".jpeg") {
        "image/jpeg"
    } else if image_path.ends_with(".gif") {
        "image/gif"
    } else if image_path.ends_with(".svg") {
        "image/svg+xml"
    } else {
        "application/octet-stream"
    };

    let mut res = tauri::http::Response::new(image_data);
    // Set the Content-Type header safely
    match HeaderValue::from_str(mime_type) {
        Ok(header_value) => {
            res.headers_mut().insert("Content-Type", header_value);
        },
        Err(_) => {
            // If we can't create a header value, just use a default
            if let Ok(default_value) = HeaderValue::from_str("application/octet-stream") {
                res.headers_mut().insert("Content-Type", default_value);
            }
        }
    };

    res
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(initial_state: Option<InitialState>) -> Result<(), String> {
    log_memory_usage("start of run");
    
    // Use provided initial state or create a default one
    let initial_state = initial_state.unwrap_or_default();
    log_memory_usage("after unwrapping initial state");

    // Initialize components using our helper functions
    let fs = initialize_filesystem(&initial_state.archive_path, "PR")?;
    log_memory_usage("after initializing PR filesystem");
    
    let images_fs = initialize_filesystem(&initial_state.images_archive_path, "Images")?;
    log_memory_usage("after initializing Images filesystem");
    
    let repo_option = initialize_git_repo(&initial_state.repo_path)?;
    log_memory_usage("after initializing git repo");

    // Create the application state
    let app_state = create_app_state(fs, images_fs, repo_option);
    log_memory_usage("after creating app state");

    // Build and run the application with the initialized state
    log_memory_usage("before creating Tauri builder");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .register_uri_scheme_protocol("zip-image", handle_zip_image_protocol)
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            get_pr_files,
            set_archive_file,
            read_pr_file,
            search_prs,
            list_files,
            set_git_repo,
            get_git_commit,
            get_git_file_lines_at_revision,
            git_get_file_diff_between_revisions,
            git_get_tree_diff_between_revisions,
            git_get_filtered_tree_diff,
            get_git_repo,
            get_archive_path,
            get_images_archive_path,
            set_images_archive_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    log_memory_usage("end of run (should not reach here in normal execution)");
    Ok(())
}