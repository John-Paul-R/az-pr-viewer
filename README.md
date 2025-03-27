# az-pr-viewer

A multi-platform desktop application for viewing archives of Azure DevOps pull
requests fully locally.

This project is built with **Tauri (Rust) + React (TypeScript)** for the
application, and **Python** for the data export.

## Features

- fast search by PR Number, Title, and Author
- a UI that mirrors many of the functions of AzDo, like:
  - markdown description & comments support, with syntax highlighting
  - Comment Threads
    - FileName + LineNumber references
    - Inline git diffs, with links to full file
    - "thumbs-up" comment likes count & user list
  - a "Files Changed" diff view
  - votes / approvers
  - pushes with ref and description
- rendering markdown-linked images exported from the original repository
- rewriting internal links to other PRs in the repository to navigate to that PR
  inside the application
- git integration with local repositories
  - enables git diffs and revision summaries
- dark mode, with a few bundled themes to choose from

### What this does _not_ include

(yet?)

- User Avatars
  - Export scripts are done, as is indexing, just need to wire them up
- search by ref
- search by files affected

## Data Export

See
[Data Export Explanations](./data-download-scripts/data-export-explanations.md)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) +
  [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) +
  [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
