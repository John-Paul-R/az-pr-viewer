use git2::{Repository, ObjectType, Oid};
use std::io::{self, BufRead};
use std::ops::Range;
use std::path::Path;

/// Error type for file line retrieval operations
#[derive(Debug)]
pub enum FileLineError {
    Git(git2::Error),
    Io(io::Error),
    InvalidRange,
    FileNotFound,
    RevisionNotFound,
}

impl From<git2::Error> for FileLineError {
    fn from(err: git2::Error) -> Self {
        FileLineError::Git(err)
    }
}

impl From<io::Error> for FileLineError {
    fn from(err: io::Error) -> Self {
        FileLineError::Io(err)
    }
}

impl std::fmt::Display for FileLineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileLineError::Git(err) => write!(f, "Git error: {}", err),
            FileLineError::Io(err) => write!(f, "IO error: {}", err),
            FileLineError::InvalidRange => write!(f, "Invalid line range"),
            FileLineError::FileNotFound => write!(f, "File not found in the specified revision"),
            FileLineError::RevisionNotFound => write!(f, "Revision not found"),
        }
    }
}

impl std::error::Error for FileLineError {}

/// Retrieves specific lines from a file at a specific Git revision using libgit2.
///
/// # Arguments
///
/// * `repo_path` - Path to the Git repository
/// * `file_path` - Path to the file within the repository
/// * `revision` - Git revision (commit hash, branch name, tag, etc.)
/// * `line_range` - Range of lines to retrieve (1-based, inclusive start, inclusive end)
///
/// # Returns
///
/// * `Result<Vec<String>, FileLineError>` - The requested lines or an error
///
pub fn get_file_lines_at_revision(
    repo: &Repository,
    file_path: &str,
    revision: &str,
    line_range: Range<usize>,
) -> Result<Vec<String>, FileLineError> {
    // Validate the range
    if line_range.start < 1 || line_range.start > line_range.end {
        return Err(FileLineError::InvalidRange);
    }

    // Open the repository
    // let repo = Repository::open(repo_path)?;

    // Resolve the revision to a commit
    let obj = match repo.revparse_single(revision) {
        Ok(obj) => obj,
        Err(_) => return Err(FileLineError::RevisionNotFound),
    };

    // Get the commit from the revision
    let commit = match obj.as_commit() {
        Some(commit) => commit.clone(),
        None => {
            // If it's not directly a commit (e.g., it's a tag), try to peel it to a commit
            match obj.peel(ObjectType::Commit)?.into_commit() {
                Ok(commit) => commit,
                Err(_) => return Err(FileLineError::RevisionNotFound),
            }
        }
    };

    // Get the tree for the commit
    let tree = commit.tree()?;

    // Try to find the file in the tree
    let entry: git2::TreeEntry<'_> = match tree.get_path(Path::new(file_path)) {
        Ok(entry) => entry,
        Err(_) => return Err(FileLineError::FileNotFound),
    };

    // Get the object for the file
    let blob = repo.find_blob(entry.id())?;

    // Convert blob content to UTF-8 string
    let content = match std::str::from_utf8(blob.content()) {
        Ok(s) => s,
        Err(_) => {
            // If the file is not valid UTF-8, return an IO error
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "File content is not valid UTF-8",
            ).into());
        }
    };

    // Read the content line by line
    let mut lines = Vec::new();
    let mut line_num = 1;

    for line in content.lines() {
        // If we're past the end of our range, we can stop
        if line_num > line_range.end {
            break;
        }

        // If we're within our range, add the line
        if line_num >= line_range.start {
            lines.push(line.to_string());
        }

        line_num += 1;
    }

    // Check if we got any lines within the range
    if lines.is_empty() && line_num <= line_range.start {
        return Err(FileLineError::InvalidRange);
    }

    Ok(lines)
}
