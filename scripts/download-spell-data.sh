#!/bin/bash

# The local directory to save files into.
# It will be created if it doesn't exist.
DATA_DIR="data"
mkdir -p "$DATA_DIR"

# The base URL for raw file content on GitHub.
BASE_URL="https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells"

# The GitHub API URL to get the contents of the spells directory.
API_URL="https://api.github.com/repos/5etools-mirror-3/5etools-src/contents/data/spells"

echo "Fetching file list from GitHub..."

# Fetch the list of files from the GitHub API, filter for the desired json files,
# and then download each one.
curl -s "$API_URL" | \
jq -r '.[] | select(.type == "file" and (.name | (startswith("spells-") and endswith(".json")) or . == "sources.json")) | .name' | \
while read -r filename; do
  echo "Downloading $filename..."
  curl -s -o "$DATA_DIR/$filename" "$BASE_URL/$filename"
done

echo "Download complete. Files are in the '$DATA_DIR' directory."
