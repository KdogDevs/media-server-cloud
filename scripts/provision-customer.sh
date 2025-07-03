#!/bin/bash

#####################################################################
# Customer Container Provisioning Script
# 
# This script provisions a new media server container for a customer
# Usage: provision-customer.sh <user_id> <subdomain> <media_type>
#####################################################################

set -euo pipefail

USER_ID="$1"
SUBDOMAIN="$2"
MEDIA_TYPE="${3:-JELLYFIN}"

# Configuration
PLATFORM_DIR="/opt/media-platform"
CONTAINER_NAME="media-${USER_ID}-${SUBDOMAIN}"
STORAGE_PATH="/mnt/hetzner-storage/${USER_ID}"
CPU_LIMIT="0.25"
MEMORY_LIMIT="800m"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "/var/log/media-platform-provision.log"
}

error() {
    echo "[ERROR] $1" | tee -a "/var/log/media-platform-provision.log"
    exit 1
}

# Validate inputs
if [[ -z "$USER_ID" || -z "$SUBDOMAIN" ]]; then
    error "Usage: $0 <user_id> <subdomain> [media_type]"
fi

log "Starting provisioning for user $USER_ID with subdomain $SUBDOMAIN"

# Check if container already exists
if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    error "Container $CONTAINER_NAME already exists"
fi

# Create storage directory
log "Creating storage directory: $STORAGE_PATH"
mkdir -p "$STORAGE_PATH"
chown 1000:1000 "$STORAGE_PATH"

# Create Docker network if it doesn't exist
if ! docker network ls | grep -q "media-platform_media-platform"; then
    log "Creating Docker network"
    docker network create media-platform_media-platform || true
fi

# Determine Docker image based on media type
case "$MEDIA_TYPE" in
    "JELLYFIN")
        IMAGE="jellyfin/jellyfin:latest"
        PORT="8096"
        ENV_VARS=(
            "JELLYFIN_PublishedServerUrl=https://${SUBDOMAIN}.${DOMAIN:-example.com}"
            "TZ=UTC"
            "PUID=1000"
            "PGID=1000"
        )
        ;;
    "PLEX")
        IMAGE="plexinc/pms-docker:latest"
        PORT="32400"
        ENV_VARS=(
            "PLEX_CLAIM="
            "ADVERTISE_IP=https://${SUBDOMAIN}.${DOMAIN:-example.com}:443"
            "TZ=UTC"
            "PUID=1000"
            "PGID=1000"
        )
        ;;
    "EMBY")
        IMAGE="emby/embyserver:latest"
        PORT="8096"
        ENV_VARS=(
            "TZ=UTC"
            "PUID=1000"
            "PGID=1000"
        )
        ;;
    *)
        error "Unsupported media type: $MEDIA_TYPE"
        ;;
esac

log "Pulling Docker image: $IMAGE"
docker pull "$IMAGE"

# Build environment variables string
ENV_STRING=""
for env in "${ENV_VARS[@]}"; do
    ENV_STRING="$ENV_STRING -e $env"
done

log "Creating container: $CONTAINER_NAME"

# Create and start container
docker run -d \
    --name "$CONTAINER_NAME" \
    --network media-platform_media-platform \
    --restart unless-stopped \
    --cpus="$CPU_LIMIT" \
    --memory="$MEMORY_LIMIT" \
    -v "${STORAGE_PATH}:/media" \
    -v "${CONTAINER_NAME}-config:/config" \
    -p "${PORT}" \
    $ENV_STRING \
    --label "media-platform.user=${USER_ID}" \
    --label "media-platform.type=${MEDIA_TYPE,,}" \
    --label "media-platform.subdomain=${SUBDOMAIN}" \
    "$IMAGE"

# Wait for container to be running
log "Waiting for container to start..."
for i in {1..30}; do
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep "$CONTAINER_NAME" | grep -q "Up"; then
        log "Container started successfully"
        break
    fi
    if [ $i -eq 30 ]; then
        error "Container failed to start within 30 seconds"
    fi
    sleep 1
done

# Get assigned port
ASSIGNED_PORT=$(docker port "$CONTAINER_NAME" "$PORT/tcp" | cut -d: -f2)
log "Container assigned to port: $ASSIGNED_PORT"

# Configure Nginx for the new subdomain (if needed)
# This would typically be handled by the backend API

# Health check
log "Performing health check..."
for i in {1..60}; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$ASSIGNED_PORT" | grep -q "200\|302"; then
        log "Health check passed"
        break
    fi
    if [ $i -eq 60 ]; then
        log "Warning: Health check failed, but container is running"
        break
    fi
    sleep 2
done

log "Provisioning completed successfully for $CONTAINER_NAME"
log "Container URL: https://${SUBDOMAIN}.${DOMAIN:-example.com}"
log "Local URL: http://localhost:$ASSIGNED_PORT"

# Output JSON for API consumption
cat << EOF
{
    "success": true,
    "containerName": "$CONTAINER_NAME",
    "dockerId": "$(docker ps -q -f name=$CONTAINER_NAME)",
    "assignedPort": "$ASSIGNED_PORT",
    "mediaType": "$MEDIA_TYPE",
    "subdomain": "$SUBDOMAIN",
    "storageePath": "$STORAGE_PATH",
    "url": "https://${SUBDOMAIN}.${DOMAIN:-example.com}"
}
EOF