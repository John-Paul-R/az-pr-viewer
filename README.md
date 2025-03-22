# az-pr-viewer

A multi-platform desktop application for viewing archives of Azure DevOps pull requests fully locally.

This project is built with **Tauri (Rust) + React (TypeScript)** for the application, and **Python** for the data export.

## Features

- fast search by PR Number, Title, and Author
- markdown description & comments support
- a UI that mirrors many of the functions of AzDo, like Threads, FileName+LineNumber references, approvers, pushes
- rewriting internal links to other PRs in the repository to navigate to that PR inside the application
- git integration with local repositories
  - currently showing updated refs, but better integrations to follow
    - TODO: Is there a way to export metadata about remote-only refs? (is this already included and my scripts have inadvertently filtered it out? (the first pass should really simply write out the untransformed data...)

### What this does _not_ include

(yet?)

- Inline file viewing for comment threads. FileName and LineNumber are linked, but the content cannot yet be reliably displayed (can't seem to find the revision information)
- Images and User Avatars
  - Export scripts are done, as is indexing, just need to wire them up
- search by ref
- search by files affected
- Thread Comment vote counts

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
