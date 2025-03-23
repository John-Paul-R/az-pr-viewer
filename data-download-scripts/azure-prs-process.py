#!/usr/bin/env python3
"""
Process exported Azure DevOps Pull Request data to create structured outputs.
"""

import os
import json
import glob
import logging
import argparse
from datetime import datetime

def setup_logging(log_file="pr_process.log"):
    """Set up logging configuration"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger()

def parse_arguments():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(description='Process exported Azure DevOps Pull Request data')
    parser.add_argument('--input-dir', required=True, help='Directory containing raw PR data files')
    parser.add_argument('--output-dir', help='Directory to save processed data (defaults to input-dir/processed)')
    return parser.parse_args()

def enrich_thread_context(thread, iterations):
    """
    Enrich thread context with iteration commit information
    """
    if not thread.get("pullRequestThreadContext") or not iterations:
        return thread
    
    context = thread["pullRequestThreadContext"]
    iteration_context = context.get("iterationContext")
    
    if not iteration_context:
        return thread
    
    # Get iteration IDs from thread context
    first_iteration_id = iteration_context.get("firstComparingIteration")
    second_iteration_id = iteration_context.get("secondComparingIteration")
    
    # Find the matching iterations
    first_iteration = next((i for i in iterations if i.get("id") == first_iteration_id), None)
    second_iteration = next((i for i in iterations if i.get("id") == second_iteration_id), None)
    
    # Enrich thread context with commit information
    if first_iteration:
        context["firstIterationDetails"] = {
            "id": first_iteration.get("id"),
            "sourceCommit": first_iteration.get("sourceRefCommit", {}).get("commitId"),
            "targetCommit": first_iteration.get("targetRefCommit", {}).get("commitId"),
            "commonRefCommit": first_iteration.get("commonRefCommit", {}).get("commitId"),
            "createdDate": first_iteration.get("createdDate")
        }
    
    if second_iteration:
        context["secondIterationDetails"] = {
            "id": second_iteration.get("id"),
            "sourceCommit": second_iteration.get("sourceRefCommit", {}).get("commitId"),
            "targetCommit": second_iteration.get("targetRefCommit", {}).get("commitId"),
            "commonRefCommit": second_iteration.get("commonRefCommit", {}).get("commitId"),
            "createdDate": second_iteration.get("createdDate")
        }
    
    return thread

def extract_full_pr_data(raw_pr):
    """
    Extract all PR data in a structured format
    """
    if "threads" in raw_pr and "iterations" in raw_pr:
        raw_pr["threads"] = [
            enrich_thread_context(thread, raw_pr["iterations"]) 
            for thread in raw_pr["threads"]
        ]

    return {
        # Basic PR info
        "id": raw_pr["pullRequestId"],
        "title": raw_pr["title"],
        "description": raw_pr.get("description", ""),
        
        # People info
        "created_by": raw_pr["createdBy"]["displayName"],
        "created_by_id": raw_pr["createdBy"]["id"],
        "reviewers": [{
            "id": reviewer["id"],
            "displayName": reviewer["displayName"],
            "vote": reviewer["vote"],  # 10=approved, 5=approved with suggestions, 0=no vote, -5=waiting for author, -10=rejected
            "isRequired": reviewer.get("isRequired", False)
        } for reviewer in raw_pr.get("reviewers", [])],
        
        # Dates
        "creation_date": raw_pr["creationDate"],
        "completion_date": raw_pr.get("closedDate"),
        "auto_complete_set_by": raw_pr.get("autoCompleteSetBy", {}).get("displayName") if raw_pr.get("autoCompleteSetBy") else None,
        
        # Branch and repo info
        "repository": raw_pr["repository"]["name"],
        "repository_id": raw_pr["repository"]["id"],
        "source_branch": raw_pr["sourceRefName"],
        "target_branch": raw_pr["targetRefName"],
        "merge_status": raw_pr.get("mergeStatus"),
        "merge_id": raw_pr.get("mergeId"),
        "last_merge_source_commit": raw_pr.get("lastMergeSourceCommit", {}).get("commitId"),
        "last_merge_target_commit": raw_pr.get("lastMergeTargetCommit", {}).get("commitId"),
        "last_merge_commit": raw_pr.get("lastMergeCommit", {}).get("commitId"),
        
        # PR state
        "status": raw_pr["status"],
        "is_draft": raw_pr.get("isDraft", False),
        "has_conflicts": raw_pr.get("hasConflicts", False),
        "url": raw_pr["url"],
        "supportsIterations": raw_pr.get("supportsIterations", False),
        
        # Work items and policies
        "work_item_refs": raw_pr.get("workItemRefs", []),
        "completion_options": raw_pr.get("completionOptions"),
        "completion_queue_time": raw_pr.get("completionQueueTime"),
        
        # Detailed discussion threads
        "threads": raw_pr.get("threads", [])
    }

def extract_summary_pr_data(raw_pr):
    """
    Extract summary PR data
    """
    summary = {
        "id": raw_pr["pullRequestId"],
        "title": raw_pr["title"],
        "description": raw_pr.get("description", ""),
        "created_by": raw_pr["createdBy"]["displayName"],
        "creation_date": raw_pr["creationDate"],
        "completion_date": raw_pr.get("closedDate"),
        "status": raw_pr["status"],
        "is_draft": raw_pr.get("isDraft", False),
        "repository": raw_pr["repository"]["name"],
        "source_branch": raw_pr["sourceRefName"],
        "target_branch": raw_pr["targetRefName"],
        "reviewer_count": len(raw_pr.get("reviewers", [])),
        "has_conflicts": raw_pr.get("hasConflicts", False),
        "work_item_count": len(raw_pr.get("workItemRefs", [])),
        "thread_count": len(raw_pr.get("threads", [])),
    }
    
    return summary

def main():
    """Main function to process exported PR data"""
    args = parse_arguments()
    logger = setup_logging()
    
    input_dir = args.input_dir
    output_dir = args.output_dir if args.output_dir else os.path.join(args.input_dir, "processed")
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(os.path.join(output_dir, 'prs'), exist_ok=True)
    
    logger.info(f"Starting PR data processing from {input_dir}")
    logger.info("Individual files will be saved in full format")
    logger.info("Index will be saved in summary format")
    
    # Get all raw PR data files
    raw_files = glob.glob(os.path.join(input_dir, "pr_*_raw.json"))
    total_files = len(raw_files)
    
    logger.info(f"Found {total_files} raw PR data files to process")
    
    index_entries = []
    success_count = 0
    failure_count = 0
    
    # Process each raw PR file
    for index, file_path in enumerate(raw_files, 1):
        try:
            pr_id = os.path.basename(file_path).split('_')[1]  # Extract PR ID from filename
            logger.info(f"Processing file {index}/{total_files}: PR {pr_id}")
            
            # Load raw PR data
            with open(file_path, 'r') as f:
                raw_pr = json.load(f)
            
            # Extract and format full PR data for individual file
            full_pr_data = extract_full_pr_data(raw_pr)
            
            # Save individual processed PR file in full format
            filename = f"pr_{pr_id}.json"
            output_filename = os.path.join(output_dir, 'prs', filename)
            with open(output_filename, "w") as f:
                json.dump(full_pr_data, f, indent=2)
            
            # Create summary for index
            summary_pr_data = extract_summary_pr_data(raw_pr)
            summary_pr_data["filename"] = filename 
            
            # Add to the index
            index_entries.append(summary_pr_data)
            success_count += 1
            
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {str(e)}")
            failure_count += 1
        
        # Log progress
        progress = (index / total_files) * 100
        logger.info(f"Progress: {progress:.1f}% ({index}/{total_files})")
    
    # Save PR index file with summaries
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    index_filename = f"{output_dir}/pr_index_{timestamp}.json"
    
    with open(index_filename, "w") as f:
        json.dump(index_entries, f, indent=2)
    
    logger.info(f"Processing completed. Processed {total_files} PR files with {success_count} successes and {failure_count} failures")
    logger.info(f"Individual processed PR files (full format) saved in {output_dir}")
    logger.info(f"PR index (summary format) saved to {index_filename}")

if __name__ == "__main__":
    main()
