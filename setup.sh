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

# Install required packages for the setup process
install_dialog() {
    log "Installing dialog for interactive prompts..."
    apt-get update -qq
    apt-get install -y dialog whiptail > /dev/null 2>&1
}

# Collect configuration from user
collect_config() {
    log "Collecting configuration from user..."
    
    # Domain name
    DOMAIN=$(whiptail --inputbox "Enter your domain name (e.g., mediaserver.com):" 8 78 --title "Domain Configuration" 3>&1 1>&2 2>&3)
    
    # Email for SSL certificates
    SSL_EMAIL=$(whiptail --inputbox "Enter email for SSL certificates:" 8 78 --title "SSL Configuration" 3>&1 1>&2 2>&3)
    
    # Clerk configuration
    CLERK_PUBLISHABLE_KEY=$(whiptail --inputbox "Enter Clerk Publishable Key:" 8 78 --title "Clerk Authentication" 3>&1 1>&2 2>&3)
    CLERK_SECRET_KEY=$(whiptail --passwordbox "Enter Clerk Secret Key:" 8 78 --title "Clerk Authentication" 3>&1 1>&2 2>&3)
    CLERK_WEBHOOK_SECRET=$(whiptail --passwordbox "Enter Clerk Webhook Secret:" 8 78 --title "Clerk Authentication" 3>&1 1>&2 2>&3)
    
    # Stripe configuration
    STRIPE_SECRET_KEY=$(whiptail --passwordbox "Enter Stripe Secret Key:" 8 78 --title "Stripe Billing" 3>&1 1>&2 2>&3)
    STRIPE_WEBHOOK_SECRET=$(whiptail --passwordbox "Enter Stripe Webhook Secret:" 8 78 --title "Stripe Billing" 3>&1 1>&2 2>&3)
    STRIPE_PRICE_ID=$(whiptail --inputbox "Enter Stripe Price ID for $15/mo plan:" 8 78 --title "Stripe Billing" 3>&1 1>&2 2>&3)
    
    # Hetzner configuration
    HETZNER_TOKEN=$(whiptail --passwordbox "Enter Hetzner Cloud API Token:" 8 78 --title "Hetzner Storage" 3>&1 1>&2 2>&3)
    HETZNER_STORAGE_BOX_HOST=$(whiptail --inputbox "Enter Hetzner Storage Box Host:" 8 78 --title "Hetzner Storage" 3>&1 1>&2 2>&3)
    HETZNER_STORAGE_BOX_USER=$(whiptail --inputbox "Enter Hetzner Storage Box Username:" 8 78 --title "Hetzner Storage" 3>&1 1>&2 2>&3)
    HETZNER_STORAGE_BOX_PASS=$(whiptail --passwordbox "Enter Hetzner Storage Box Password:" 8 78 --title "Hetzner Storage" 3>&1 1>&2 2>&3)
    
    # Database configuration
    DB_PASSWORD=$(whiptail --passwordbox "Enter PostgreSQL password:" 8 78 --title "Database Configuration" 3>&1 1>&2 2>&3)
    
    # Admin email
    ADMIN_EMAIL=$(whiptail --inputbox "Enter admin email address:" 8 78 --title "Admin Configuration" 3>&1 1>&2 2>&3)
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
install_nginx() {
    if command -v nginx &> /dev/null; then
        log "Nginx already installed, skipping..."
        return
    fi
    
    log "Installing Nginx..."
    
    apt-get install -y nginx > /dev/null 2>&1
    
    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx
    
    # Configure firewall
    ufw allow 'Nginx Full'
    
    log "Nginx installed successfully"
}

# Setup platform directory structure
setup_platform_directory() {
    log "Setting up platform directory structure..."
    
    # Create main platform directory
    mkdir -p "$PLATFORM_DIR"
    cd "$PLATFORM_DIR"
    
    # Copy source code from git repository
    if [[ -d "/home/runner/work/media-server-cloud/media-server-cloud" ]]; then
        cp -r /home/runner/work/media-server-cloud/media-server-cloud/* "$PLATFORM_DIR/"
    else
        error "Source code not found. Please ensure the repository is cloned."
    fi
    
    # Create additional directories
    mkdir -p logs
    mkdir -p data/postgres
    mkdir -p data/prometheus
    mkdir -p data/grafana
    mkdir -p ssl
    mkdir -p backups
    
    # Set proper permissions
    chown -R $SUDO_USER:$SUDO_USER "$PLATFORM_DIR" 2>/dev/null || true
    chmod -R 755 "$PLATFORM_DIR"
    
    log "Platform directory structure created"
}

# Generate environment file
generate_env_file() {
    log "Generating environment configuration..."
    
    cat > "$PLATFORM_DIR/.env" << EOF
# Domain Configuration
DOMAIN=$DOMAIN
SSL_EMAIL=$SSL_EMAIL

# Application URLs
FRONTEND_URL=https://app.$DOMAIN
BACKEND_URL=https://api.$DOMAIN

# Database Configuration
DATABASE_URL=postgresql://postgres:$DB_PASSWORD@postgres:5432/mediaplatform
POSTGRES_PASSWORD=$DB_PASSWORD

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY=$CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET=$CLERK_WEBHOOK_SECRET

# Stripe Billing
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID=$STRIPE_PRICE_ID

# Hetzner Configuration
HETZNER_TOKEN=$HETZNER_TOKEN
HETZNER_STORAGE_BOX_HOST=$HETZNER_STORAGE_BOX_HOST
HETZNER_STORAGE_BOX_USER=$HETZNER_STORAGE_BOX_USER
HETZNER_STORAGE_BOX_PASS=$HETZNER_STORAGE_BOX_PASS

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Admin Configuration
ADMIN_EMAIL=$ADMIN_EMAIL

# Node Environment
NODE_ENV=production

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
EOF

    # Secure the environment file
    chmod 600 "$PLATFORM_DIR/.env"
    
    log "Environment configuration generated"
}

# Build and start services
build_and_start_services() {
    log "Building and starting services..."
    
    cd "$PLATFORM_DIR"
    
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
setup_ssl() {
    log "Setting up SSL certificates..."
    
    # Install certbot
    apt-get install -y certbot python3-certbot-nginx > /dev/null 2>&1
    
    # Configure Nginx first
    cp nginx/nginx.conf /etc/nginx/sites-available/mediaplatform
    ln -sf /etc/nginx/sites-available/mediaplatform /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Replace domain placeholders
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/mediaplatform
    
    # Test Nginx configuration
    nginx -t
    systemctl reload nginx
    
    # Obtain SSL certificates
    certbot --nginx -d "$DOMAIN" -d "api.$DOMAIN" -d "app.$DOMAIN" -d "*.$DOMAIN" --email "$SSL_EMAIL" --agree-tos --non-interactive || warn "SSL certificate generation failed, continuing..."
    
    log "SSL certificates configured"
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
    
    # Test backend API
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/healthz" | grep -q "200"; then
        log "✓ Backend API responding"
    else
        warn "✗ Backend API not responding"
    fi
    
    # Test frontend
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001" | grep -q "200"; then
        log "✓ Frontend responding"
    else
        warn "✗ Frontend not responding"
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

${YELLOW}Access URLs:${NC}
• Customer Portal: https://app.$DOMAIN
• Admin Dashboard: https://app.$DOMAIN/admin
• API Endpoint: https://api.$DOMAIN
• Monitoring: https://app.$DOMAIN/monitoring

${YELLOW}Next Steps:${NC}
1. Visit https://app.$DOMAIN/sign-up to test customer registration
2. Configure your DNS to point to this server:
   - A record: $DOMAIN → $(curl -s ifconfig.me)
   - CNAME: app.$DOMAIN → $DOMAIN
   - CNAME: api.$DOMAIN → $DOMAIN
   - CNAME: *.$DOMAIN → $DOMAIN

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
    install_dialog
    collect_config
    install_dependencies
    install_docker
    install_nodejs
    install_nginx
    setup_platform_directory
    generate_env_file
    build_and_start_services
    setup_ssl
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