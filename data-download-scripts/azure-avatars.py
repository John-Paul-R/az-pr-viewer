import requests
import base64
import json
import os
from urllib.parse import quote
import time
import argparse

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
pat = os.environ.get("AZ_TOKEN")
cookie = os.environ.get("AZ_IMG_COOKIE")
# Create the authorization header using your PAT
# +----------------------------------------------------------+
# | There are two different API sets we need to hit. One     |
# | for retrieving the list of teams, and one for            |
# | retrieving the avatar content. These use different auth  |
# | schemes (Cookie for content, because it has to be        |
# | accessible from `img` element requests, so we set up     |
# | both here and choose which to use later. (must not have  |
# | Authorization` specified for image requests, or you'll   |
# | get a 401'))                                             |
# +----------------------------------------------------------+
authorization = str(base64.b64encode(f":{pat}".encode("utf-8")), "utf-8")
teams_headers = {
    "Authorization": f"Basic {authorization}",
}
headers = {
    "Content-Type": "application/json",
    "Cookie": cookie,
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0',
    'Accept': 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': f'https://dev.azure.com/{organization}/{project}/_git/{repository}/pullrequest/32083',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-origin',
    'Priority': 'u=5',
    'TE': 'trailers',

}

# Create directory for avatars
avatar_dir = f"{output_dir}/azure_devops_avatars"
os.makedirs(avatar_dir, exist_ok=True)

# API version
api_version = "7.1-preview.1"

def get_all_paged_items(base_url, headers):
    """Helper function to get all items from a paged API using various pagination strategies"""
    all_items = []
    # Try different pagination approaches

    # Strategy 1: Try with skip/top parameters (common in older Azure APIs)
    skip = 0
    page_size = 100
    while True:
        url = f"{base_url}&$skip={skip}&$top={page_size}"
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            print(f"Strategy 1 failed: {response.status_code}")
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
        url = base_url
        if continuation_token:
            # Try different formats of continuation token
            if "?" in url:
                url += f"&continuationToken={continuation_token}"
            else:
                url += f"?continuationToken={continuation_token}"

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(f"Strategy 2 failed: {response.status_code}")
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
        url = base_url
        while url:
            response = requests.get(url, headers=headers)

            if response.status_code != 200:
                print(f"Strategy 3 failed: {response.status_code}")
                break

            data = response.json()
            if "value" in data:
                all_items.extend(data["value"])

            # Look for nextLink or similar property
            url = data.get("nextLink") or data.get("next_page") or data.get("continuationUrl") or None

    return all_items

# Get all users
if project:
    # Get all teams if a project is specified
    teams_url = f"https://dev.azure.com/{organization}/_apis/projects/{quote(project)}/teams?api-version={api_version}"
    teams = get_all_paged_items(teams_url, teams_headers)

    all_users = []
    for team in teams:
        team_id = team["id"]
        print(f"Getting members for team: {team['name']}")
        team_url = f"https://dev.azure.com/{organization}/_apis/projects/{quote(project)}/teams/{team_id}/members?api-version={api_version}"
        team_members = get_all_paged_items(team_url, headers)
        all_users.extend(team_members)
        # Add a small delay to avoid rate limiting
        time.sleep(0.5)

    # Remove duplicates by using a dictionary with user IDs as keys
    users_dict = {user["id"]: user for user in all_users}
    users = list(users_dict.values())
    print(f"Found {len(users)} unique users across {len(teams)} teams")
else:
    # Get all users in the organization - try different endpoints
    # Try 1: Users API
    url = f"https://dev.azure.com/{organization}/_apis/users?api-version={api_version}"
    users = get_all_paged_items(url, headers)

    if not users:
        # Try 2: Identities API
        url = f"https://vssps.dev.azure.com/{organization}/_apis/identities?api-version={api_version}"
        users = get_all_paged_items(url, headers)

    print(f"Found {len(users)} users in the organization")

# Save users to JSON file
with open(f"{output_dir}/azure_devops_users.json", "w") as f:
    json.dump({"count": len(users), "value": users}, f, indent=4)

print(f"Exported {len(users)} users to azure_devops_users.json")

# Download avatar for each user
for i, user in enumerate(users):
    user_id = user["id"]
    display_name = user.get("displayName", "unknown")

    # Sanitize display name for filename
    safe_name = "".join([c for c in display_name if c.isalnum() or c in " ._-"]).strip()

    # Use the direct URL format that works for you
    # Size=0 for small, Size=1 for medium, Size=2 for large
    avatar_url = f"https://dev.azure.com/{organization}/_api/_common/identityImage?id={user_id}&size=2"

    # Add progress indicator
    print(f"Downloading avatar for {display_name} ({i+1}/{len(users)})")

    image_response = requests.get(avatar_url, headers=headers)

    if image_response.status_code == 200:
        filename = f"{avatar_dir}/{safe_name}_{user_id}.png"
        with open(filename, "wb") as f:
            f.write(image_response.content)
    else:
        print(f"  Failed to download avatar: {image_response.status_code}")

print("Export complete!")

