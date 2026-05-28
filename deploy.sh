#!/bin/bash

# Load environment variables
if [ -f ../.env ]; then
    export $(grep -v '^#' ../.env | xargs)
else
    echo "../.env file not found!"
    exit 1
fi

# Configuration
REMOTE_USER="ubuntu"
REMOTE_HOST=$QEWR_SERVER_IP
REMOTE_DIR="~/qewr-monitoring-server"
PEM_KEY=$QEWR_PEM

# Check if PEM key exists
if [ ! -f "$PEM_KEY" ]; then
    echo "PEM key not found at $PEM_KEY"
    exit 1
fi

echo "Deploying to $REMOTE_HOST..."

# Sync files (excluding development-only files)
rsync -avz -e "ssh -i $PEM_KEY -o StrictHostKeyChecking=no" \
    --exclude '.git/' \
    --exclude '.env' \
    --exclude 'node_modules/' \
    --exclude 'README.md' \
    --exclude 'deploy.sh' \
    ./ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR

echo "Deployment complete."
