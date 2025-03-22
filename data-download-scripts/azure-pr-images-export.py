#!/usr/bin/env python3
"""
Extract and download images from exported Azure DevOps PR data.
"""

import os
import re
import json
import logging
import argparse
import urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from az_requests import AzureDevOpsClient

# Setup argument parser
parser = argparse.ArgumentParser(description='Extract and download images from exported Azure DevOps PR data')
parser.add_argument('--input-dir', required=True, help='Directory containing exported PR data')
parser.add_argument('--output-dir', required=True, help='Directory to save downloaded images')
parser.add_argument('--org', help='Azure DevOps organization name')
parser.add_argument('--workers', type=int, default=4, help='Number of parallel download workers')
parser.add_argument('--dry-run', action='store_true', help='Only detect images without downloading')
parser.add_argument('--update-json', action='store_true', help='Update the JSON files with local image paths')
args = parser.parse_args()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("image_extractor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger()

# Create output directory
os.makedirs(args.output_dir, exist_ok=True)

# Initialize Azure DevOps client
client = None
if args.org:
    client = AzureDevOpsClient(organization=args.org)
    logger.info(f"Initialized Azure DevOps client for organization: {args.org}")

# Function to extract markdown image URLs handling nested parentheses
def extract_markdown_image_urls(text):
    """Extract image URLs from markdown content handling nested parentheses"""
    if not text:
        return []
    
    urls = []
    # Find all occurrences of "![any text](" which indicates the start of an image
    pattern = r'!\[(.*?)\]\('
    for match in re.finditer(pattern, text):
        start_idx = match.end()  # End of the "![alt](" part
        # Find the matching closing parenthesis
        # We need to count parentheses to handle nested ones
        open_count = 1
        url_end = start_idx
        
        for i in range(start_idx, len(text)):
            if text[i] == '(':
                open_count += 1
            elif text[i] == ')':
                open_count -= 1
                if open_count == 0:
                    url_end = i
                    break
        
        if url_end > start_idx:
            # Get the URL (everything between the parentheses)
            url_with_size = text[start_idx:url_end]
            # Handle size specification (=WxH)
            size_match = re.search(r'\s*=\d+x\d*$|\s*=\d*x\d+$', url_with_size)
            if size_match:
                url = url_with_size[:size_match.start()].strip()
            else:
                url = url_with_size.strip()
            urls.append(url)
    
    return urls

# Function to extract HTML image URLs
def extract_html_image_urls(text):
    """Extract image URLs from HTML img tags"""
    if not text:
        return []
    
    urls = []
    # Find all <img> tags and extract the src attribute
    pattern = r'<img.*?src="(.*?)".*?>'
    for match in re.finditer(pattern, text):
        urls.append(match.group(1))
    
    return urls

# Function to extract image URLs from text
def extract_image_urls(text):
    """Extract image URLs from text content"""
    if not text:
        return []
    
    # Get URLs from markdown format
    markdown_urls = extract_markdown_image_urls(text)
    
    # Get URLs from HTML format
    html_urls = extract_html_image_urls(text)
    
    # Combine and return all URLs
    return markdown_urls + html_urls

# Function to generate a unique filename for an image
def generate_image_filename(url, pr_id, counter):
    """Generate a unique filename for the image based on URL and PR ID"""
    try:
        # Extract original filename from URL if possible
        parsed_url = urllib.parse.urlparse(url)
        path = urllib.parse.unquote(parsed_url.path)
        original_filename = os.path.basename(path)
        
        # If filename is empty or unclear, use a default
        if not original_filename or original_filename == "" or '?' in original_filename:
            # Try to extract extension from URL or default to .png
            extension = os.path.splitext(path)[1]
            if not extension:
                extension = ".png"
            original_filename = f"image_{counter}{extension}"
        
        # Remove any potentially problematic characters
        original_filename = re.sub(r'[\\/*?:"<>|]', '_', original_filename)
        
        # Create a unique filename using PR ID and original filename
        return f"pr_{pr_id}_{original_filename}"
    except Exception as e:
        logger.error(f"Error generating filename for {url}: {str(e)}")
        return f"pr_{pr_id}_image_{counter}.png"

# Function to download an image
def download_image(url, filename, counter=0):
    """Download an image from URL and save it to the output directory"""
    if args.dry_run:
        logger.info(f"[DRY RUN] Would download: {url} -> {filename}")
        return True, filename
    
    try:
        full_path = os.path.join(args.output_dir, filename)
        
        # Skip if file already exists
        if os.path.exists(full_path):
            logger.info(f"File already exists: {filename}")
            return True, filename
        
        # Use the Azure DevOps client for Azure URLs, direct requests otherwise
        if client and "dev.azure.com" in url.lower():
            success = client.download_file(url, full_path, use_content_headers=True)
            if success:
                logger.info(f"Downloaded: {filename}")
                return True, filename
            else:
                logger.warning(f"Failed to download {url}")
                return False, None
        else:
            # For non-Azure URLs or if no client is available
            import requests
            response = requests.get(url)
            if response.status_code == 200:
                with open(full_path, 'wb') as f:
                    f.write(response.content)
                logger.info(f"Downloaded: {filename}")
                return True, filename
            else:
                logger.warning(f"Failed to download {url}: HTTP {response.status_code}")
                return False, None
    except Exception as e:
        logger.error(f"Error downloading {url}: {str(e)}")
        return False, None

# Function to check if URL is likely an image
def is_likely_image_url(url):
    """Check if a URL is likely to be an image"""
    # Check common image extensions
    image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff')
    if url.lower().endswith(image_extensions):
        return True
    
    # Check for attachment paths or image-related terms in the URL
    image_indicators = ['/attachments/', '/image', '/img/', '/picture', '/photo']
    if any(indicator in url.lower() for indicator in image_indicators):
        return True
    
    # Parse URL to look for image-related parameters
    parsed_url = urllib.parse.urlparse(url)
    query_params = urllib.parse.parse_qs(parsed_url.query)
    
    # Check for image-related query parameters
    image_params = ['image', 'img', 'pic', 'photo']
    if any(param in query_params for param in image_params):
        return True
    
    return False

# Function to replace URL in Markdown content while preserving size specification
def replace_markdown_image_url(content, old_url, new_url):
    """Replace image URL in markdown content while preserving size specification"""
    # Look for the pattern ![text](old_url=WxH) or ![text](old_url =WxH)
    # We need to escape special characters in the old URL
    escaped_old_url = re.escape(old_url)
    
    # To handle nested parentheses correctly, we'll use a more specific pattern
    pattern = r'(!\[.*?\]\()' + escaped_old_url + r'(\s*=\d+x\d*|\s*=\d*x\d+)?(\))'
    replacement = r'\1' + new_url + r'\2\3'
    
    # Try the replacement with the specific pattern first
    new_content = re.sub(pattern, replacement, content)
    
    # If no replacement was made, try a more general approach
    if new_content == content:
        new_content = content.replace(old_url, new_url)
    
    return new_content

# Function to process a single PR file
def process_pr_file(file_path):
    """Process a PR JSON file to extract and download images"""
    image_index = {}  # Maps URLs to local filenames
    updated_pr_data = None
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            pr_data = json.load(f)
        
        pr_id = pr_data.get("id")
        if not pr_id:
            logger.warning(f"No PR ID found in {file_path}, skipping")
            return {}, None
        
        logger.info(f"Processing PR {pr_id} from {file_path}")
        
        # Clone the PR data for potential updates
        if args.update_json:
            updated_pr_data = json.loads(json.dumps(pr_data))
        
        # Extract images from PR description
        image_counter = 0
        image_urls = extract_image_urls(pr_data.get("description", ""))
        for url in image_urls:
            # Skip if not likely an image URL
            if not is_likely_image_url(url):
                logger.debug(f"Skipping unlikely image URL: {url}")
                continue
                
            image_counter += 1
            filename = generate_image_filename(url, pr_id, image_counter)
            image_index[url] = filename
            
            # Update the description with local path if requested
            if args.update_json and updated_pr_data and updated_pr_data.get("description"):
                relative_path = os.path.join("images", filename).replace("\\", "/")
                updated_pr_data["description"] = replace_markdown_image_url(
                    updated_pr_data["description"], url, relative_path
                )
        
        # Extract images from comments in threads
        if "threads" in pr_data:
            for thread_idx, thread in enumerate(pr_data["threads"]):
                if "comments" in thread:
                    for comment_idx, comment in enumerate(thread["comments"]):
                        if comment.get("content") and comment.get("commentType") == "text":
                            image_urls = extract_image_urls(comment["content"])
                            for url in image_urls:
                                # Skip if not likely an image URL
                                if not is_likely_image_url(url):
                                    logger.debug(f"Skipping unlikely image URL: {url}")
                                    continue
                                    
                                image_counter += 1
                                filename = generate_image_filename(url, pr_id, image_counter)
                                image_index[url] = filename
                                
                                # Update the comment with local path if requested
                                if args.update_json and updated_pr_data:
                                    relative_path = os.path.join("images", filename).replace("\\", "/")
                                    updated_pr_data["threads"][thread_idx]["comments"][comment_idx]["content"] = replace_markdown_image_url(
                                        updated_pr_data["threads"][thread_idx]["comments"][comment_idx]["content"], 
                                        url, 
                                        relative_path
                                    )
        
        logger.info(f"Found {len(image_index)} images in PR {pr_id}")
        return image_index, updated_pr_data
    
    except Exception as e:
        logger.error(f"Error processing {file_path}: {str(e)}")
        return {}, None

# Main function
def main():
    input_dir = Path(args.input_dir)
    
    # Find all PR JSON files
    pr_files = []
    for file in input_dir.glob("**/*.json"):
        if file.name.startswith("pr_") and file.name.endswith(".json") and not file.name.startswith("pr_index_"):
            pr_files.append(file)
    
    logger.info(f"Found {len(pr_files)} PR files in {input_dir}")
    
    # Process all PR files to extract image URLs
    all_images = {}  # URL -> filename mapping for all PRs
    files_to_update = []  # List of (file_path, updated_data) tuples
    
    for file_path in pr_files:
        image_index, updated_pr_data = process_pr_file(file_path)
        all_images.update(image_index)
        
        if args.update_json and updated_pr_data is not None:
            files_to_update.append((file_path, updated_pr_data))
    
    logger.info(f"Found a total of {len(all_images)} unique image URLs across all PRs")
    
    # Download all images using multiple threads
    if not args.dry_run:
        successful_downloads = {}
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {}
            for idx, (url, filename) in enumerate(all_images.items()):
                future = executor.submit(download_image, url, filename, idx)
                futures[future] = (url, filename)
            
            for future in futures:
                url, filename = futures[future]
                success, downloaded_filename = future.result()
                if success:
                    successful_downloads[url] = downloaded_filename
        
        logger.info(f"Successfully downloaded {len(successful_downloads)} of {len(all_images)} images")
    
    # Create an index file mapping URLs to filenames
    index_file = os.path.join(args.output_dir, "image_index.json")
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(all_images, f, indent=2)
    
    logger.info(f"Created image index at {index_file}")
    
    # Update the PR JSON files with local image paths if requested
    if args.update_json:
        for file_path, updated_data in files_to_update:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(updated_data, f, indent=2)
                logger.info(f"Updated {file_path} with local image paths")
            except Exception as e:
                logger.error(f"Error updating {file_path}: {str(e)}")
    
    logger.info("Image extraction completed")

if __name__ == "__main__":
    main()
