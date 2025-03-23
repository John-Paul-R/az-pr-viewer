// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;

use clap::Arg;
use azure_pr_viewer_lib::{run, InitialState};

fn main() {
    // Parse command line arguments
    let matches = clap::Command::new("Azure PR Viewer")
        .version("1.0")
        .author("Your Name")
        .about("PR Viewer Application")
        .arg(Arg::new("archive")
            .short('a')
            .long("archive")
            .value_name("FILE")
            .help("Sets the zip archive file to use"))
        .arg(Arg::new("repo")
            .short('r')
            .long("repo")
            .value_name("PATH")
            .help("Sets the git repository path"))
        .get_matches();

    // Create the InitialState based on CLI arguments
    let initial_state = InitialState {
        archive_path: matches.get_one::<String>("archive").cloned(),
        repo_path: matches.get_one::<String>("repo").cloned(),
    };

    if let Err(e) = run(Some(initial_state)) {
        eprintln!("Application error: {}", e);
        process::exit(1);
    }
}