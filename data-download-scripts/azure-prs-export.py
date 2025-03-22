import requests
import base64
import json
import time
import logging
import os
import argparse
from datetime import datetime

# Parse command-line arguments
parser = argparse.ArgumentParser(description='Export Azure DevOps Pull Requests with comments')
parser.add_argument('--org', required=True, help='Azure DevOps organization name')
parser.add_argument('--project', required=True, help='Azure DevOps project name')
parser.add_argument('--repo', required=True, help='Azure DevOps repository name')
parser.add_argument('--page-size', type=int, default=1000, help='Number of PRs to fetch per page')
parser.add_argument('--output-dir', required=True, help='Directory to save PR data')
args = parser.parse_args()

organization = args.org
project = args.project
repository = args.repo
page_size = args.page_size
output_dir = args.output_dir

# Configuration
personal_access_token = pat = os.environ.get("AZ_TOKEN")

# Auth header
auth_header = {
    "Authorization": "Basic " + base64.b64encode(f":{personal_access_token}".encode()).decode()
}

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
output_dir = "output/prs_sd4"
os.makedirs(output_dir, exist_ok=True)

# Get list of PRs
pr_url = f"https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repository}/pullrequests?api-version=6.0&searchCriteria.status=all"
logger.info(f"Retrieving list of pull requests...")
pr_response = requests.get(pr_url, headers=auth_header)

if pr_response.status_code != 200:
    logger.error(f"Failed to retrieve PRs: {pr_response.status_code} - {pr_response.text}")
    exit(1)

pull_requests = pr_response.json()["value"]
total_prs = len(pull_requests)
logger.info(f"Starting export for {organization}/{project}/{repository}")

all_pr_data = []
success_count = 0
failure_count = 0

# Function to fetch PRs with pagination
def fetch_all_pull_requests():
    all_pull_requests = []
    has_more_results = True
    skip = 0
    page_count = 0
    
    logger.info(f"Retrieving all pull requests with pagination...")
    
    while has_more_results:
        page_count += 1
        
        # Build query parameters with proper pagination
        query_params = {
            "api-version": "7.0",
            "$top": str(page_size),
            "$skip": str(skip),
            "searchCriteria.status": "all"
        }
        
        # Convert dict to query string
        query_string = "&".join([f"{k}={v}" for k, v in query_params.items()])
        
        pr_url = f"https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repository}/pullrequests?{query_string}"
        
        logger.info(f"Fetching page {page_count} (skip={skip}, top={page_size})")
        
        pr_response = requests.get(pr_url, headers=auth_header)
        
        if pr_response.status_code != 200:
            logger.error(f"Failed to fetch PRs for page {page_count}: {pr_response.status_code} - {pr_response.text}")
            break
        
        data = pr_response.json()
        pr_count = len(data["value"])
        
        logger.info(f"Retrieved {pr_count} PRs from page {page_count}")
        
        all_pull_requests.extend(data["value"])
        
        # Check if we got a full page of results
        has_more_results = pr_count >= page_size
        
        if has_more_results:
            # Update skip for next page
            skip += page_size
            logger.info(f"Got {pr_count} PRs, fetching next page...")
            time.sleep(0.5)  # 500ms delay between pagination requests
    
    logger.info(f"Retrieved {len(all_pull_requests)} PRs across {page_count} pages")
    return all_pull_requests

# Get all PRs with pagination
pull_requests = fetch_all_pull_requests()
total_prs = len(pull_requests)

# Create index file with basic PR info
pr_index = []

# Iterate through PRs to get details including comments
for index, pr in enumerate(pull_requests, 1):
    pr_id = pr["pullRequestId"]
    
    try:
        logger.info(f"Processing PR {index}/{total_prs}: ID {pr_id} - '{pr['title']}'")
        
        # Get PR threads (comments)
        thread_url = f"https://dev.azure.com/{organization}/{project}/_apis/git/repositories/{repository}/pullRequests/{pr_id}/threads?api-version=7.0"
        thread_response = requests.get(thread_url, headers=auth_header)
        
        if thread_response.status_code != 200:
            logger.warning(f"Could not retrieve threads for PR {pr_id}: {thread_response.status_code}")
            threads = []
        else:
            threads = thread_response.json()["value"]
            logger.info(f"Retrieved {len(threads)} comment threads for PR {pr_id}")
        
        # Combine PR data with its threads
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
        
        # Add a small delay to avoid hitting API rate limits
        time.sleep(0.5)
        
    except Exception as e:
        logger.error(f"Error processing PR {pr_id}: {str(e)}")
        failure_count += 1
    
    # Log progress percentage
    progress = (index / total_prs) * 100
    logger.info(f"Progress: {progress:.1f}% ({index}/{total_prs})")

# Save index file
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
index_filename = f"output/pr_index_{timestamp}.json"

with open(index_filename, "w") as f:
    json.dump(pr_index, f, indent=2)

logger.info(f"Export completed. Processed {total_prs} PRs with {success_count} successes and {failure_count} failures")
logger.info(f"Individual PR files saved in {output_dir}")
logger.info(f"PR index saved to {index_filename}")
