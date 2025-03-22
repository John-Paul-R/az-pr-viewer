#!/usr/bin/env python3
"""
Export Azure DevOps users and their avatars.
"""

import os
import json
import time
import argparse
from az_requests import AzureDevOpsClient

# Parse command-line arguments
parser = argparse.ArgumentParser(description='Export Azure DevOps users and avatars')
parser.add_argument('--org', required=True, help='Azure DevOps organization name')
parser.add_argument('--project', required=False, help='Azure DevOps project name')
parser.add_argument('--repo', required=False, help='Azure DevOps repository name')
parser.add_argument('--output-dir', required=True, help='Directory to save user data')
args = parser.parse_args()

# Create output directory
output_dir = args.output_dir
os.makedirs(output_dir, exist_ok=True)

# Create directory for avatars
avatar_dir = f"{output_dir}/azure_devops_avatars"
os.makedirs(avatar_dir, exist_ok=True)

# Initialize Azure DevOps client
client = AzureDevOpsClient(
    organization=args.org,
    project=args.project,
    repository=args.repo
)

# Get all users
users = []

if args.project:
    # Get all teams if a project is specified
    print(f"Getting teams for project: {args.project}")
    teams = client.get_teams()
    
    all_users = []
    for team in teams:
        team_id = team["id"]
        print(f"Getting members for team: {team['name']}")
        team_members = client.get_team_members(team_id)
        all_users.extend(team_members)
        # Add a small delay to avoid rate limiting
        time.sleep(0.5)
    
    # Remove duplicates by using a dictionary with user IDs as keys
    users_dict = {user["id"]: user for user in all_users}
    users = list(users_dict.values())
    print(f"Found {len(users)} unique users across {len(teams)} teams")
else:
    # Get all users in the organization
    print(f"Getting all users in the organization")
    users = client.get_users()
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
    
    # Get avatar URL
    avatar_url = client.get_avatar_url(user_id, size=2)
    
    # Add progress indicator
    print(f"Downloading avatar for {display_name} ({i+1}/{len(users)})")
    
    # Save avatar to file
    filename = f"{avatar_dir}/{safe_name}_{user_id}.png"
    client.download_file(avatar_url, filename, use_content_headers=True)

print("Export complete!")
