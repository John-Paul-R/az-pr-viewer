use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Instant;
use std::fs;
use flate2::read::GzDecoder;
use tar::Archive;
use tempfile::TempDir;

pub struct FileSystem {
    archive_path: Mutex<String>,
    archive_content: Mutex<Option<Arc<Vec<u8>>>>,
    temp_dir: Mutex<Option<TempDir>>,
    file_cache: Mutex<HashMap<String, String>>,
}

impl FileSystem {
    pub fn new() -> Self {
        FileSystem {
            archive_path: Mutex::new(String::new()),
            archive_content: Mutex::new(None),
            temp_dir: Mutex::new(None),
            file_cache: Mutex::new(HashMap::new()),
        }
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

        if path_obj.extension().map_or(true, |ext| ext != "gz") {
            return Err(format!("Not a .tar.gz file: {}", path));
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
        let mut archive_content: std::sync::MutexGuard<'_, Option<Arc<Vec<u8>>>> = self.archive_content.lock().unwrap();
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

    pub fn ensure_extracted(&self) -> Result<PathBuf, String> {
        self.ensure_archive_loaded()?;

        let mut temp_dir_guard = self.temp_dir.lock().unwrap();
        if temp_dir_guard.is_none() {
            let extraction_start = Instant::now();

            // Get archive content from memory
            let archive_content = {
                let content_guard = self.archive_content.lock().unwrap();
                match &*content_guard {
                    Some(content) => Arc::clone(content),
                    None => return Err("Archive content not loaded".to_string()),
                }
            };

            // Create a temporary directory
            let temp_dir = tempfile::tempdir()
                .map_err(|e| format!("Failed to create temp directory: {}", e))?;

            // Create a cursor to read from memory
            let cursor = Cursor::new(&*archive_content);

            // Decompress and extract
            let tar = GzDecoder::new(cursor);
            let mut archive = Archive::new(tar);
            archive.unpack(temp_dir.path())
                .map_err(|e| format!("Failed to extract archive: {}", e))?;

            println!("Performance: extraction completed in {:?}", extraction_start.elapsed());
            *temp_dir_guard = Some(temp_dir);
        }

        Ok(temp_dir_guard.as_ref().unwrap().path().to_path_buf())
    }

    pub fn get_index_file(&self) -> Result<PathBuf, String> {
        let start = Instant::now();
        let temp_dir = self.ensure_extracted()?;

        let index_file = fs::read_dir(&temp_dir)
            .map_err(|e| format!("Failed to read temp directory: {}", e))?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .find_map(|path| {
                if let Some(file_name) = path.file_name() {
                    let name = file_name.to_string_lossy();
                    if name.starts_with("pr_index_") && name.ends_with(".json") {
                        return Some(path)
                    }
                }
                None
            });


        match index_file {
            Some(path) => {
                println!("Performance: get_index_file found '{}' in {:?}", path.to_string_lossy(), start.elapsed());
                Ok(path)
            },
            None => Err("Index file not found in archive".to_string()),
        }
    }

    pub fn read_file(&self, path: &str) -> Result<String, String> {
        let start = Instant::now();

        // Check cache first
        {
            let file_cache = self.file_cache.lock().unwrap();
            if let Some(path_basename) = Path::new(path).file_name() {
                let basename = path_basename.to_string_lossy().to_string();
                if let Some(content) = file_cache.get(&basename) {
                    println!("Performance: read_file served '{}' from cache in {:?}",
                             basename, start.elapsed());
                    return Ok(content.clone());
                }
            }
        }

        let temp_dir = self.ensure_extracted()?;

        // Resolve path
        let file_path = if Path::new(path).is_absolute() {
            Path::new(path).to_path_buf()
        } else {
            temp_dir.join(path)
        };

        // Read file content
        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file '{}': {}", file_path.display(), e))?;

        // Cache the content
        if let Some(file_name) = file_path.file_name() {
            let basename = file_name.to_string_lossy().to_string();
            let mut file_cache = self.file_cache.lock().unwrap();
            file_cache.insert(basename, content.clone());
        }

        println!("Performance: read_file '{}' ({} bytes) in {:?}",
                 file_path.display(), content.len(), start.elapsed());

        Ok(content)
    }

    pub fn get_index_content(&self) -> Result<String, String> {
        let start = Instant::now();

        // Check if we have it cached
        {
            let file_cache = self.file_cache.lock().unwrap();
            for (filename, content) in file_cache.iter() {
                if filename.starts_with("pr_index_") && filename.ends_with(".json") {
                    println!("Performance: get_index_content served from cache in {:?}", start.elapsed());
                    return Ok(content.clone());
                }
            }
        }

        // Find and read index file
        let index_file = self.get_index_file()?;
        let index_path = &index_file;
        let content = self.read_file(index_path.to_str().unwrap())?;

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