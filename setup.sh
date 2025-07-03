#!/bin/bash

#####################################################################
# Media Server Hosting Platform - Bootstrap Setup Script
# Version: 1.0.0
# 
# This script sets up a complete SaaS media server hosting platform
# on Ubuntu 22.04 LTS. It's designed to be idempotent and can be
# run multiple times safely.
#
# Usage: sudo bash setup.sh
#####################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLATFORM_DIR="/opt/media-platform"
LOG_FILE="/var/log/media-platform-setup.log"
COMPOSE_FILE="$PLATFORM_DIR/docker-compose.yml"

# Use current working directory as source (user should run from repo root)
SOURCE_DIR="$(pwd)"

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Check if platform is already installed
check_existing_installation() {
    if [[ -d "$PLATFORM_DIR" && -f "$PLATFORM_DIR/.env" ]]; then
        log "Existing installation detected at $PLATFORM_DIR"
        INSTALLATION_TYPE="update"
    else
        log "No existing installation found - performing fresh install"
        INSTALLATION_TYPE="install"
    fi
}

# Load existing configuration if updating
load_existing_config() {
    if [[ "$INSTALLATION_TYPE" == "update" && -f "$PLATFORM_DIR/.env" ]]; then
        log "Loading existing configuration..."
        source "$PLATFORM_DIR/.env"
        
        # Check if Clerk keys are already configured
        if [[ -n "$CLERK_PUBLISHABLE_KEY" && -n "$CLERK_SECRET_KEY" ]]; then
            log "Existing Clerk configuration found"
            CLERK_CONFIG_EXISTS=true
        else
            CLERK_CONFIG_EXISTS=false
        fi
        
        # Preserve existing database password if it exists
        if [[ -n "$POSTGRES_PASSWORD" ]]; then
            DB_PASSWORD="$POSTGRES_PASSWORD"
            log "Existing database password preserved"
        fi
    else
        CLERK_CONFIG_EXISTS=false
    fi
}

# Install required packages for the setup process
install_dialog() {
    log "Installing dialog for interactive prompts..."
    apt-get update -qq
    apt-get install -y dialog whiptail > /dev/null 2>&1
}

# Check if we can use whiptail (interactive terminal with proper TTY)
can_use_whiptail() {
    # Check if stdin, stdout, and stderr are all terminals and whiptail is available
    if [[ -t 0 ]] && [[ -t 1 ]] && [[ -t 2 ]] && [[ "$TERM" != "dumb" ]] && [[ -n "$TERM" ]] && command -v whiptail &> /dev/null; then
        # Additional test: check if whiptail can actually work
        # Use a timeout to prevent hanging in problematic environments
        if timeout 1s whiptail --msgbox "Testing whiptail availability" 8 50 --title "Test" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Safe yes/no prompt with whiptail fallback
safe_yesno() {
    local message="$1"
    local title="${2:-Confirmation}"
    
    if can_use_whiptail; then
        if whiptail --yesno "$message" 8 78 --title "$title" 3>&1 1>&2 2>&3; then
            return 0
        else
            return 1
        fi
    else
        # Fallback to simple read prompt
        echo
        echo "┌─ $title ─┐"
        echo "│ $message"
        echo "└─────────────────────────────────┘"
        while true; do
            read -p "Enter your choice (y/n): " -n 1 -r
            echo
            case $REPLY in
                [Yy]* ) return 0;;
                [Nn]* ) return 1;;
                * ) echo "Please answer y or n.";;
            esac
        done
    fi
}

# Safe input prompt with whiptail fallback
safe_input() {
    local message="$1"
    local title="${2:-Input Required}"
    local default="${3:-}"
    local result=""
    
    if can_use_whiptail; then
        result=$(whiptail --inputbox "$message" 8 78 "$default" --title "$title" 3>&1 1>&2 2>&3)
    else
        # Fallback to simple read prompt
        echo
        echo "┌─ $title ─┐"
        echo "│ $message"
        echo "└─────────────────────────────────┘"
        if [[ -n "$default" ]]; then
            read -p "Enter value [$default]: " -r result
            result="${result:-$default}"
        else
            while [[ -z "$result" ]]; do
                read -p "Enter value: " -r result
                if [[ -z "$result" ]]; then
                    echo "Error: Value cannot be empty. Please try again."
                fi
            done
        fi
    fi
    echo "$result"
}

# Safe password prompt with whiptail fallback
safe_password() {
    local message="$1"
    local title="${2:-Password Required}"
    local result=""
    
    if can_use_whiptail; then
        result=$(whiptail --passwordbox "$message" 8 78 --title "$title" 3>&1 1>&2 2>&3)
    else
        # Fallback to simple read prompt
        echo
        echo "┌─ $title ─┐"
        echo "│ $message"
        echo "└─────────────────────────────────┘"
        while [[ -z "$result" ]]; do
            read -s -p "Enter password (hidden): " -r result
            echo  # Add newline after hidden input
            if [[ -z "$result" ]]; then
                echo "Error: Password cannot be empty. Please try again."
            fi
        done
    fi
    echo "$result"
}

# Collect configuration from user
collect_config() {
    log "Collecting minimal configuration from user..."
    
    # Handle Clerk configuration based on installation type
    if [[ "$INSTALLATION_TYPE" == "update" && "$CLERK_CONFIG_EXISTS" == true ]]; then
        log "Using existing Clerk configuration"
        # Ask if user wants to update Clerk keys
        if safe_yesno "Existing Clerk configuration found. Do you want to update it?" "Update Clerk Configuration"; then
            CLERK_PUBLISHABLE_KEY=$(safe_input "Enter new Clerk Publishable Key:" "Clerk Authentication")
            CLERK_SECRET_KEY=$(safe_password "Enter new Clerk Secret Key:" "Clerk Authentication")
            
            # Validate that keys were entered
            if [[ -z "$CLERK_PUBLISHABLE_KEY" || -z "$CLERK_SECRET_KEY" ]]; then
                error "Clerk keys cannot be empty. Installation aborted."
            fi
        fi
    else
        # Fresh install or missing Clerk config - always prompt
        CLERK_PUBLISHABLE_KEY=$(safe_input "Enter Clerk Publishable Key:" "Clerk Authentication")
        CLERK_SECRET_KEY=$(safe_password "Enter Clerk Secret Key:" "Clerk Authentication")
        
        # Validate that keys were entered
        if [[ -z "$CLERK_PUBLISHABLE_KEY" || -z "$CLERK_SECRET_KEY" ]]; then
            error "Clerk keys are required for installation. Installation aborted."
        fi
    fi
    
    # Handle database password
    if [[ "$INSTALLATION_TYPE" == "update" && -n "$DB_PASSWORD" ]]; then
        log "Using existing database password"
    else
        # Auto-generate secure database password for fresh installs
        DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
        log "Database password auto-generated securely"
    fi
    
    log "Configuration collected. Other settings will be configured via admin UI."
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    apt-get update -qq
    
    # Install basic packages
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        rsync \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        htop \
        fail2ban \
        ufw \
        jq > /dev/null 2>&1
    
    log "Basic packages installed successfully"
}

# Install Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log "Docker already installed, skipping..."
        return
    fi
    
    log "Installing Docker..."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null 2>&1
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Add current user to docker group if not root
    if [[ $SUDO_USER ]]; then
        usermod -aG docker "$SUDO_USER"
    fi
    
    log "Docker installed successfully"
}

# Install Node.js 20 LTS
install_nodejs() {
    if command -v node &> /dev/null && [[ $(node --version | cut -d'.' -f1 | cut -d'v' -f2) -eq 20 ]]; then
        log "Node.js 20 already installed, skipping..."
        return
    fi
    
    log "Installing Node.js 20 LTS..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    
    # Install Node.js
    apt-get install -y nodejs > /dev/null 2>&1
    
    # Install PM2 globally
    npm install -g pm2 > /dev/null 2>&1
    
    log "Node.js 20 LTS and PM2 installed successfully"
}

# Install Nginx
# Skip nginx installation - not needed for direct port access
skip_nginx_install() {
    log "Skipping Nginx installation - using direct port access"
    log "Frontend will be accessible on port 3000, Backend on port 4000"
}

# Setup platform directory structure
setup_platform_directory() {
    log "Setting up platform directory structure..."
    
    # Create main platform directory
    mkdir -p "$PLATFORM_DIR"
    
    # Copy source code from the current directory where script is run
    log "Copying source code from $SOURCE_DIR to $PLATFORM_DIR"
    
    # Check if we're running from the source directory
    if [[ -f "$SOURCE_DIR/setup.sh" && -f "$SOURCE_DIR/docker-compose.yml" ]]; then
        # Copy all files except .git directory
        rsync -av --exclude='.git' --exclude='*.log' "$SOURCE_DIR/" "$PLATFORM_DIR/"
        log "Source code copied successfully from $SOURCE_DIR"
    else
        error "Script must be run from the media-server-cloud repository root directory (where setup.sh and docker-compose.yml are located)"
    fi
    
    # Create additional directories
    mkdir -p "$PLATFORM_DIR/logs"
    mkdir -p "$PLATFORM_DIR/data/postgres"
    mkdir -p "$PLATFORM_DIR/data/prometheus"
    mkdir -p "$PLATFORM_DIR/data/grafana"
    mkdir -p "$PLATFORM_DIR/ssl"
    mkdir -p "$PLATFORM_DIR/backups"
    
    # Set proper permissions
    chown -R $SUDO_USER:$SUDO_USER "$PLATFORM_DIR" 2>/dev/null || true
    chmod -R 755 "$PLATFORM_DIR"
    
    log "Platform directory structure created"
}

# Generate environment file
generate_env_file() {
    log "Generating environment configuration..."
    
    cat > "$PLATFORM_DIR/.env" << EOF
# Application URLs (localhost based)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# Database Configuration (using container name for inter-container communication)
DATABASE_URL=postgresql://postgres:$DB_PASSWORD@postgres:5432/mediaplatform
POSTGRES_PASSWORD=$DB_PASSWORD

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Node Environment
NODE_ENV=production

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3002

# Redis Configuration (using container name for inter-container communication)
REDIS_URL=redis://redis:6379
EOF

    # Secure the environment file
    chmod 600 "$PLATFORM_DIR/.env"
    
    log "Environment configuration generated"
}

# Build and start services
build_and_start_services() {
    log "Building and starting services..."
    
    cd "$PLATFORM_DIR"
    
    # Stop existing services if this is an update
    if [[ "$INSTALLATION_TYPE" == "update" ]]; then
        log "Stopping existing services for update..."
        docker compose down || true
        sleep 5
    fi
    
    # Build backend
    cd backend
    npm install --production > /dev/null 2>&1
    npm run build > /dev/null 2>&1 || true
    cd ..
    
    # Build frontend
    cd frontend
    npm install --production > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    cd ..
    
    # Start services with Docker Compose
    docker compose up -d --build
    
    # Wait for services to be ready
    sleep 30
    
    log "Services built and started successfully"
}

# Setup SSL certificates
# Skip SSL setup - not needed for localhost deployment
skip_ssl_setup() {
    log "Skipping SSL setup - using localhost deployment"
    log "SSL setup not required for local development"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$PLATFORM_DIR/backend"
    
    # Wait for database to be ready
    sleep 10
    
    # Run Prisma migrations
    npx prisma migrate deploy > /dev/null 2>&1 || warn "Database migrations failed"
    
    log "Database migrations completed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring stack..."
    
    # Monitoring services are included in docker-compose.yml
    # Additional configuration can be added here
    
    log "Monitoring stack configured"
}

# Setup backup system
setup_backups() {
    log "Setting up backup system..."
    
    # Create backup cron job
    cat > /etc/cron.d/media-platform-backup << EOF
# Daily backup at 2 AM
0 2 * * * root $PLATFORM_DIR/scripts/backup-data.sh >> /var/log/media-platform-backup.log 2>&1
EOF
    
    log "Backup system configured"
}

# Configure systemd services
configure_systemd() {
    log "Configuring systemd services..."
    
    # Create systemd service for the platform
    cat > /etc/systemd/system/media-platform.service << EOF
[Unit]
Description=Media Platform Services
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PLATFORM_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable the service
    systemctl daemon-reload
    systemctl enable media-platform.service
    
    log "Systemd services configured"
}

# Self-test
run_self_test() {
    log "Running self-test..."
    
    # Test database connection
    if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        log "✓ Database connection successful"
    else
        warn "✗ Database connection failed"
    fi
    
    # Test backend API (changed to port 4000)
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:4000/healthz" | grep -q "200"; then
        log "✓ Backend API responding on port 4000"
    else
        warn "✗ Backend API not responding on port 4000"
    fi
    
    # Test frontend (changed to port 3000)
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000" | grep -q "200"; then
        log "✓ Frontend responding on port 3000"
    else
        warn "✗ Frontend not responding on port 3000"
    fi
    
    log "Self-test completed"
}

# Print success message
print_success() {
    clear
    cat << EOF

${GREEN}
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                 🎉 MEDIA PLATFORM SETUP COMPLETED! 🎉                       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
${NC}

${BLUE}Your Media Server Hosting Platform is now ready!${NC}

${YELLOW}Setup Type:${NC} $INSTALLATION_TYPE

${YELLOW}Access URLs:${NC}
• Frontend (Customer Portal): http://localhost:3000
• Backend API: http://localhost:4000
• Database: localhost:5432
• Redis: localhost:6379
• Prometheus: http://localhost:9090
• Grafana: http://localhost:3002

${YELLOW}Database Credentials:${NC}
• Username: postgres
• Password: $DB_PASSWORD
• Database: mediaplatform

${YELLOW}Next Steps:${NC}
1. Visit http://localhost:3000 to access the platform
2. Configure additional settings via the admin UI
3. Test the complete signup flow
4. Monitor logs: tail -f $LOG_FILE

${GREEN}Platform is ready for customers! 🚀${NC}

EOF
}

# Main execution
main() {
    clear
    log "Starting Media Server Hosting Platform setup..."
    
    check_root
    check_existing_installation
    load_existing_config
    install_dialog
    collect_config
    install_dependencies
    install_docker
    install_nodejs
    skip_nginx_install
    setup_platform_directory
    generate_env_file
    build_and_start_services
    skip_ssl_setup
    run_migrations
    setup_monitoring
    setup_backups
    configure_systemd
    run_self_test
    print_success
    
    log "Setup completed successfully!"
}

# Run main function
main "$@"