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
    parser.add_argument('--format', choices=['full', 'summary', 'custom'], default='full', 
                        help='Output format: full (all fields), summary (key fields only), or custom (specify fields)')
    parser.add_argument('--fields', help='Comma-separated list of fields to include (for custom format)')
    return parser.parse_args()

def extract_pr_data(raw_pr, format_type, custom_fields=None):
    """
    Extract and format PR data based on the specified format
    """
    if format_type == 'full':
        # Include all fields in a structured format
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
    
    elif format_type == 'summary':
        # Include only key summary fields
        return {
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
    
    elif format_type == 'custom' and custom_fields:
        # Extract only the specified fields
        result = {}
        fields_list = [f.strip() for f in custom_fields.split(',')]
        
        for field in fields_list:
            # Handle nested fields with dot notation (e.g., "createdBy.displayName")
            if '.' in field:
                parts = field.split('.')
                value = raw_pr
                for part in parts:
                    if isinstance(value, dict) and part in value:
                        value = value[part]
                    else:
                        value = None
                        break
                result[field] = value
            else:
                result[field] = raw_pr.get(field)
                
        return result
    
    # Default case - return summary
    return extract_pr_data(raw_pr, 'summary')

def main():
    """Main function to process exported PR data"""
    args = parse_arguments()
    logger = setup_logging()
    
    input_dir = args.input_dir
    output_dir = args.output_dir if args.output_dir else os.path.join(args.input_dir, "processed")
    os.makedirs(output_dir, exist_ok=True)
    
    logger.info(f"Starting PR data processing from {input_dir}")
    logger.info(f"Output format: {args.format}")
    
    if args.format == 'custom' and not args.fields:
        logger.warning("Custom format selected but no fields specified. Using summary format instead.")
        format_type = 'summary'
    else:
        format_type = args.format
    
    # Get all raw PR data files
    raw_files = glob.glob(os.path.join(input_dir, "pr_*_raw.json"))
    total_files = len(raw_files)
    
    logger.info(f"Found {total_files} raw PR data files to process")
    
    processed_prs = []
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
            
            # Extract and format PR data
            processed_pr = extract_pr_data(raw_pr, format_type, args.fields)
            
            # Save individual processed PR file
            output_filename = f"{output_dir}/pr_{pr_id}.json"
            with open(output_filename, "w") as f:
                json.dump(processed_pr, f, indent=2)
            
            # Add to the index
            processed_prs.append(processed_pr)
            success_count += 1
            
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {str(e)}")
            failure_count += 1
        
        # Log progress
        progress = (index / total_files) * 100
        logger.info(f"Progress: {progress:.1f}% ({index}/{total_files})")
    
    # Save PR index file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    index_filename = f"{output_dir}/pr_index_{timestamp}.json"
    
    with open(index_filename, "w") as f:
        json.dump(processed_prs, f, indent=2)
    
    logger.info(f"Processing completed. Processed {total_files} PR files with {success_count} successes and {failure_count} failures")
    logger.info(f"Individual processed PR files saved in {output_dir}")
    logger.info(f"PR index saved to {index_filename}")

if __name__ == "__main__":
    main()
