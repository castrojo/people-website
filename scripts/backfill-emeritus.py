#!/usr/bin/env python3
"""One-time backfill of people-emeritus.json from cncf/people git history."""

import json
import subprocess
import sys
import time
from datetime import datetime

REPO = "cncf/people"
FILE = "people.json"
SINCE = "2023-01-01T00:00:00Z"
OUT = "src/data/people-emeritus.json"

def gh_api(endpoint, **kwargs):
    if kwargs:
        params = "&".join(f"{k}={v}" for k, v in kwargs.items())
        endpoint = f"{endpoint}?{params}"
    cmd = ["gh", "api", endpoint]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: {result.stderr}", file=sys.stderr)
        return None
    return json.loads(result.stdout)

def get_file_at_sha(sha):
    data = gh_api(f"repos/{REPO}/contents/{FILE}", ref=sha)
    if not data or 'download_url' not in data:
        return None
    try:
        import urllib.request
        return json.loads(urllib.request.urlopen(data['download_url']).read())
    except (json.JSONDecodeError, Exception) as e:
        print(f"  Warning: couldn't parse JSON at {sha[:8]}: {e}", file=sys.stderr)
        return None

def extract_handle(github_url):
    if not github_url:
        return ""
    return github_url.replace("https://github.com/", "").replace("http://www.github.com/", "").strip("/").lower()

def main():
    print("Fetching commit history...")
    commits = []
    page = 1
    while True:
        data = gh_api(f"repos/{REPO}/commits",
                      path=FILE, since=SINCE, per_page=100, page=page)
        if not data:
            break
        commits.extend(data)
        if len(data) < 100:
            break
        page += 1

    print(f"Found {len(commits)} commits since {SINCE}")
    commits.reverse()  # oldest first

    # Get current HEAD to filter out still-active people
    print("Fetching current HEAD...")
    current_raw = get_file_at_sha("main")
    if not current_raw:
        print("Failed to fetch current HEAD", file=sys.stderr)
        sys.exit(1)
    active_handles = set(
        extract_handle(p.get("github", ""))
        for p in current_raw
        if p.get("github", "")
    )
    active_handles.discard("")
    print(f"Active handles: {len(active_handles)}")

    # Walk pairs of commits, diff for removals
    emeritus = {}  # handle -> entry (deduplicated, first removal wins)
    prev_people = None

    for i, commit in enumerate(commits):
        sha = commit["sha"]
        date = commit["commit"]["committer"]["date"][:10]
        print(f"Processing commit {i+1}/{len(commits)}: {sha[:8]} ({date})")

        current_people = get_file_at_sha(sha)
        if current_people is None:
            print(f"  Skipping (couldn't fetch)")
            continue

        if prev_people is not None:
            prev_handles = {extract_handle(p.get("github","")): p for p in prev_people if extract_handle(p.get("github",""))}
            curr_handles = {extract_handle(p.get("github","")): p for p in current_people if extract_handle(p.get("github",""))}

            for handle, person in prev_handles.items():
                if handle and handle not in curr_handles and handle not in active_handles:
                    if handle not in emeritus:
                        emeritus[handle] = {
                            "handle": handle,
                            "name": person.get("name", handle),
                            "category": person.get("category", []),
                            "removedDate": date
                        }
                        print(f"  Removed: @{handle} ({person.get('name', '')})")

        prev_people = current_people
        time.sleep(0.2)  # gentle rate limiting

    # Seed known manual removals not captured in the date range
    seeds = [
        {"handle": "craigbox", "name": "Craig Box", "category": ["Ambassadors"], "removedDate": "2025-01-01"},
        {"handle": "garry-cairns", "name": "Garry Cairns", "category": ["End User TAB"], "removedDate": "2025-01-01"},
        {"handle": "nunix", "name": "Nuno Do Carmo", "category": ["Ambassadors"], "removedDate": "2026-03-05"},
    ]
    for seed in seeds:
        if seed["handle"] not in emeritus and seed["handle"] not in active_handles:
            emeritus[seed["handle"]] = seed
            print(f"  Seeded: @{seed['handle']}")

    result = sorted(emeritus.values(), key=lambda x: x.get("removedDate", ""), reverse=True)

    with open(OUT, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nWrote {len(result)} emeritus entries to {OUT}")

if __name__ == "__main__":
    main()
