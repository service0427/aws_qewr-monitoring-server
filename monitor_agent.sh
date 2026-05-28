#!/bin/bash

# Configuration
SERVER_URL="http://localhost:8000/api/ping"
SERVER_NAME=$(hostname)
IP_ADDRESS=$(hostname -I | awk '{print $1}')

# 1. CPU Usage (percentage)
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

# 2. Memory Usage (percentage)
MEM_USAGE=$(free | grep Mem | awk '{print $3/$2 * 100.0}')

# 3. Disk Usage (percentage of root partition)
DISK_USAGE=$(df / | grep / | awk '{ print $5 }' | sed 's/%//g')

# 4. Uptime
UPTIME=$(uptime -p)

# Create JSON payload
PAYLOAD=$(cat <<EOF
{
  "server_name": "$SERVER_NAME",
  "ip_address": "$IP_ADDRESS",
  "cpu_usage": $CPU_USAGE,
  "mem_usage": $MEM_USAGE,
  "disk_usage": $DISK_USAGE,
  "uptime": "$UPTIME"
}
EOF
)

# Send to Monitoring Server
curl -X POST -H "Content-Type: application/json" -d "$PAYLOAD" $SERVER_URL
