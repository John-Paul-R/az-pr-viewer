use git2::{DiffFormat, DiffOptions, Error, Object, ObjectType, Repository};
use std::io::{self};
use std::ops::Range;
use std::path::Path;
use std::str;

/// Error type for file operations in a git repository
#[derive(Debug)]
pub enum GitFileError<'a> {
    Git(git2::Error),
    Io(io::Error),
    InvalidRange,
    FileNotFound,
    Generic(String),
    RevisionNotFound(&'a str),
}

impl From<git2::Error> for GitFileError<'_> {
    fn from(err: git2::Error) -> Self {
        GitFileError::Git(err)
    }
}

impl From<io::Error> for GitFileError<'_> {
    fn from(err: io::Error) -> Self {
        GitFileError::Io(err)
    }
}

impl std::fmt::Display for GitFileError<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GitFileError::Git(err) => write!(f, "Git error: {}", err),
            GitFileError::Io(err) => write!(f, "IO error: {}", err),
            GitFileError::InvalidRange => write!(f, "Invalid line range"),
            GitFileError::FileNotFound => write!(f, "File not found in the specified revision"),
            GitFileError::Generic(message) => write!(f, "Generic Err: {}", message),
            GitFileError::RevisionNotFound(path) => write!(f, "Revision not found: {}", path),
        }
    }
}

impl std::error::Error for GitFileError<'_> {}

/// Helper function to convert a revision string to a git2 Object
fn tree_to_treeish<'a>(
    repo: &'a Repository,
    arg: &'a str,
) -> Result<Object<'a>, GitFileError<'a>> {
    let obj = repo.revparse_single(arg).map_err(|_| GitFileError::RevisionNotFound(arg))?;
    let tree = obj.peel(ObjectType::Tree)?;
    Ok(tree)
}

/// Helper function for backward compatibility with older code
fn tree_to_treeish_opt<'a>(
    repo: &'a Repository,
    arg: Option<&String>,
) -> Result<Option<Object<'a>>, Error> {
    let arg = match arg {
        Some(s) => s,
        None => return Ok(None),
    };
    let obj = repo.revparse_single(arg)?;
    let tree = obj.peel(ObjectType::Tree)?;
    Ok(Some(tree))
}

/// Retrieves specific lines from a file at a specific Git revision using libgit2.
///
/// # Arguments
///
/// * `repo` - The Git repository
/// * `file_path` - Path to the file within the repository
/// * `revision` - Git revision (commit hash, branch name, tag, etc.)
/// * `line_range` - Range of lines to retrieve (1-based, inclusive start, inclusive end)
///
/// # Returns
///
/// * `Result<Vec<String>, GitFileError>` - The requested lines or an error
///
pub fn get_file_lines_at_revision<'a>(
    repo: &Repository,
    file_path: &str,
    revision: &'a str,
    line_range: Range<usize>,
) -> Result<Vec<String>, GitFileError<'a>> {
    // Validate the range
    if line_range.start < 1 || line_range.start > line_range.end {
        return Err(GitFileError::InvalidRange);
    }

    // Resolve the revision to a commit
    let obj = match repo.revparse_single(revision) {
        Ok(obj) => obj,
        Err(_) => return Err(GitFileError::RevisionNotFound(revision)),
    };

    // Get the commit from the revision
    let commit = match obj.as_commit() {
        Some(commit) => commit.clone(),
        None => {
            // If it's not directly a commit (e.g., it's a tag), try to peel it to a commit
            match obj.peel(ObjectType::Commit)?.into_commit() {
                Ok(commit) => commit,
                Err(_) => return Err(GitFileError::RevisionNotFound(revision)),
            }
        }
    };

    // Get the tree for the commit
    let tree = commit.tree()?;

    // Try to find the file in the tree
    let entry: git2::TreeEntry<'_> = match tree.get_path(Path::new(file_path)) {
        Ok(entry) => entry,
        Err(data) => return Err(GitFileError::Generic(data.message().to_string())),
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
        return Err(GitFileError::InvalidRange);
    }

    Ok(lines)
}

/// Struct to represent a diff line with context
#[derive(Debug)]
pub struct DiffLineInfo {
    /// Original line number in the first revision
    pub old_lineno: Option<u32>,
    /// Line number in the second revision
    pub new_lineno: Option<u32>,
    /// The content of the line
    pub content: String,
    /// The origin of the line ('+' for addition, '-' for deletion, ' ' for context)
    pub origin: char,
}

pub fn get_file_diff_between_revisions<'a>(
    repo: &'a Repository,
    file_path: &str,
    from_revision: &'a str,
    to_revision: &'a str,
    line_range: Range<usize>,
) -> Result<Vec<DiffLineInfo>, GitFileError<'a>> {
    // Validate the range
    if line_range.start < 1 || line_range.start > line_range.end {
        return Err(GitFileError::InvalidRange);
    }

    // Get the tree objects for both revisions
    let from_tree = tree_to_treeish(repo, from_revision)?;
    let to_tree = tree_to_treeish(repo, to_revision)?;

    // Get the tree references, failing if they're None
    let from_tree_ref = from_tree.as_tree().ok_or_else(||
        GitFileError::Generic(format!("Failed to get tree for revision: {}", from_revision)))?;

    let to_tree_ref = to_tree.as_tree().ok_or_else(||
        GitFileError::Generic(format!("Failed to get tree for revision: {}", to_revision)))?;

    // Set up diff options
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);
    diff_opts.context_lines(3); // Default context lines

    // Generate the diff between the two trees
    let diff = repo.diff_tree_to_tree(
        Some(from_tree_ref),
        Some(to_tree_ref),
        Some(&mut diff_opts),
    )?;

    // Collect the diff lines
    let mut diff_lines = Vec::new();

    // Precompute the extended range with context buffer
    let context_buffer = 3;
    let extended_start = if line_range.start > context_buffer {
        line_range.start - context_buffer
    } else {
        1
    };
    let extended_end = line_range.end + context_buffer;

    // Use the diff.print callback to process each line
    diff.print(DiffFormat::Patch, |delta, hunk, line| {
        // Make sure we're only processing the file we're interested in
        if let Some(path) = delta.new_file().path() {
            if path.to_str() != Some(file_path) {
                return true;
            }
        } else {
            return true;
        }

        // Extract line information
        let origin = line.origin();
        let content = match str::from_utf8(line.content()) {
            Ok(s) => s.to_string(),
            Err(_) => "[Binary content]".to_string(),
        };

        let old_lineno = line.old_lineno();
        let new_lineno = line.new_lineno();

        // Determine whether to include this line based on type and position
        let include = match origin {
            // Special lines (headers, etc.) - always exclude
            c if c != '+' && c != '-' && c != ' ' => {
                false
            },

            // Added lines - include if they're in the extended range
            '+' => {
                if let Some(new_line) = new_lineno {
                    let line_num = new_line as usize;
                    line_num >= extended_start && line_num <= extended_end
                } else {
                    false
                }
            },

            // Deleted lines - include if they affect our extended range
            '-' => {
                if let Some(old_line) = old_lineno {
                    // For deletions, we need to be more careful. If a line was deleted
                    // that would have been in our range, we should show it.
                    // Use the context of the current hunk to determine this.
                    if let Some(ref hunk) = hunk {
                        let hunk_old_start = hunk.old_start() as usize;
                        let hunk_old_end = hunk_old_start + hunk.old_lines() as usize - 1;
                        let hunk_new_start = hunk.new_start() as usize;
                        let hunk_new_end = hunk_new_start + hunk.new_lines() as usize - 1;

                        // Include if the hunk overlaps with our extended range
                        !(hunk_new_end < extended_start || hunk_new_start > extended_end)
                    } else {
                        // Without hunk information, use the old line number directly
                        let line_num = old_line as usize;
                        line_num >= extended_start && line_num <= extended_end
                    }
                } else {
                    false
                }
            },

            // Context lines - include if they're in the extended range
            ' ' => {
                if let Some(new_line) = new_lineno {
                    let line_num = new_line as usize;
                    line_num >= extended_start && line_num <= extended_end
                } else {
                    false
                }
            },

            // Unknown line type - exclude
            _ => false,
        };

        if include {
            diff_lines.push(DiffLineInfo {
                old_lineno,
                new_lineno,
                content,
                origin,
            });
        }

        true
    })?;

    // If we didn't get any lines, check if the file exists in both revisions
    if diff_lines.is_empty() {
        // Check if the file exists in the from_revision
        match from_tree_ref.get_path(Path::new(file_path)) {
            Ok(_) => {}
            Err(_) => return Err(GitFileError::FileNotFound),
        }

        // Check if the file exists in the to_revision
        match to_tree_ref.get_path(Path::new(file_path)) {
            Ok(_) => {}
            Err(_) => return Err(GitFileError::FileNotFound),
        }

        // If the file exists in both revisions but there's no diff in the specified range,
        // it means there were no changes in that range
    }

    Ok(diff_lines)
}

/// A more simplified version that returns just the unified diff as a string
pub fn get_file_diff_as_strings<'a>(
    repo: &'a Repository,
    file_path: &str,
    from_revision: &'a str,
    to_revision: &'a str,
    line_range: Range<usize>,
) -> Result<String, GitFileError<'a>> {
    let diff_lines = get_file_diff_between_revisions(repo, file_path, from_revision, to_revision, line_range)?;

    let mut result = String::new();
    for line in diff_lines {
        match line.origin {
            '+' | '-' | ' ' => {
                result.push(line.origin);
                result.push_str(&line.new_lineno.or(line.old_lineno).map(|lineno| lineno.to_string()).unwrap_or_else(|| "?".to_string()));
                result.push_str(&line.content);
                if !line.content.ends_with('\n') {
                    result.push('\n');
                }
            },
            _ => {
                // Handle diff header lines and other special lines
                result.push_str(&line.content);
                if !line.content.ends_with('\n') {
                    result.push('\n');
                }
            }
        }
    }

    Ok(result)
}