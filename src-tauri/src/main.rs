// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;

use clap::Arg;
use azure_pr_viewer_lib::{run, InitialState};
use memory_stats::memory_stats;

fn log_memory_usage(label: &str) {
    if let Some(usage) = memory_stats() {
        println!("Memory usage at {}: Physical: {} MB, Virtual: {} MB", 
                 label, 
                 usage.physical_mem / (1024 * 1024), 
                 usage.virtual_mem / (1024 * 1024));
    } else {
        println!("Memory stats not available");
    }
}

fn main() {
    log_memory_usage("start of main");
    
    // Parse command line arguments
    let matches = clap::Command::new("Azure PR Viewer")
        .version("1.0")
        .author("Your Name")
        .about("PR Viewer Application")
        .arg(Arg::new("archive")
            .short('a')
            .long("archive")
            .value_name("FILE")
            .help("Sets the main zip archive file for PR data"))
        .arg(Arg::new("images")
            .short('i')
            .long("images")
            .value_name("FILE")
            .help("Sets the zip archive file for images"))
        .arg(Arg::new("repo")
            .short('r')
            .long("repo")
            .value_name("PATH")
            .help("Sets the git repository path"))
        .get_matches();
    
    log_memory_usage("after parsing arguments");

    // Create the InitialState based on CLI arguments
    let initial_state = InitialState {
        archive_path: matches.get_one::<String>("archive").cloned(),
        images_archive_path: matches.get_one::<String>("images").cloned(),
        repo_path: matches.get_one::<String>("repo").cloned(),
    };
    
    log_memory_usage("before running application");

    if let Err(e) = run(Some(initial_state)) {
        eprintln!("Application error: {}", e);
        process::exit(1);
    }
    
    log_memory_usage("end of main");
}