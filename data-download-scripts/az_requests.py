"""
Azure DevOps API Request Module

This module provides utility functions for making authenticated requests to Azure DevOps APIs.
It handles authentication, pagination, and common request patterns.
"""

import os
import time
import base64
import logging
import requests
from urllib.parse import quote

DEFAULT_PAGE_SIZE = 1000
# Set up logger
logger = logging.getLogger(__name__)

class AzureDevOpsClient:
    """Client for Azure DevOps API requests with authentication and pagination support."""
    
    def __init__(self, organization, project=None, repository=None, pat=None, cookie=None):
        """
        Initialize the Azure DevOps client.
        
        Args:
            organization (str): Azure DevOps organization name
            project (str, optional): Azure DevOps project name
            repository (str, optional): Azure DevOps repository name
            pat (str, optional): Personal Access Token. If not provided, will look for AZ_TOKEN env var
            cookie (str, optional): Cookie for image requests. If not provided, will look for AZ_IMG_COOKIE env var
        """
        self.organization = organization
        self.project = project
        self.repository = repository
        
        # Get PAT from constructor or environment variable
        self.pat = pat or os.environ.get("AZ_TOKEN")
        if not self.pat:
            logger.warning("No Personal Access Token provided. Authentication will fail.")
        
        # Get Cookie from constructor or environment variable
        self.cookie = cookie or os.environ.get("AZ_IMG_COOKIE")
        
        # Create the authorization header using PAT
        authorization = str(base64.b64encode(f":{self.pat}".encode("utf-8")), "utf-8")
        
        # Headers for API requests
        self.api_headers = {
            "Authorization": f"Basic {authorization}",
            "Content-Type": "application/json"
        }
        
        # Headers for image/content requests (uses cookie auth)
        self.content_headers = {
            "Cookie": self.cookie,
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0',
            'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            'Priority': 'u=5',
            'TE': 'trailers',
        }
        
        # Set referer if project and repository are specified
        if project and repository:
            self.content_headers['Referer'] = f'https://dev.azure.com/{organization}/{project}/_git/{repository}/pullrequest/1'
    
    def get(self, url, use_content_headers=False, params=None):
        """
        Make a GET request to the Azure DevOps API.
        
        Args:
            url (str): The full URL to request
            use_content_headers (bool): Whether to use content headers (for images)
            params (dict, optional): Query parameters
            
        Returns:
            requests.Response: The response object
        """
        headers = self.content_headers if use_content_headers else self.api_headers
        
        try:
            response = requests.get(url, headers=headers, params=params)
            if response.status_code >= 400:
                logger.warning(f"Request failed: {response.status_code} for URL: {url}")
            return response
        except Exception as e:
            logger.error(f"Request error for URL {url}: {str(e)}")
            raise
    
    def get_paged_items(self, url, params=None, page_size=DEFAULT_PAGE_SIZE, delay=0.5):
        """
        Get all items from a paged API endpoint.
        
        Args:
            url (str): The base URL to request
            params (dict, optional): Additional query parameters
            page_size (int): Number of items per page
            delay (float): Delay between pagination requests in seconds
            
        Returns:
            list: Combined list of all items from all pages
        """
        all_items = []
        has_more_results = True
        skip = 0
        page_count = 0
        
        # Initialize params dict if not provided
        if params is None:
            params = {}
        
        # Add API version if not specified
        if "api-version" not in params:
            params["api-version"] = "7.0"
        
        logger.info(f"Retrieving all items with pagination from: {url}")
        
        while has_more_results:
            page_count += 1
            
            # Update pagination parameters
            current_params = params.copy()
            current_params["$top"] = str(page_size)
            current_params["$skip"] = str(skip)
            
            logger.info(f"Fetching page {page_count} (skip={skip}, top={page_size})")
            
            response = self.get(url, params=current_params)
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch items for page {page_count}: {response.status_code}")
                break
            
            data = response.json()
            items = data.get("value", [])
            item_count = len(items)
            
            logger.info(f"Retrieved {item_count} items from page {page_count}")
            
            all_items.extend(items)
            
            # Check if we got a full page of results
            has_more_results = item_count >= page_size
            
            if has_more_results:
                # Update skip for next page
                skip += page_size
                logger.info(f"Got {item_count} items, fetching next page...")
                
                # Add a small delay to avoid hitting API rate limits
                if delay > 0:
                    time.sleep(delay)
        
        logger.info(f"Retrieved {len(all_items)} total items across {page_count} pages")
        return all_items
    
    def get_all_paged_items(self, url, headers=None):
        """
        Helper function to get all items from a paged API using various pagination strategies.
        Tries different approaches to handle pagination in Azure DevOps APIs.
        
        Args:
            url (str): The base URL to request
            headers (dict, optional): Request headers (uses default API headers if None)
            
        Returns:
            list: Combined list of all items from all pages
        """
        if headers is None:
            headers = self.api_headers
            
        all_items = []
        
        # Strategy 1: Try with skip/top parameters (common in older Azure APIs)
        skip = 0
        page_size = DEFAULT_PAGE_SIZE
        strategy1_success = True
        
        while strategy1_success:
            current_url = f"{url}&$skip={skip}&$top={page_size}"
            response = self.get(current_url)
            
            if response.status_code != 200:
                logger.info(f"Strategy 1 failed: {response.status_code}")
                strategy1_success = False
                break
            
            data = response.json()
            items = data.get("value", [])
            all_items.extend(items)
            
            if len(items) < page_size:
                # No more items
                return all_items
            
            skip += page_size
        
        # Strategy 2: Try with continuationToken (common in newer Azure APIs)
        all_items = []
        continuation_token = None
        
        while True:
            current_url = url
            if continuation_token:
                # Try different formats of continuation token
                if "?" in current_url:
                    current_url += f"&continuationToken={continuation_token}"
                else:
                    current_url += f"?continuationToken={continuation_token}"
            
            response = self.get(current_url)
            if response.status_code != 200:
                logger.info(f"Strategy 2 failed: {response.status_code}")
                break
            
            data = response.json()
            if "value" in data:
                all_items.extend(data["value"])
            else:
                all_items.extend([data])  # Some APIs return the items directly
            
            # Check different header formats for continuation token
            continuation_token = None
            for header in ["x-ms-continuationtoken", "X-MS-ContinuationToken", "x-continuation-token"]:
                if header in response.headers:
                    continuation_token = response.headers[header]
                    break
            
            # Check if the token is in the response body (some APIs do this)
            if not continuation_token and "continuationToken" in data:
                continuation_token = data["continuationToken"]
            
            if not continuation_token:
                break
        
        # Strategy 3: If all else fails, try checking if there's a nextLink in the response
        if len(all_items) == 0:
            current_url = url
            while current_url:
                response = self.get(current_url)
                
                if response.status_code != 200:
                    logger.info(f"Strategy 3 failed: {response.status_code}")
                    break
                
                data = response.json()
                if "value" in data:
                    all_items.extend(data["value"])
                
                # Look for nextLink or similar property
                current_url = data.get("nextLink") or data.get("next_page") or data.get("continuationUrl") or None
        
        return all_items
    
    def download_file(self, url, output_path, use_content_headers=True):
        """
        Download a file from Azure DevOps.
        
        Args:
            url (str): URL to download from
            output_path (str): Path to save the file
            use_content_headers (bool): Whether to use content headers
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            response = self.get(url, use_content_headers=use_content_headers)
            
            if response.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(response.content)
                logger.info(f"Downloaded file to: {output_path}")
                return True
            else:
                logger.warning(f"Failed to download file: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            return False
    
    def read_file(self, url, use_content_headers=True):
        """
        Read a file's content from Azure DevOps without saving to disk.
        
        Args:
            url (str): URL to download from
            use_content_headers (bool): Whether to use content headers
            
        Returns:
            bytes: File content if successful, None otherwise
        """
        try:
            response = self.get(url, use_content_headers=use_content_headers)
            
            if response.status_code == 200:
                return response.content
            else:
                logger.warning(f"Failed to read file: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error reading file: {str(e)}")
            return None

    # Convenience methods for common Azure DevOps API endpoints
    
    def get_teams(self):
        """Get all teams in the project."""
        if not self.project:
            raise ValueError("Project must be specified to get teams")
            
        url = f"https://dev.azure.com/{self.organization}/_apis/projects/{quote(self.project)}/teams?api-version=7.1-preview.1"
        return self.get_all_paged_items(url)
    
    def get_team_members(self, team_id):
        """Get members of a team."""
        if not self.project:
            raise ValueError("Project must be specified to get team members")
            
        url = f"https://dev.azure.com/{self.organization}/_apis/projects/{quote(self.project)}/teams/{team_id}/members?api-version=7.1-preview.1"
        return self.get_all_paged_items(url)
    
    def get_users(self):
        """Get all users in the organization."""
        # Try different endpoints for users
        url = f"https://dev.azure.com/{self.organization}/_apis/users?api-version=7.1-preview.1"
        users = self.get_all_paged_items(url)
        
        if not users:
            # Try alternate endpoint
            url = f"https://vssps.dev.azure.com/{self.organization}/_apis/identities?api-version=7.1-preview.1"
            users = self.get_all_paged_items(url)
        
        return users
    
    def get_pull_requests(self, status="all"):
        """
        Get all pull requests in the repository.
        
        Args:
            status (str): PR status filter ('all', 'active', 'completed', 'abandoned')
            
        Returns:
            list: List of pull requests
        """
        if not self.project or not self.repository:
            raise ValueError("Project and repository must be specified to get pull requests")
            
        params = {
            "api-version": "7.0",
            "searchCriteria.status": status
        }
        
        url = f"https://dev.azure.com/{self.organization}/{self.project}/_apis/git/repositories/{self.repository}/pullrequests"
        return self.get_paged_items(url, params=params)
    
    def get_pull_request(self, pr_id):
        """
        Get details of a specific pull request.
        
        Args:
            pr_id (int): Pull request ID
            
        Returns:
            dict: Pull request details
        """
        if not self.project or not self.repository:
            raise ValueError("Project and repository must be specified to get pull request details")
            
        url = f"https://dev.azure.com/{self.organization}/{self.project}/_apis/git/repositories/{self.repository}/pullRequests/{pr_id}?api-version=7.0"
        response = self.get(url)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Failed to get PR {pr_id}: {response.status_code}")
            return None
    
    def get_pull_request_threads(self, pr_id):
        """
        Get all threads (comments) for a pull request.
        
        Args:
            pr_id (int): Pull request ID
            
        Returns:
            list: List of comment threads
        """
        if not self.project or not self.repository:
            raise ValueError("Project and repository must be specified to get pull request threads")
            
        url = f"https://dev.azure.com/{self.organization}/{self.project}/_apis/git/repositories/{self.repository}/pullRequests/{pr_id}/threads?api-version=7.0"
        response = self.get(url)
        
        if response.status_code == 200:
            return response.json().get("value", [])
        else:
            logger.error(f"Failed to get PR threads for PR {pr_id}: {response.status_code}")
            return []
    
    def get_avatar_url(self, user_id, size=2):
        """
        Get the URL for a user's avatar.
        
        Args:
            user_id (str): User's unique identifier
            size (int): Avatar size (0=small, 1=medium, 2=large)
            
        Returns:
            str: Avatar URL
        """
        return f"https://dev.azure.com/{self.organization}/_api/_common/identityImage?id={user_id}&size={size}"

    def get_pull_request_iterations(self, pr_id):
        """
        Get all iterations for a pull request.
        
        Args:
            pr_id (int): Pull request ID
            
        Returns:
            list: List of pull request iterations
        """
        if not self.project or not self.repository:
            raise ValueError("Project and repository must be specified to get pull request iterations")
            
        url = f"https://dev.azure.com/{self.organization}/{self.project}/_apis/git/repositories/{self.repository}/pullRequests/{pr_id}/iterations?api-version=7.0"
        response = self.get(url)
        
        if response.status_code == 200:
            return response.json().get("value", [])
        else:
            logger.error(f"Failed to get PR iterations for PR {pr_id}: {response.status_code}")
            return []

    def get_pull_request_detailed(self, pr_id):
        """
        Get detailed information for a specific pull request including full description.
        
        Args:
            pr_id (int): Pull request ID
            
        Returns:
            dict: Complete pull request details
        """
        if not self.project or not self.repository:
            raise ValueError("Project and repository must be specified to get detailed PR")
            
        url = f"https://dev.azure.com/{self.organization}/{self.project}/_apis/git/pullrequests/{pr_id}?api-version=7.0&includeCommits=true&includeWorkItemRefs=true"
        response = self.get(url)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Failed to get detailed PR {pr_id}: {response.status_code}")
            return None
