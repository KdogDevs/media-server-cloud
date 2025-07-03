#!/bin/bash

#####################################################################
# Customer Container Cleanup Script
# 
# This script removes a customer's media server container and data
# Usage: cleanup-customer.sh <user_id> <container_name>
#####################################################################

set -euo pipefail

USER_ID="$1"
CONTAINER_NAME="$2"

# Configuration
STORAGE_PATH="/mnt/hetzner-storage/${USER_ID}"
BACKUP_PATH="/opt/media-platform/backups"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "/var/log/media-platform-cleanup.log"
}

error() {
    echo "[ERROR] $1" | tee -a "/var/log/media-platform-cleanup.log"
    exit 1
}

# Validate inputs
if [[ -z "$USER_ID" || -z "$CONTAINER_NAME" ]]; then
    error "Usage: $0 <user_id> <container_name>"
fi

log "Starting cleanup for user $USER_ID container $CONTAINER_NAME"

# Check if container exists
if ! docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    log "Warning: Container $CONTAINER_NAME does not exist"
else
    log "Stopping container: $CONTAINER_NAME"
    docker stop "$CONTAINER_NAME" || true
    
    log "Removing container: $CONTAINER_NAME"
    docker rm "$CONTAINER_NAME" || true
fi

# Remove container volumes
CONFIG_VOLUME="${CONTAINER_NAME}-config"
if docker volume ls | grep -q "$CONFIG_VOLUME"; then
    log "Removing container config volume: $CONFIG_VOLUME"
    docker volume rm "$CONFIG_VOLUME" || true
fi

# Create backup of user data before deletion
if [[ -d "$STORAGE_PATH" ]]; then
    BACKUP_NAME="user-${USER_ID}-$(date +%Y%m%d-%H%M%S)"
    BACKUP_FILE="${BACKUP_PATH}/${BACKUP_NAME}.tar.gz"
    
    log "Creating backup: $BACKUP_FILE"
    mkdir -p "$BACKUP_PATH"
    
    # Create compressed backup
    tar -czf "$BACKUP_FILE" -C "$(dirname "$STORAGE_PATH")" "$(basename "$STORAGE_PATH")" || {
        log "Warning: Backup creation failed"
    }
    
    # Remove original storage
    log "Removing storage directory: $STORAGE_PATH"
    rm -rf "$STORAGE_PATH" || {
        log "Warning: Failed to remove storage directory"
    }
    
    # Keep backup for 30 days, then remove
    echo "find '$BACKUP_PATH' -name 'user-${USER_ID}-*.tar.gz' -mtime +30 -delete" | at now + 30 days 2>/dev/null || true
else
    log "Storage directory $STORAGE_PATH does not exist"
fi

# Clean up any orphaned Docker images (optional)
log "Cleaning up unused Docker images"
docker image prune -f || true

# Remove user from any nginx configurations (if needed)
# This would typically be handled by the backend API

log "Cleanup completed for user $USER_ID"

# Output JSON for API consumption
cat << EOF
{
    "success": true,
    "userId": "$USER_ID",
    "containerName": "$CONTAINER_NAME",
    "backupCreated": $([ -f "$BACKUP_FILE" ] && echo "true" || echo "false"),
    "backupPath": "${BACKUP_FILE:-null}",
    "cleanupDate": "$(date -Iseconds)"
}
EOF