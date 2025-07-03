# Media Platform - Simplified Installation Guide

This installation has been updated to work on fresh Ubuntu systems without domain dependencies.

## Quick Start

**Important:** Run the setup script from the repository root directory.

```bash
git clone https://github.com/KdogDevs/media-server-cloud.git
cd media-server-cloud
sudo ./setup.sh
```

The script will:
- Install all required dependencies (Docker, Node.js, etc.)
- Auto-generate secure database password
- Set up the platform on localhost ports
- Only prompt for Clerk authentication keys
- Start all services automatically

**For updates:** Simply run `sudo ./setup.sh` again from the same directory.

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

## Development

For development, you can run individual services:

```bash
# Backend
cd backend && npm run dev

# Frontend  
cd frontend && npm run dev
```

## Troubleshooting

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