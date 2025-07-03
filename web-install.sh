#!/bin/bash

#####################################################################
# Media Server Hosting Platform - Web Installation Script
# Version: 1.0.0
# 
# This script downloads and sets up the media server hosting platform
# Usage: curl -fsSL https://raw.githubusercontent.com/KdogDevs/media-server-cloud/main/web-install.sh | sudo bash
#####################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/KdogDevs/media-server-cloud.git"
REPO_BRANCH="main"
TEMP_DIR="/tmp/media-platform-install-$$"
PLATFORM_DIR="/opt/media-platform"
LOG_FILE="/var/log/media-platform-setup.log"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    cleanup_and_exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup_and_exit() {
    local exit_code=${1:-0}
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
    exit $exit_code
}

# Trap to ensure cleanup happens
trap 'cleanup_and_exit 1' INT TERM

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if Ubuntu
    if ! grep -q "Ubuntu" /etc/os-release; then
        warn "This script is designed for Ubuntu. Other distributions may not work properly."
    fi
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        log "Installing git..."
        apt-get update -qq
        apt-get install -y git
    fi
    
    # Check if curl is installed  
    if ! command -v curl &> /dev/null; then
        log "Installing curl..."
        apt-get update -qq
        apt-get install -y curl
    fi
}

# Download latest source code
download_source() {
    log "Downloading latest source code from GitHub..."
    
    # Create temporary directory
    mkdir -p "$TEMP_DIR"
    
    # Clone the repository
    if git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$TEMP_DIR"; then
        log "Source code downloaded successfully"
    else
        error "Failed to download source code from $REPO_URL"
    fi
}

# Check for existing installation
check_existing_installation() {
    if [[ -d "$PLATFORM_DIR" && -f "$PLATFORM_DIR/.env" ]]; then
        log "Existing installation detected at $PLATFORM_DIR"
        info "This will update the existing installation"
        return 0
    else
        log "No existing installation found - performing fresh install"
        return 1
    fi
}

# Run the main setup script
run_setup() {
    log "Running main setup script..."
    
    # Change to the downloaded directory
    cd "$TEMP_DIR"
    
    # Make the setup script executable
    chmod +x setup.sh
    
    # Run the setup script
    if ./setup.sh; then
        log "Setup completed successfully"
    else
        error "Setup script failed"
    fi
}

# Main execution
main() {
    log "Starting Media Platform web installation..."
    
    check_root
    check_requirements
    
    # Check if update or fresh install
    if check_existing_installation; then
        log "Updating existing installation..."
    else
        log "Performing fresh installation..."
    fi
    
    download_source
    run_setup
    
    log "Installation completed successfully!"
    log "Access points:"
    log "  - Frontend: http://localhost:3000"
    log "  - Backend API: http://localhost:4000"
    log "  - Admin Panel: http://localhost:3000/admin"
    log "  - Grafana: http://localhost:3002"
    log "  - Prometheus: http://localhost:9090"
    
    cleanup_and_exit 0
}

# Run main function
main "$@"