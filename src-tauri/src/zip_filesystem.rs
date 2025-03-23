use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::fs;
use tempfile::TempDir;
use zip::ZipArchive;

pub struct FileSystem {
    archive_path: Mutex<String>,
    archive_content: Mutex<Option<Arc<Vec<u8>>>>,
    temp_dir: Mutex<Option<TempDir>>,
    file_cache: Mutex<HashMap<String, String>>,
    extracted_files: Mutex<Vec<String>>,
}

impl FileSystem {
    pub fn new() -> Self {
        FileSystem {
            archive_path: Mutex::new(String::new()),
            archive_content: Mutex::new(None),
            temp_dir: Mutex::new(None),
            file_cache: Mutex::new(HashMap::new()),
            extracted_files: Mutex::new(Vec::new()),
        }
    }

    pub fn get_archive_path(&self) -> String {
        let guard = self.archive_path.lock();
        guard.expect("unexpected error while reading archive path").clone()
    }

    pub fn set_archive(&self, path: &str) -> Result<(), String> {
        let start = Instant::now();

        let path_obj = Path::new(path);
        if !path_obj.exists() {
            return Err(format!("Archive file does not exist: {}", path));
        }

        if !path_obj.is_file() {
            return Err(format!("Not a file: {}", path));
        }

        if path_obj.extension().map_or(true, |ext| ext != "zip") {
            return Err(format!("Not a .zip file: {}", path));
        }

        // Load the archive into memory
        let content = fs::read(path_obj)
            .map_err(|e| format!("Failed to read archive file: {}", e))?;
        let content_size = content.len();

        // Clear existing data
        {
            let mut temp_dir_guard = self.temp_dir.lock().unwrap();
            *temp_dir_guard = None;

            let mut file_cache = self.file_cache.lock().unwrap();
            file_cache.clear();

            let mut extracted_files = self.extracted_files.lock().unwrap();
            extracted_files.clear();
        }

        // Update archive path and content
        {
            let mut archive_path = self.archive_path.lock().unwrap();
            *archive_path = path.to_string();

            let mut archive_content = self.archive_content.lock().unwrap();
            *archive_content = Some(Arc::new(content));
        }

        println!("Performance: set_archive loaded {} bytes in {:?}", content_size, start.elapsed());
        Ok(())
    }

    pub fn ensure_archive_loaded(&self) -> Result<(), String> {
        let start = Instant::now();
        let archive_path = self.archive_path.lock().unwrap().clone();

        if archive_path.is_empty() {
            return Err("No archive file selected".to_string());
        }

        // Check if already loaded
        let mut archive_content = self.archive_content.lock().unwrap();
        if archive_content.is_none() {
            // Load the archive content into memory
            let path = Path::new(&archive_path);
            let content = fs::read(path)
                .map_err(|e| format!("Failed to read archive file: {}", e))?;

            let content_size = content.len();
            *archive_content = Some(Arc::new(content));
            println!("Performance: loaded archive into memory ({} bytes) in {:?}",
                     content_size, start.elapsed());
        }

        Ok(())
    }

    pub fn ensure_temp_dir(&self) -> Result<PathBuf, String> {
        let mut temp_dir_guard = self.temp_dir.lock().unwrap();
        if temp_dir_guard.is_none() {
            // Create a temporary directory
            let temp_dir = tempfile::tempdir()
                .map_err(|e| format!("Failed to create temp directory: {}", e))?;
            *temp_dir_guard = Some(temp_dir);
        }

        Ok(temp_dir_guard.as_ref().unwrap().path().to_path_buf())
    }

    pub fn extract_file(&self, file_path: &str) -> Result<PathBuf, String> {
        self.ensure_archive_loaded()?;
        let extraction_start = Instant::now();

        // Get archive content from memory
        let archive_content = {
            let content_guard = self.archive_content.lock().unwrap();
            match &*content_guard {
                Some(content) => Arc::clone(content),
                None => return Err("Archive content not loaded".to_string()),
            }
        };

        // Get or create temporary directory
        let temp_dir = self.ensure_temp_dir()?;

        // Check if file is already extracted
        {
            let extracted_files = self.extracted_files.lock().unwrap();
            if extracted_files.contains(&file_path.to_string()) {
                let full_path = temp_dir.join(file_path);
                if full_path.exists() {
                    println!("Performance: file '{}' already extracted, skipping", file_path);
                    return Ok(full_path);
                }
            }
        }

        // Create a cursor to read from memory
        let cursor = Cursor::new(&*archive_content);

        // Create ZIP archive reader
        let mut archive = ZipArchive::new(cursor)
            .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

        // Try to find the file
        let file_index = archive.file_names()
            .position(|name| name == file_path)
            .ok_or_else(|| format!("File not found in ZIP archive: {}", file_path))?;

        // Extract only the specific file
        let mut zip_file = archive.by_index(file_index)
            .map_err(|e| format!("Failed to access file in ZIP: {}", e))?;

        // Create parent directories if needed
        let output_path = temp_dir.join(file_path);
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }

        // Extract the file
        let mut outfile = fs::File::create(&output_path)
            .map_err(|e| format!("Failed to create output file: {}", e))?;

        std::io::copy(&mut zip_file, &mut outfile)
            .map_err(|e| format!("Failed to extract file: {}", e))?;

        // Add to extracted files list
        {
            let mut extracted_files = self.extracted_files.lock().unwrap();
            extracted_files.push(file_path.to_string());
        }

        println!("Performance: extracted file '{}' in {:?}", file_path, extraction_start.elapsed());
        Ok(output_path)
    }

    pub fn read_file(&self, path: &str) -> Result<String, String> {
        let start = Instant::now();

        // Check cache first
        {
            let file_cache = self.file_cache.lock().unwrap();
            if let Some(content) = file_cache.get(path) {
                println!("Performance: read_file served '{}' from cache in {:?}",
                         path, start.elapsed());
                return Ok(content.clone());
            }
        }

        // Try to extract and read the file
        let file_path = self.extract_file(path)?;

        // Read the extracted file
        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file '{}': {}", file_path.display(), e))?;

        // Cache the content
        {
            let mut file_cache = self.file_cache.lock().unwrap();
            file_cache.insert(path.to_string(), content.clone());
        }

        println!("Performance: read_file '{}' ({} bytes) in {:?}",
                 path, content.len(), start.elapsed());

        Ok(content)
    }

    pub fn read_file_from_memory(&self, path: &str) -> Result<String, String> {
        let start = Instant::now();

        // Check cache first
        {
            let file_cache = self.file_cache.lock().unwrap();
            if let Some(content) = file_cache.get(path) {
                println!("Performance: read_file_from_memory served '{}' from cache in {:?}",
                         path, start.elapsed());
                return Ok(content.clone());
            }
        }

        self.ensure_archive_loaded()?;

        // Get archive content from memory
        let archive_content = {
            let content_guard = self.archive_content.lock().unwrap();
            match &*content_guard {
                Some(content) => Arc::clone(content),
                None => return Err("Archive content not loaded".to_string()),
            }
        };

        // Create a cursor to read from memory
        let cursor = Cursor::new(&*archive_content);

        // Create ZIP archive reader
        let mut archive = ZipArchive::new(cursor)
            .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

        // Try to find the file
        let mut zip_file = archive.by_name(path)
            .map_err(|e| format!("Failed to find file in ZIP: {}", e))?;

        // Read file content directly to string
        let mut content = String::new();
        zip_file.read_to_string(&mut content)
            .map_err(|e| format!("Failed to read file from ZIP: {}", e))?;

        // Cache the content
        {
            let mut file_cache = self.file_cache.lock().unwrap();
            file_cache.insert(path.to_string(), content.clone());
        }

        println!("Performance: read_file_from_memory '{}' ({} bytes) in {:?}",
                 path, content.len(), start.elapsed());

        Ok(content)
    }

    pub fn list_files(&self) -> Result<Vec<String>, String> {
        self.ensure_archive_loaded()?;
        let start = Instant::now();

        // Get archive content from memory
        let archive_content = {
            let content_guard = self.archive_content.lock().unwrap();
            match &*content_guard {
                Some(content) => Arc::clone(content),
                None => return Err("Archive content not loaded".to_string()),
            }
        };

        // Create a cursor to read from memory
        let cursor = Cursor::new(&*archive_content);

        // Create ZIP archive reader
        let archive = ZipArchive::new(cursor)
            .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

        // Collect all file names
        let files: Vec<String> = archive.file_names().map(String::from).collect();

        println!("Performance: list_files found {} files in {:?}", files.len(), start.elapsed());

        Ok(files)
    }

    pub fn get_index_file(&self) -> Result<String, String> {
        let start = Instant::now();

        // List all files in the archive
        let files = self.list_files()?;

        // Find index file
        let index_file = files.iter()
            .find(|name| name.starts_with("pr_index_") && name.ends_with(".json"))
            .ok_or_else(|| "Index file not found in archive".to_string())?;

        println!("Performance: get_index_file found '{}' in {:?}", index_file, start.elapsed());

        Ok(index_file.clone())
    }

    pub fn get_index_content(&self) -> Result<String, String> {
        let start = Instant::now();

        // Check if we have it cached in file_cache
        {
            let file_cache = self.file_cache.lock().unwrap();
            for (filename, content) in file_cache.iter() {
                if filename.starts_with("pr_index_") && filename.ends_with(".json") {
                    println!("Performance: get_index_content served from cache in {:?}", start.elapsed());
                    return Ok(content.clone());
                }
            }
        }

        // Find index file
        let index_file = self.get_index_file()?;

        // Read index file directly from memory for better performance
        let content = self.read_file_from_memory(&index_file)?;

        println!("Performance: get_index_content completed in {:?}", start.elapsed());

        Ok(content)
    }

    pub fn parse_json<T>(&self, content: &str) -> Result<T, String>
    where
        T: serde::de::DeserializeOwned,
    {
        let start = Instant::now();

        let result = serde_json::from_str::<T>(content)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;

        println!("Performance: JSON parsing completed in {:?}", start.elapsed());

        Ok(result)
    }
}