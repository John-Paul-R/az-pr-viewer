#!/usr/bin/env python3
"""
Export Azure DevOps Pull Requests with comments.
"""

import os
import json
import logging
import argparse
from datetime import datetime
from az_requests import AzureDevOpsClient

def setup_logging(log_file="pr_export.log"):
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
    parser = argparse.ArgumentParser(description='Export Azure DevOps Pull Requests with comments')
    parser.add_argument('--org', required=True, help='Azure DevOps organization name')
    parser.add_argument('--project', required=True, help='Azure DevOps project name')
    parser.add_argument('--repo', required=True, help='Azure DevOps repository name')
    parser.add_argument('--page-size', type=int, default=1000, help='Number of PRs to fetch per page')
    parser.add_argument('--output-dir', required=True, help='Directory to save PR data')
    return parser.parse_args()

def main():
    """Main function to export PRs"""
    args = parse_arguments()
    logger = setup_logging()
    
    # Create output directory structure
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize Azure DevOps client
    client = AzureDevOpsClient(
        organization=args.org,
        project=args.project,
        repository=args.repo
    )
    
    logger.info(f"Starting export for {args.org}/{args.project}/{args.repo}")
    
    # Get all PRs with pagination
    logger.info("Retrieving all pull requests...")
    pull_requests = client.get_pull_requests(status="all")
    total_prs = len(pull_requests)
    logger.info(f"Retrieved {total_prs} pull requests")
    
    success_count = 0
    failure_count = 0
    
    # Iterate through PRs to get details including comments
    for index, pr in enumerate(pull_requests, 1):
        pr_id = pr["pullRequestId"]
        
        try:
            logger.info(f"Processing PR {index}/{total_prs}: ID {pr_id} - '{pr['title']}'")
            
            # Get detailed PR data (with full description)
            detailed_pr = client.get_pull_request_detailed(pr_id)
            if detailed_pr:
                pr_data = detailed_pr  # Use the detailed PR data as base
            else:
                pr_data = pr.copy()  # Fallback to original data
            
            # Get PR threads (comments)
            threads = client.get_pull_request_threads(pr_id)
            logger.info(f"Retrieved {len(threads)} comment threads for PR {pr_id}")
            
            # Get PR iterations
            iterations = client.get_pull_request_iterations(pr_id)
            logger.info(f"Retrieved {len(iterations)} iterations for PR {pr_id}")
            
            # Add threads and iterations to PR data
            pr_data["threads"] = threads
            pr_data["iterations"] = iterations
            
            # Save raw PR data file
            pr_filename = f"{output_dir}/pr_{pr_id}_raw.json"
            with open(pr_filename, "w") as f:
                json.dump(pr_data, f, indent=2)
            
            success_count += 1
        except Exception as e:
            logger.error(f"Error processing PR {pr_id}: {str(e)}")
            failure_count += 1
        
        # Log progress percentage
        progress = (index / total_prs) * 100
        logger.info(f"Progress: {progress:.1f}% ({index}/{total_prs})")
    
    # Save raw data metadata file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    metadata_filename = f"{args.output_dir}/pr_export_metadata_{timestamp}.json"
    
    metadata = {
        "export_date": datetime.now().isoformat(),
        "organization": args.org,
        "project": args.project,
        "repository": args.repo,
        "total_prs": total_prs,
        "success_count": success_count,
        "failure_count": failure_count
    }
    
    with open(metadata_filename, "w") as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"Export completed. Processed {total_prs} PRs with {success_count} successes and {failure_count} failures")
    logger.info(f"Raw PR data files saved in {output_dir}")
    logger.info(f"Export metadata saved to {metadata_filename}")

if __name__ == "__main__":
    main()
