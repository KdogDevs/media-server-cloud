# Media Server Hosting Platform

A complete SaaS solution for hosting personal media servers (Jellyfin, Plex, Emby) in the cloud with automatic setup, billing integration, and customer management.

## 🚀 Quick Start

### Prerequisites

- Ubuntu 22.04 LTS server
- Clerk account for authentication
- *(All other configuration is automated)*

### One-Command Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KdogDevs/media-server-cloud.git
   cd media-server-cloud
   ```

2. **Run the automated setup script:**
   ```bash
   sudo bash setup.sh
   ```
   *(Must be run from the repository root directory)*

3. **Enter only your Clerk credentials when prompted:**
   - Clerk Publishable Key
   - Clerk Secret Key
   
   *(All other configuration is automated - database password is auto-generated)*

4. **Access your platform:**
   - Customer Portal: `http://localhost:3000`
   - Admin Dashboard: `http://localhost:3000/admin`
   - API Endpoint: `http://localhost:4000`
   - Database: `localhost:5432` (credentials shown after setup)

## 🎯 Features

### Core Platform
- **Multi-tenant Architecture**: Isolated containers per customer
- **Auto-scaling Infrastructure**: Docker-based container management
- **SSL Automation**: Automatic HTTPS with Let's Encrypt
- **Custom Subdomains**: Each customer gets `customer.yourdomain.com`

### Media Server Support
- **Jellyfin**: Open-source media server with web interface
- **Plex**: Popular media server with premium features  
- **Emby**: Feature-rich media server solution

### Customer Management
- **7-day Free Trial**: Automatic trial period for new customers
- **Subscription Billing**: $15/month via Stripe integration
- **2TB Storage**: Included with each subscription
- **Real-time Monitoring**: Container health and resource usage

### Admin Features
- **User Management**: View, suspend, and manage customers
- **Resource Monitoring**: System health and usage analytics
- **Billing Overview**: Revenue tracking and subscription management
- **Automated Backups**: Daily data backups with retention

## 📋 System Requirements

### Minimum Server Specs
- **CPU**: 4 cores (Intel i7-7700 or equivalent)
- **RAM**: 32 GB
- **Storage**: 1 TB SSD
- **Network**: 1 Gbps connection
- **OS**: Ubuntu 22.04 LTS

### Recommended for Production
- **CPU**: 8+ cores
- **RAM**: 64+ GB  
- **Storage**: 2+ TB NVMe SSD
- **Network**: Dedicated server with unmetered bandwidth

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Nginx Proxy   │    │  Customer Apps  │
│    (Cloudflare) │────│  SSL Termination│────│   (Subdomains)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │  Main Platform  │
                       │  (app.domain)   │
                       └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │    │   (Node.js)     │    │ (PostgreSQL)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Monitoring    │
                       │ (Prometheus +   │
                       │    Grafana)     │
                       └─────────────────┘
```

## 📊 Technology Stack

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4
- **Database**: PostgreSQL 15 with Prisma ORM
- **Authentication**: Clerk
- **Payments**: Stripe
- **Containers**: Docker & Docker Compose
- **Storage**: Hetzner Storage Box via SSH/SFTP

### Frontend  
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Authentication**: Clerk React components
- **State Management**: Zustand
- **API Client**: Axios with React Query

### Infrastructure
- **Reverse Proxy**: Nginx with SSL termination
- **SSL Certificates**: Let's Encrypt via Certbot
- **Monitoring**: Prometheus + Grafana + Node Exporter
- **Process Management**: PM2 and systemd
- **Backups**: Automated daily backups with retention

## 🔧 Configuration

### Environment Variables
```bash
# Domain Configuration
DOMAIN=yourdomain.com
SSL_EMAIL=admin@yourdomain.com

# Authentication (Clerk)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Billing (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Storage (Hetzner)
HETZNER_TOKEN=...
HETZNER_STORAGE_BOX_HOST=...
HETZNER_STORAGE_BOX_USER=...
HETZNER_STORAGE_BOX_PASS=...

# Database
DATABASE_URL=postgresql://...
POSTGRES_PASSWORD=...
```

### Customer Container Limits
- **CPU**: 0.25 cores per container
- **Memory**: 800 MB per container  
- **Storage**: 2 TB per customer
- **Network**: Shared bandwidth with QoS

## 📚 Documentation

- [Deployment Guide](docs/DEPLOYMENT.md) - Detailed setup instructions
- [Clerk Setup](docs/CLERK-SETUP.md) - Authentication configuration
- [API Documentation](docs/API.md) - Complete API reference
- [Database Schema](docs/ERD.png) - Entity relationship diagram

## 🛠️ Development

### Local Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/KdogDevs/media-server-cloud.git
   cd media-server-cloud
   
   # Backend
   cd backend && npm install
   
   # Frontend  
   cd ../frontend && npm install
   ```

2. **Setup environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services:**
   ```bash
   # Database
   docker-compose up -d postgres redis
   
   # Backend
   cd backend && npm run dev
   
   # Frontend
   cd frontend && npm run dev
   ```

### Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test

# E2E tests
npx playwright test
```

## 🚨 Security

- **OWASP Top 10 Compliance**: Input validation, authentication, authorization
- **Rate Limiting**: API and authentication endpoints protected
- **SSL/TLS**: Enforced HTTPS with HSTS headers
- **Container Isolation**: Customer containers run in isolated environments
- **Data Encryption**: Database encryption at rest and in transit
- **Regular Backups**: Automated daily backups with 30-day retention

## 📈 Monitoring & Alerts

### Metrics Collected
- **System Metrics**: CPU, memory, disk, network usage
- **Application Metrics**: API response times, error rates
- **Business Metrics**: User signups, subscription revenue
- **Container Metrics**: Per-customer resource usage

### Alerting
- **Email Alerts**: Critical system failures
- **Discord Webhooks**: Real-time notifications
- **Health Checks**: Automatic service recovery

## 💰 Pricing Model

- **Free Trial**: 7 days with full access
- **Subscription**: $15/month per customer
- **Includes**: 2TB storage, SSL certificate, subdomain, 24/7 monitoring
- **Payment Processing**: Stripe with automatic billing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs](docs/) directory
- **Issues**: Open a GitHub issue for bugs or feature requests
- **Email**: support@yourdomain.com
- **Discord**: [Join our community](https://discord.gg/your-invite)

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org/) - Open source media server
- [Clerk](https://clerk.dev/) - Authentication and user management
- [Stripe](https://stripe.com/) - Payment processing
- [Hetzner](https://www.hetzner.com/) - Cloud infrastructure

---

**Built with ❤️ for the self-hosted community**