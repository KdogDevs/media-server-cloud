# Media Platform - Simplified Installation Guide

This installation has been updated to work on fresh Ubuntu systems without domain dependencies.

## Quick Start

### One-Command Installation (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/KdogDevs/media-server-cloud/main/web-install.sh | sudo bash
```

This single command will:
- Download the latest source code automatically
- Install all required dependencies (Docker, Node.js, etc.)
- Auto-generate secure database password
- Set up the platform on localhost ports
- Only prompt for Clerk authentication keys
- Start all services automatically

**For updates:** Simply run the same command again. It will detect existing installations and update them.

### Alternative: Manual Installation

If you prefer to clone the repository manually:

```bash
git clone https://github.com/KdogDevs/media-server-cloud.git
cd media-server-cloud
sudo ./setup.sh
```

## Access Points

After installation:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Database**: localhost:5432
- **Redis**: localhost:6379
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002

## Configuration

### Required During Setup
- Clerk Publishable Key
- Clerk Secret Key

*(Database password is auto-generated securely)*

### Optional (Configure via Admin UI)
- Hetzner Cloud API Token
- Hetzner Storage Box credentials
- Platform settings
- Admin email

## Admin Configuration

1. Access the admin panel at http://localhost:3000/admin
2. Configure additional settings:
   - Hetzner storage credentials
   - Platform settings
   - System configuration

## Changes Made

### Removed Dependencies
- Domain name requirement
- SSL certificate setup
- Nginx reverse proxy
- DNS configuration

### New Features
- Direct port access (no reverse proxy needed)
- Database-stored configuration
- Admin web UI for settings
- **Fully automated setup** (only Clerk config required)
- **Auto-generated database passwords**
- **Smart install/update detection**
- **Idempotent script** (can be run multiple times safely)

### Port Configuration
- Frontend: 3000 (instead of 80/443 via nginx)
- Backend: 4000 (instead of 3000)
- Database: 5432 (unchanged)
- Redis: 6379 (unchanged)
- Monitoring services: 9090, 3002 (unchanged)

## Testing

The platform includes a test script to verify configuration:

```bash
# Run from project root
./test-setup.sh
```

### Testing Dialog Functionality

If you experience issues with installation prompts, you can test the dialog functionality:

```bash
# Test the dialog fix
./test-dialog-fix.sh
```

This will verify that the installation prompts work correctly in your terminal environment.

### Automated Installation

The installation script now supports automated/non-interactive installation through environment variables:

```bash
# For automated installations, set these variables:
export CI=true  # Enables non-interactive mode
export AUTOMATED_UPDATE_CLERK_CONFIGURATION=no  # Skip Clerk config update
export AUTOMATED_CLERK_AUTHENTICATION=your_key  # Set Clerk keys if needed

# Then run the installation
./setup.sh
```

**Available Environment Variables:**
- `CI=true` - Enables non-interactive mode
- `AUTOMATED_INSTALL=true` - Alternative to CI flag
- `AUTOMATED_UPDATE_CLERK_CONFIGURATION=yes|no` - Controls Clerk config updates
- `AUTOMATED_CLERK_AUTHENTICATION=value` - Sets Clerk keys automatically

The script automatically detects non-interactive environments and uses sensible defaults.

## Development

For development, you can run individual services:

```bash
# Backend
cd backend && npm run dev

# Frontend  
cd frontend && npm run dev
```

## Troubleshooting

### Installation Dialog Issues

If you can't interact with installation prompts:
- The system automatically detects terminal compatibility
- Falls back to text-based prompts when whiptail dialogs don't work
- **NEW**: Automatically handles non-interactive environments (CI/CD, automated installs)
- **NEW**: Supports environment variable overrides for automation
- Works in SSH sessions, web terminals, and other environments
- Run `./test-dialog-fix.sh` to verify functionality

**For Non-Interactive Installations:**
```bash
# Set environment variables to automate responses
export CI=true
export AUTOMATED_UPDATE_CLERK_CONFIGURATION=no
./setup.sh
```

**Common Issues Fixed:**
- "Error reading input" in automated environments ✓
- Hanging prompts in CI/CD pipelines ✓
- Failed installations in Docker containers ✓

### Service Status
```bash
docker compose ps
```

### Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Restart Services
```bash
docker compose restart
```

## Production Notes

- Change default passwords in production
- Configure firewall rules as needed
- Set up regular backups
- Monitor resource usage
- Configure Hetzner credentials via admin UI