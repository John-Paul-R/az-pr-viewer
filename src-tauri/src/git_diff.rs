use git2::{Diff, DiffDelta, DiffFormat, DiffLine, DiffOptions, Error, Object, ObjectType, Repository};
use std::{collections::HashMap, path::Path};
use std::str;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiffEntry {
    pub file_path: String,
    pub status: char,
    pub content: String,
    pub binary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDiff {
    pub old_file: String,
    pub new_file: String,
    pub status: char,   // 'A' for added, 'M' for modified, 'D' for deleted
    pub lines: Vec<LineDiff>,
    pub binary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LineDiff {
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
    pub origin: char,   // '+' for addition, '-' for deletion, ' ' for context
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TreeDiff {
    pub files: Vec<FileDiff>,
}

/// Error type for diff operations in a git repository
#[derive(Debug)]
pub enum GitDiffError<'a> {
    Git(git2::Error),
    RevisionNotFound(&'a str),
    Generic(String),
}

impl From<git2::Error> for GitDiffError<'_> {
    fn from(err: git2::Error) -> Self {
        GitDiffError::Git(err)
    }
}

impl std::fmt::Display for GitDiffError<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GitDiffError::Git(err) => write!(f, "Git error: {}", err),
            GitDiffError::RevisionNotFound(path) => write!(f, "Revision not found: {}", path),
            GitDiffError::Generic(message) => write!(f, "Generic Err: {}", message),
        }
    }
}

impl std::error::Error for GitDiffError<'_> {}

/// Helper function to convert a revision string to a git2 Object
fn tree_to_treeish<'a>(
    repo: &'a Repository,
    arg: &'a str,
) -> Result<Object<'a>, GitDiffError<'a>> {
    let obj = repo.revparse_single(arg).map_err(|_| GitDiffError::RevisionNotFound(arg))?;
    let tree = obj.peel(ObjectType::Tree)?;
    Ok(tree)
}

/// Get a diff of the whole tree between two revisions
pub fn get_tree_diff_between_revisions<'a>(
    repo: &'a Repository,
    from_revision: &'a str,
    to_revision: &'a str,
) -> Result<TreeDiff, GitDiffError<'a>> {
    // Get the tree objects for both revisions
    let from_tree = tree_to_treeish(repo, from_revision)?;
    let to_tree = tree_to_treeish(repo, to_revision)?;

    // Get the tree references
    let from_tree_ref = from_tree.as_tree().ok_or_else(||
        GitDiffError::Generic(format!("Failed to get tree for revision: {}", from_revision)))?;

    let to_tree_ref = to_tree.as_tree().ok_or_else(||
        GitDiffError::Generic(format!("Failed to get tree for revision: {}", to_revision)))?;

    // Set up diff options
    let mut diff_opts = DiffOptions::new();
    diff_opts.context_lines(3); // Default context lines

    // Generate the diff between the two trees
    let diff = repo.diff_tree_to_tree(
        Some(from_tree_ref),
        Some(to_tree_ref),
        Some(&mut diff_opts),
    )?;

    // Process the diff to collect file changes
    process_tree_diff(diff)
        .map_err(|err| GitDiffError::Git(err))
}

fn process_tree_diff(diff: Diff) -> Result<TreeDiff, Error> {
    let mut files = Vec::new();
    let mut file_line_map = HashMap::new();

    // First pass: create file entries and initialize their line collections
    for (file_index, delta) in diff.deltas().enumerate() {
        let status = match delta.status() {
            git2::Delta::Added => 'A',
            git2::Delta::Deleted => 'D',
            git2::Delta::Modified => 'M',
            git2::Delta::Renamed => 'R',
            git2::Delta::Copied => 'C',
            git2::Delta::Ignored => 'I',
            git2::Delta::Untracked => 'U',
            git2::Delta::Typechange => 'T',
            git2::Delta::Unreadable => 'X',
            git2::Delta::Unmodified => ' ',
            _ => '?',
        };

        let binary = delta.old_file().is_binary() || delta.new_file().is_binary();

        // Create new file entry
        files.push(FileDiff {
            old_file: delta.old_file().path().and_then(|p| p.to_str()).unwrap_or("").to_string(),
            new_file: delta.new_file().path().and_then(|p| p.to_str()).unwrap_or("").to_string(),
            status,
            lines: Vec::new(), // Start with empty lines vector
            binary,
        });

        // Only set up line tracking for non-binary files
        if !binary {
            file_line_map.insert(file_index, Vec::new());
        }
    }

    // Second pass: populate line information
    if !file_line_map.is_empty() {
        // Use a file index to track which file we're currently processing
        let mut current_file_index = 0;

        diff.print(git2::DiffFormat::Patch, |print_delta, _hunk, line| {
            // Delta header indicates we're moving to a new file
            if print_delta.status() != git2::Delta::Unmodified {
                // Find the corresponding file index for this delta
                if let Some(index) = files.iter().position(|f| {
                    let old_match = print_delta.old_file().path().and_then(|p| p.to_str())
                        .map_or(false, |path| path == f.old_file);
                    let new_match = print_delta.new_file().path().and_then(|p| p.to_str())
                        .map_or(false, |path| path == f.new_file);
                    old_match || new_match
                }) {
                    current_file_index = index;
                }
            }

            // Extract line information
            let origin = line.origin();
            let content = match str::from_utf8(line.content()) {
                Ok(s) => s.trim_end().to_string(),
                Err(_) => "[Binary content]".to_string(),
            };

            let old_lineno = line.old_lineno();
            let new_lineno = line.new_lineno();

            // Add line info to the current file's lines collection
            if let Some(lines) = file_line_map.get_mut(&current_file_index) {
                lines.push(LineDiff {
                    old_lineno,
                    new_lineno,
                    content,
                    origin,
                });
            }

            true
        })?;
    }

    // Final pass: update each file with its line information
    for (index, lines) in file_line_map {
        if let Some(file) = files.get_mut(index) {
            file.lines = lines;
        }
    }

    Ok(TreeDiff { files })
}

/// Get a diff of the whole tree between two revisions with filtering options
pub fn get_filtered_tree_diff<'a>(
    repo: &'a Repository,
    from_revision: &'a str,
    to_revision: &'a str,
    file_pattern: &str,
) -> Result<TreeDiff, GitDiffError<'a>> {
    // Get the tree objects for both revisions
    let from_tree = tree_to_treeish(repo, from_revision)?;
    let to_tree = tree_to_treeish(repo, to_revision)?;

    // Get the tree references
    let from_tree_ref = from_tree.as_tree().ok_or_else(||
        GitDiffError::Generic(format!("Failed to get tree for revision: {}", from_revision)))?;

    let to_tree_ref = to_tree.as_tree().ok_or_else(||
        GitDiffError::Generic(format!("Failed to get tree for revision: {}", to_revision)))?;

    // Set up diff options
    let mut diff_opts = DiffOptions::new();
    diff_opts.context_lines(3); // Default context lines
    diff_opts.pathspec(file_pattern);

    // Generate the diff between the two trees
    let diff = repo.diff_tree_to_tree(
        Some(from_tree_ref),
        Some(to_tree_ref),
        Some(&mut diff_opts),
    )?;

    // Process the diff to collect file changes
    process_tree_diff(diff)
        .map_err(|err| GitDiffError::Git(err))
}