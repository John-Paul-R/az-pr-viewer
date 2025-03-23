use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use crate::PrIndexEntry;
use probly_search::{
    Index,
    score::bm25,
};

pub struct SearchIndex {
    // Index with 2 fields: title and author
    index: Mutex<Option<Index<usize>>>,
    pr_map: Mutex<HashMap<usize, PrIndexEntry>>,
}

impl SearchIndex {
    pub fn new() -> Self {
        SearchIndex {
            index: Mutex::new(None),
            pr_map: Mutex::new(HashMap::new()),
        }
    }

    // Reset and rebuild the search index with new PR entries
    pub fn rebuild_index(&self, entries: &[PrIndexEntry]) -> Result<(), String> {
        let start = Instant::now();

        // Create a new search index with 2 fields (title, author)
        let mut index = Index::<usize>::new(2);
        let mut pr_map = HashMap::new();

        // Add each PR to the index
        for (i, entry) in entries.iter().enumerate() {
            let doc_id = i;

            // Store the PR for later retrieval
            pr_map.insert(doc_id, entry.clone());

            // Add to search index
            index.add_document(
                &[title_extract, author_extract],
                tokenizer,
                doc_id,
                entry,
            );
        }

        // Update the stored index and map
        {
            let mut index_guard = self.index.lock().unwrap();
            *index_guard = Some(index);

            let mut pr_map_guard = self.pr_map.lock().unwrap();
            *pr_map_guard = pr_map;
        }

        println!("Performance: built search index for {} entries in {:?}",
                 entries.len(), start.elapsed());

        Ok(())
    }

    // Search the index and return matching PRs
    pub fn search(&self, query: &str) -> Result<Vec<PrIndexEntry>, String> {
        let start = Instant::now();

        // Get the index
        let index_guard = self.index.lock().unwrap();
        let index = match &*index_guard {
            Some(idx) => idx,
            None => return Err("Search index not initialized".to_string()),
        };

        // Get the PR map
        let pr_map = self.pr_map.lock().unwrap();

        let mut matched_prs = Vec::new();
        let query_trimmed = query.trim();

        // do a PR number contains check
        {
            // Look for prefix matches first (higher priority)
            let mut prefix_matches = Vec::new();
            let mut contains_matches = Vec::new();

            for (_, pr) in pr_map.iter() {
                let pr_num_str = pr.id.to_string();

                if pr_num_str.starts_with(query_trimmed) {
                    // Prefix match - higher priority
                    prefix_matches.push(pr.clone());
                } else if pr_num_str.contains(query_trimmed) {
                    // Contains match - lower priority
                    contains_matches.push(pr.clone());
                }
            }

            // Add prefix matches first, then contains matches
            prefix_matches.sort_by_key(|v| v.id);
            contains_matches.sort_by_key(|v| v.id);
            matched_prs.extend(prefix_matches);
            matched_prs.extend(contains_matches);
        }

        // If we still don't have matches, do a text search
        if matched_prs.is_empty() {
            // Field weights: title=1.0, author=0.5
            let field_weights = &[1.0, 1.0];

            // Search with scoring
            let results = index.query(
                query_trimmed,
                &mut probly_search::score::zero_to_one::new(),
                tokenizer,
                field_weights,
            );

            // Map results to PR entries
            for result in results {
                if let Some(pr) = pr_map.get(&result.key) {
                    matched_prs.push(pr.clone());
                }
            }
        }

        println!("Performance: search for '{}' found {} matches in {:?}",
                 query_trimmed, matched_prs.len(), start.elapsed());

        Ok(matched_prs)
    }

    // Check if the index is initialized
    pub fn is_initialized(&self) -> bool {
        self.index.lock().unwrap().is_some()
    }
}

// Tokenizer function - split on whitespace and special characters
fn tokenizer(s: &str) -> Vec<Cow<str>> {
    s.split(|c: char| c.is_whitespace() || c == '-' || c == '_' || c == '/')
        .filter(|s| !s.is_empty())
        .map(|s| Cow::from(s.to_lowercase()))
        .collect()
}

// Field extraction functions
fn title_extract(pr: &PrIndexEntry) -> Vec<&str> {
    vec![pr.title.as_str()]
}

fn author_extract(pr: &PrIndexEntry) -> Vec<&str> {
    vec![pr.created_by.as_str()]
}