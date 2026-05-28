#!/bin/bash

# Qewr Monitoring Server Maintenance Setup
# This script sets up cron jobs for DB cleanup and configures log rotation.

PROJECT_DIR="/home/ubuntu/qewr-monitoring-server"
PYTHON_VENV="$PROJECT_DIR/venv/bin/python"

echo "Setting up DB cleanup cron job..."

# Create a temporary crontab file
crontab -l > mycron 2>/dev/null || touch mycron

# Add daily cleanup at 3:00 AM if not already exists
CLEANUP_JOB="0 3 * * * cd $PROJECT_DIR && $PYTHON_VENV cleanup_db.py >> $PROJECT_DIR/cleanup.log 2>&1"
if ! grep -q "cleanup_db.py" mycron; then
    echo "$CLEANUP_JOB" >> mycron
    crontab mycron
    echo "Cron job added: Daily at 3:00 AM"
else
    echo "Cron job already exists."
fi
rm mycron

# PM2 Log Rotation
echo "Setting up PM2 log rotation..."
if pm2 list | grep -q "qewr-api"; then
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 5
    echo "PM2 logrotate configured (10MB max, 5 files retain)."
else
    echo "PM2 process 'qewr-api' not found. Skipping logrotate setup."
fi

# Apply DB Schema changes (Add index)
echo "Applying database schema changes (indexing)..."
cd $PROJECT_DIR && $PYTHON_VENV models.py

echo "Maintenance setup complete."
