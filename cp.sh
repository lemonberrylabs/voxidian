#!/bin/bash

# Variables
SRC_DIR="/Users/ran/dev/Enrico2/voxidian"
DEST_DIR="/Users/ran/dev/lemonberrylabs/voxidian"
ORG="lemonberrylabs"
REPO="voxidian"

# 1. Copy the repository (excluding .git to lose history)
rsync -av --progress "$SRC_DIR/" "$DEST_DIR/" --exclude .git

# 2. Initialize a new git repo
cd "$DEST_DIR"
git init
git add .
git commit -m "Initial commit - migrated from Enrico2/voxidian, history squashed"

# 3. Create a new repo on GitHub (requires gh CLI and authentication)
gh repo create "$ORG/$REPO" --private --source=. --remote=origin --push

# If you want to push manually instead of using gh's --push:
# git remote add origin git@github.com:$ORG/$REPO.git
# git branch -M main
# git push -u origin main

echo "Repository copied and pushed as a single commit to $ORG/$REPO"