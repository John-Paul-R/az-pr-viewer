use git2::{Repository, Time};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Local};

/// Struct to hold commit metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitMetadata {
    /// The full commit hash
    pub commit_id: String,
    /// The commit message
    pub message: String,
    /// The commit message summary (first line)
    pub summary: String,
    /// The author's name
    pub author_name: String,
    /// The author's email
    pub author_email: String,
    /// The author time (when the commit was originally created)
    pub author_time: DateTime<Local>,
    /// The committer's name
    pub committer_name: String,
    /// The committer's email
    pub committer_email: String,
    /// The commit time (when the commit was added to the repository)
    pub commit_time: DateTime<Local>,
}

/// Error type for commit metadata retrieval operations
#[derive(Debug)]
pub enum CommitError {
    Git(git2::Error),
    RevisionNotFound,
    InvalidUtf8,
    TimeConversion,
}

impl From<git2::Error> for CommitError {
    fn from(err: git2::Error) -> Self {
        CommitError::Git(err)
    }
}

impl std::fmt::Display for CommitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommitError::Git(err) => write!(f, "Git error: {}", err),
            CommitError::RevisionNotFound => write!(f, "Revision not found"),
            CommitError::InvalidUtf8 => write!(f, "Invalid UTF-8 in commit data"),
            CommitError::TimeConversion => write!(f, "Failed to convert git time"),
        }
    }
}

impl std::error::Error for CommitError {}

/// Convert git2::Time to chrono::DateTime<Local>
fn convert_git_time(git_time: Time) -> Result<DateTime<Local>, CommitError> {
    let seconds = git_time.seconds();

    // Convert to local DateTime
    let local_time = match DateTime::from_timestamp(seconds, 0) {
        Some(time) => time.with_timezone(&Local),
        None => return Err(CommitError::TimeConversion),
    };

    Ok(local_time)
}

/// Retrieves metadata for a specific commit
///
/// # Arguments
///
/// * `repo_path` - Path to the Git repository
/// * `revision` - Git revision (commit hash, branch name, tag, etc.)
///
/// # Returns
///
/// * `Result<CommitMetadata, CommitError>` - The commit metadata or an error
///
pub fn get_commit_metadata(
    repo: &Repository,
    revision: &str,
) -> Result<CommitMetadata, CommitError> {
    // Open the repository
    // let repo = Repository::open(repo_path)?;

    // Resolve the revision to a commit
    let obj = match repo.revparse_single(revision) {
        Ok(obj) => obj,
        Err(_) => return Err(CommitError::RevisionNotFound),
    };

    // Get the commit from the revision
    let commit = match obj.as_commit() {
        Some(commit) => commit.clone(),
        None => {
            // If it's not directly a commit (e.g., it's a tag), try to peel it to a commit
            match obj.peel_to_commit() {
                Ok(commit) => commit,
                Err(_) => return Err(CommitError::RevisionNotFound),
            }
        }
    };

    // Get commit ID
    let commit_id = commit.id().to_string();

    // Get commit message
    let message = match commit.message() {
        Some(msg) => msg.to_string(),
        None => return Err(CommitError::InvalidUtf8),
    };

    // Get commit summary (first line of message)
    let summary = match commit.summary() {
        Some(summary) => summary.to_string(),
        None => return Err(CommitError::InvalidUtf8),
    };

    // Get author information
    let author = commit.author();
    let author_name = match author.name() {
        Some(name) => name.to_string(),
        None => return Err(CommitError::InvalidUtf8),
    };
    let author_email = match author.email() {
        Some(email) => email.to_string(),
        None => return Err(CommitError::InvalidUtf8),
    };
    let author_time = convert_git_time(author.when())?;

    // Get committer information
    let committer = commit.committer();
    let committer_name = match committer.name() {
        Some(name) => name.to_string(),
        None => return Err(CommitError::InvalidUtf8),
    };
    let committer_email = match committer.email() {
        Some(email) => email.to_string(),
        None => return Err(CommitError::InvalidUtf8),
    };
    let commit_time = convert_git_time(committer.when())?;

    Ok(CommitMetadata {
        commit_id,
        message,
        summary,
        author_name,
        author_email,
        author_time,
        committer_name,
        committer_email,
        commit_time,
    })
}