#!/bin/bash

#####################################################################
# Data Backup Script
# 
# This script creates backups of the platform data
# Usage: backup-data.sh [backup_type]
#####################################################################

set -euo pipefail

BACKUP_TYPE="${1:-full}"
BACKUP_DIR="/opt/media-platform/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PLATFORM_DIR="/opt/media-platform"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "/var/log/media-platform-backup.log"
}

error() {
    echo "[ERROR] $1" | tee -a "/var/log/media-platform-backup.log"
    exit 1
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting $BACKUP_TYPE backup at $TIMESTAMP"

case "$BACKUP_TYPE" in
    "database"|"db")
        log "Creating database backup"
        BACKUP_FILE="$BACKUP_DIR/database-$TIMESTAMP.sql.gz"
        
        # Dump PostgreSQL database
        docker exec media-platform-postgres pg_dump -U postgres mediaplatform | gzip > "$BACKUP_FILE"
        
        if [[ -f "$BACKUP_FILE" ]]; then
            log "Database backup created: $BACKUP_FILE"
            log "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
        else
            error "Database backup failed"
        fi
        ;;
        
    "configs"|"config")
        log "Creating configuration backup"
        BACKUP_FILE="$BACKUP_DIR/configs-$TIMESTAMP.tar.gz"
        
        # Backup configuration files
        tar -czf "$BACKUP_FILE" \
            -C "$PLATFORM_DIR" \
            .env \
            docker-compose.yml \
            nginx/nginx.conf \
            monitoring/ \
            scripts/ \
            2>/dev/null || true
            
        if [[ -f "$BACKUP_FILE" ]]; then
            log "Configuration backup created: $BACKUP_FILE"
            log "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
        else
            error "Configuration backup failed"
        fi
        ;;
        
    "customer-data")
        log "Creating customer data backup"
        BACKUP_FILE="$BACKUP_DIR/customer-data-$TIMESTAMP.tar.gz"
        
        # Backup all customer storage
        if [[ -d "/mnt/hetzner-storage" ]]; then
            tar -czf "$BACKUP_FILE" -C /mnt hetzner-storage/
            
            if [[ -f "$BACKUP_FILE" ]]; then
                log "Customer data backup created: $BACKUP_FILE"
                log "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
            else
                error "Customer data backup failed"
            fi
        else
            log "No customer data directory found"
        fi
        ;;
        
    "full"|*)
        log "Creating full platform backup"
        
        # Create temporary directory for full backup
        TEMP_DIR=$(mktemp -d)
        FULL_BACKUP_DIR="$TEMP_DIR/media-platform-backup-$TIMESTAMP"
        mkdir -p "$FULL_BACKUP_DIR"
        
        # Database backup
        log "Backing up database..."
        docker exec media-platform-postgres pg_dump -U postgres mediaplatform | gzip > "$FULL_BACKUP_DIR/database.sql.gz"
        
        # Configuration backup
        log "Backing up configurations..."
        cp -r "$PLATFORM_DIR"/.env "$FULL_BACKUP_DIR/" 2>/dev/null || true
        cp -r "$PLATFORM_DIR"/docker-compose.yml "$FULL_BACKUP_DIR/" 2>/dev/null || true
        cp -r "$PLATFORM_DIR"/nginx "$FULL_BACKUP_DIR/" 2>/dev/null || true
        cp -r "$PLATFORM_DIR"/monitoring "$FULL_BACKUP_DIR/" 2>/dev/null || true
        cp -r "$PLATFORM_DIR"/scripts "$FULL_BACKUP_DIR/" 2>/dev/null || true
        
        # Docker volumes backup
        log "Backing up Docker volumes..."
        mkdir -p "$FULL_BACKUP_DIR/volumes"
        
        # Prometheus data
        docker run --rm -v media-platform_prometheus_data:/data -v "$FULL_BACKUP_DIR/volumes":/backup alpine tar -czf /backup/prometheus.tar.gz -C /data . 2>/dev/null || true
        
        # Grafana data
        docker run --rm -v media-platform_grafana_data:/data -v "$FULL_BACKUP_DIR/volumes":/backup alpine tar -czf /backup/grafana.tar.gz -C /data . 2>/dev/null || true
        
        # Customer data (if exists)
        if [[ -d "/mnt/hetzner-storage" ]]; then
            log "Backing up customer data..."
            tar -czf "$FULL_BACKUP_DIR/customer-data.tar.gz" -C /mnt hetzner-storage/ 2>/dev/null || true
        fi
        
        # Create final compressed backup
        BACKUP_FILE="$BACKUP_DIR/full-backup-$TIMESTAMP.tar.gz"
        tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" "media-platform-backup-$TIMESTAMP"
        
        # Cleanup temp directory
        rm -rf "$TEMP_DIR"
        
        if [[ -f "$BACKUP_FILE" ]]; then
            log "Full backup created: $BACKUP_FILE"
            log "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
        else
            error "Full backup failed"
        fi
        ;;
esac

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true

# Update backup status file
echo "$TIMESTAMP,$BACKUP_TYPE,$(basename "$BACKUP_FILE"),$(du -b "$BACKUP_FILE" 2>/dev/null | cut -f1 || echo 0)" >> "$BACKUP_DIR/backup-history.csv"

log "Backup completed successfully"

# Output JSON for API consumption
cat << EOF
{
    "success": true,
    "backupType": "$BACKUP_TYPE",
    "backupFile": "$BACKUP_FILE",
    "timestamp": "$TIMESTAMP",
    "size": $(du -b "$BACKUP_FILE" 2>/dev/null | cut -f1 || echo 0)
}
EOF