---
title: "Deployment Guide"
description: "Deploy the platform to production environments."
category: tutorial
tags: ['deployment', 'developer', 'guide', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Deployment Guide

Deploy the platform to production environments.

---

## Deployment Options

The platform can be deployed in several configurations:

| Option | Best For | Complexity |
|--------|----------|------------|
| **GitHub Pages** | Static hosting, simplest setup | Low |
| **Cloud Run** | Scalable, serverless API | Medium |
| **Self-Hosted** | Full control, custom infrastructure | High |

---

## Architecture Overview

```mermaid
graph TB
    subgraph Static["Static Hosting"]
        PWA["PWA (SvelteKit SPA)"]
    end

    subgraph API["API Layer"]
        Relay["Nostr Relay"]
        Embed["Embedding API"]
        Image["Image API"]
    end

    subgraph Data["Data Layer"]
        DB["PostgreSQL + pgvector"]
        Storage["Object Storage"]
    end

    PWA -->|WSS| Relay
    PWA -->|HTTPS| Embed
    PWA -->|HTTPS| Image
    Relay --> DB
    Embed --> DB
    Image --> Storage
```

---

## Prerequisites

### Required

- Node.js 20+ and npm 9+
- Git
- A Nostr relay (self-hosted or managed)
- PostgreSQL 15+ with pgvector extension

### Optional

- Google Cloud account (for Cloud Run deployment)
- Custom domain with DNS access
- SSL certificate (or use managed SSL)

---

## Quick Start: GitHub Pages

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR-USERNAME/nostr-bbs.git
cd nostr-bbs
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit configuration
nano .env.local
```

Required environment variables:

```bash
# Relay Configuration
PUBLIC_RELAY_URL=wss://your-relay.example.com

# App Configuration
PUBLIC_APP_NAME="Your Community"
PUBLIC_APP_URL=https://your-domain.example.com
```

### 3. Build Static Site

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

### 4. Deploy to GitHub Pages

```bash
# Enable GitHub Pages in repository settings
# Source: GitHub Actions

# Push changes to trigger deployment
git add .
git commit -m "Configure for deployment"
git push origin main
```

The GitHub Actions workflow will automatically build and deploy to GitHub Pages.

---

## Cloud Run Deployment

### 1. Set Up Google Cloud Project

```bash
# Install gcloud CLI
# See: https://cloud.google.com/sdk/docs/install

# Login and set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required services
gcloud services enable \
  run.googleapis.com \
  cloudsql.googleapis.com \
  secretmanager.googleapis.com
```

### 2. Configure Cloud SQL

```bash
# Create PostgreSQL instance
gcloud sql instances create nostr-bbs-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west2

# Create database
gcloud sql databases create nostrbbs \
  --instance=nostr-bbs-db

# Set password
gcloud sql users set-password postgres \
  --instance=nostr-bbs-db \
  --password=YOUR_SECURE_PASSWORD
```

### 3. Deploy Relay Service

```bash
# Build and push container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/relay

# Deploy to Cloud Run
gcloud run deploy relay \
  --image gcr.io/YOUR_PROJECT/relay \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=postgres://..." \
  --add-cloudsql-instances YOUR_PROJECT:europe-west2:nostr-bbs-db
```

### 4. Configure DNS

Point your domain to the Cloud Run service:

```
Type: CNAME
Name: api
Value: YOUR-SERVICE-URL.run.app
```

---

## Self-Hosted Deployment

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100+ GB SSD |
| Bandwidth | 100 Mbps | 1 Gbps |

### 1. Install Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y \
  nginx \
  postgresql-15 \
  postgresql-15-pgvector \
  nodejs \
  npm \
  certbot \
  python3-certbot-nginx
```

### 2. Configure PostgreSQL

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE USER nostrbbs WITH PASSWORD 'your_password';
CREATE DATABASE nostrbbs OWNER nostrbbs;
\c nostrbbs
CREATE EXTENSION vector;
EOF
```

### 3. Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/nostr-bbs.git
cd nostr-bbs

# Install dependencies
npm install

# Build
npm run build

# Start with PM2
npm install -g pm2
pm2 start npm --name "nostr-bbs" -- run start
pm2 save
```

### 4. Configure Nginx

```nginx
# /etc/nginx/sites-available/nostr-bbs
server {
    listen 80;
    server_name your-domain.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5. Enable SSL

```bash
sudo certbot --nginx -d your-domain.example.com
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | `cumbriadreamlab` |
| `VITE_RELAY_URL` | WebSocket relay URL | `wss://nostr-relay-<PROJECT_NUMBER>.us-central1.run.app` |
| `VITE_ADMIN_PUBKEY` | Admin hex pubkey | 64-character hex string |
| `DATABASE_URL` | PostgreSQL connection | `postgres://user:pass@host/db` |

### Cloud Run Services

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_EMBEDDING_API_URL` | Semantic search API | `https://embedding-api-<PROJECT_NUMBER>.us-central1.run.app` |
| `VITE_IMAGE_API_URL` | Image upload API | `https://image-api-<PROJECT_NUMBER>.us-central1.run.app` |

### Discovering Deployed Services

```bash
# List all Cloud Run services with URLs
gcloud run services list --format="table(SERVICE,REGION,URL)"

# Example output for cumbriadreamlab project:
# SERVICE        REGION       URL
# embedding-api  us-central1  https://embedding-api-617806532906.us-central1.run.app
# image-api      us-central1  https://image-api-617806532906.us-central1.run.app
# nostr-relay    us-central1  https://nostr-relay-617806532906.us-central1.run.app
```

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_NAME` | Application name | "Nostr BBS" |
| `LOG_LEVEL` | Logging verbosity | "info" |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | 60000 |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |

---

## Health Checks

### Endpoint

```
GET /health
```

### Expected Response

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-09T12:00:00Z",
  "services": {
    "database": "connected",
    "relay": "connected"
  }
}
```

### Monitoring

Configure uptime monitoring to check:
- `/health` endpoint (HTTP 200)
- WebSocket connection to relay
- Database query latency

---

## Scaling Considerations

### Horizontal Scaling

```mermaid
graph TB
    LB["Load Balancer"]

    subgraph Instances
        I1["Instance 1"]
        I2["Instance 2"]
        I3["Instance 3"]
    end

    subgraph Shared
        DB["PostgreSQL (Primary)"]
        Cache["Redis (Optional)"]
    end

    LB --> I1
    LB --> I2
    LB --> I3

    I1 --> DB
    I2 --> DB
    I3 --> DB

    I1 --> Cache
    I2 --> Cache
    I3 --> Cache
```

### Performance Tips

1. **Use connection pooling** — PgBouncer for PostgreSQL
2. **Enable caching** — Redis for session and query cache
3. **CDN for static assets** — Cloudflare or similar
4. **Database read replicas** — For read-heavy workloads

---

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -h localhost -U nostrbbs nostrbbs | gzip > /backups/db_$DATE.sql.gz

# Retain 30 days
find /backups -name "db_*.sql.gz" -mtime +30 -delete
```

### Media Backups

```bash
# Sync to object storage
rclone sync /var/www/nostr-bbs/media s3:your-bucket/media
```

---

## Security Checklist

### Before Go-Live

- [ ] SSL/TLS enabled (HTTPS only)
- [ ] Database password is strong and unique
- [ ] Environment variables not in source control
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled (CSP, HSTS, etc.)
- [ ] Firewall rules configured
- [ ] Logging enabled
- [ ] Backup strategy tested

### Ongoing

- [ ] Regular security updates
- [ ] Log monitoring
- [ ] Backup verification
- [ ] Penetration testing (annual)

---

## Troubleshooting

### Common Issues

<details>
<summary><strong>WebSocket connection fails</strong></summary>

Check:
1. Nginx WebSocket upgrade configuration
2. SSL certificate validity
3. Firewall allows port 443
4. Relay service is running

</details>

<details>
<summary><strong>Database connection errors</strong></summary>

Check:
1. PostgreSQL is running
2. Connection string is correct
3. User has correct permissions
4. pgvector extension is installed

</details>

<details>
<summary><strong>Build fails</strong></summary>

Check:
1. Node.js version (20+)
2. npm version (9+)
3. All dependencies installed
4. Environment variables set

</details>

---

## Related Documentation

- [System Architecture](../architecture/index.md) — Technical architecture
- [Configuration Reference](../reference/configuration.md) — All configuration options
- [Contributing Guide](../contributing/index.md) — Development setup

---

[← Back to Developer Documentation](../index.md)
