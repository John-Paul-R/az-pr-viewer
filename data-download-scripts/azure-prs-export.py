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

# Parse command-line arguments
parser = argparse.ArgumentParser(description='Export Azure DevOps Pull Requests with comments')
parser.add_argument('--org', required=True, help='Azure DevOps organization name')
parser.add_argument('--project', required=True, help='Azure DevOps project name')
parser.add_argument('--repo', required=True, help='Azure DevOps repository name')
parser.add_argument('--page-size', type=int, default=1000, help='Number of PRs to fetch per page')
parser.add_argument('--output-dir', required=True, help='Directory to save PR data')
args = parser.parse_args()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("pr_export.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger()

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

# Create index file with basic PR info
pr_index = []
success_count = 0
failure_count = 0

# Iterate through PRs to get details including comments
for index, pr in enumerate(pull_requests, 1):
    pr_id = pr["pullRequestId"]
    
    try:
        logger.info(f"Processing PR {index}/{total_prs}: ID {pr_id} - '{pr['title']}'")
        
        # Get PR threads (comments)
        threads = client.get_pull_request_threads(pr_id)
        logger.info(f"Retrieved {len(threads)} comment threads for PR {pr_id}")
        
        # Combine PR data with its threads
        pr_data = {
            # Basic PR info
            "id": pr_id,
            "title": pr["title"],
            "description": pr.get("description", ""),
            
            # People info
            "created_by": pr["createdBy"]["displayName"],
            "created_by_id": pr["createdBy"]["id"],
            "reviewers": [{
                "id": reviewer["id"],
                "displayName": reviewer["displayName"],
                "vote": reviewer["vote"],  # 10=approved, 5=approved with suggestions, 0=no vote, -5=waiting for author, -10=rejected
                "isRequired": reviewer.get("isRequired", False)
            } for reviewer in pr.get("reviewers", [])],
            
            # Dates
            "creation_date": pr["creationDate"],
            "completion_date": pr.get("closedDate"),
            "auto_complete_set_by": pr.get("autoCompleteSetBy", {}).get("displayName") if pr.get("autoCompleteSetBy") else None,
            
            # Branch and repo info
            "repository": pr["repository"]["name"],
            "repository_id": pr["repository"]["id"],
            "source_branch": pr["sourceRefName"],
            "target_branch": pr["targetRefName"],
            "merge_status": pr.get("mergeStatus"),
            "merge_id": pr.get("mergeId"),
            "last_merge_source_commit": pr.get("lastMergeSourceCommit", {}).get("commitId"),
            "last_merge_target_commit": pr.get("lastMergeTargetCommit", {}).get("commitId"),
            "last_merge_commit": pr.get("lastMergeCommit", {}).get("commitId"),
            
            # PR state
            "status": pr["status"],
            "is_draft": pr.get("isDraft", False),
            "has_conflicts": pr.get("hasConflicts", False),
            "url": pr["url"],
            "supportsIterations": pr.get("supportsIterations", False),
            
            # Work items and policies
            "work_item_refs": pr.get("workItemRefs", []),
            "completion_options": pr.get("completionOptions"),
            "completion_queue_time": pr.get("completionQueueTime"),
            
            # Detailed discussion threads
            "threads": threads
        }
        
        # Save individual PR file
        pr_filename = f"{output_dir}/pr_{pr_id}.json"
        with open(pr_filename, "w") as f:
            json.dump(pr_data, f, indent=2)
        
        # Add to index
        pr_index.append({
            "id": pr_id,
            "title": pr["title"],
            "description": pr.get("description", ""),
            "created_by": pr["createdBy"]["displayName"],
            "creation_date": pr["creationDate"],
            "completion_date": pr.get("closedDate"),
            "status": pr["status"],
            "is_draft": pr.get("isDraft", False),
            "repository": pr["repository"]["name"],
            "source_branch": pr["sourceRefName"],
            "target_branch": pr["targetRefName"],
            "reviewer_count": len(pr.get("reviewers", [])),
            "has_conflicts": pr.get("hasConflicts", False),
            "work_item_count": len(pr.get("workItemRefs", [])),
            "thread_count": len(threads),
            "filename": f"pr_{pr_id}.json"
        })
        
        success_count += 1
        
    except Exception as e:
        logger.error(f"Error processing PR {pr_id}: {str(e)}")
        failure_count += 1
    
    # Log progress percentage
    progress = (index / total_prs) * 100
    logger.info(f"Progress: {progress:.1f}% ({index}/{total_prs})")

# Save index file
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
index_filename = f"{args.output_dir}/pr_index_{timestamp}.json"

with open(index_filename, "w") as f:
    json.dump(pr_index, f, indent=2)

logger.info(f"Export completed. Processed {total_prs} PRs with {success_count} successes and {failure_count} failures")
logger.info(f"Individual PR files saved in {output_dir}")
logger.info(f"PR index saved to {index_filename}")
