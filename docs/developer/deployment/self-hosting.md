---
title: "Self-Hosting Guide"
description: "Run your own instance of the platform on your own infrastructure."
category: tutorial
tags: ['deployment', 'developer', 'guide', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Self-Hosting Guide

Run your own instance of the platform on your own infrastructure.

---

## Overview

Self-hosting gives you complete control over your deployment, data, and configuration. This guide covers various hosting options from simple VPS to Kubernetes.

---

## Deployment Options

| Option | Complexity | Use Case |
|--------|------------|----------|
| [Docker Compose](#docker-compose) | Low | Small deployments, development |
| [Systemd Service](#systemd-service) | Low | Traditional VPS hosting |
| [Nginx Reverse Proxy](#nginx-reverse-proxy) | Medium | Production with SSL |
| [Kubernetes](#kubernetes) | High | Large-scale deployments |

---

## Prerequisites

### Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 512 MB | 2 GB |
| Storage | 1 GB | 10 GB |
| OS | Linux (Ubuntu 22.04+) | Ubuntu 24.04 LTS |

### Software Requirements

- Node.js 20+
- npm 9+
- Docker (optional)
- Nginx (for reverse proxy)

---

## Docker Compose

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: nostr-bbs
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - ORIGIN=https://bbs.example.com
      - PUBLIC_RELAY_URL=wss://relay.example.com
      - PUBLIC_APP_NAME=Nostr BBS
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'

  # Optional: Local relay
  relay:
    image: scsibug/nostr-rs-relay:latest
    container_name: nostr-relay
    restart: unless-stopped
    ports:
      - '7000:7000'
    volumes:
      - relay-data:/usr/src/app/db
      - ./relay-config.toml:/usr/src/app/config.toml:ro
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'

volumes:
  relay-data:
```

### Deploy with Docker Compose

```bash
# Clone repository
git clone https://github.com/your-org/nostr-bbs.git
cd nostr-bbs

# Create environment file
cat > .env << EOF
NODE_ENV=production
ORIGIN=https://bbs.example.com
PUBLIC_RELAY_URL=wss://relay.example.com
PUBLIC_APP_NAME=Nostr BBS
EOF

# Build and start
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

---

## Systemd Service

### Build Application

```bash
# Install dependencies
npm ci

# Build
npm run build

# Test locally
node build
```

### Create Service File

```ini
# /etc/systemd/system/nostr-bbs.service
[Unit]
Description=Nostr BBS Application
After=network.target

[Service]
Type=simple
User=nostr-bbs
Group=nostr-bbs
WorkingDirectory=/opt/nostr-bbs
ExecStart=/usr/bin/node build
Restart=always
RestartSec=10

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ORIGIN=https://bbs.example.com
Environment=PUBLIC_RELAY_URL=wss://relay.example.com

# Security
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/nostr-bbs

[Install]
WantedBy=multi-user.target
```

### Enable and Start

```bash
# Create user
sudo useradd -r -s /bin/false nostr-bbs

# Set permissions
sudo chown -R nostr-bbs:nostr-bbs /opt/nostr-bbs

# Enable service
sudo systemctl daemon-reload
sudo systemctl enable nostr-bbs
sudo systemctl start nostr-bbs

# Check status
sudo systemctl status nostr-bbs

# View logs
sudo journalctl -u nostr-bbs -f
```

---

## Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

### Configure Site

```nginx
# /etc/nginx/sites-available/nostr-bbs
server {
    listen 80;
    server_name bbs.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bbs.example.com;

    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/bbs.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bbs.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; img-src 'self' data: https:;" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable, max-age=31536000";
    }

    # Service worker (no caching)
    location = /service-worker.js {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # WebSocket support
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }
}
```

### Enable Site and SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/nostr-bbs /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d bbs.example.com

# Reload Nginx
sudo systemctl reload nginx
```

---

## Kubernetes

### Deployment Manifest

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nostr-bbs
  labels:
    app: nostr-bbs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nostr-bbs
  template:
    metadata:
      labels:
        app: nostr-bbs
    spec:
      containers:
        - name: app
          image: your-registry/nostr-bbs:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3000'
            - name: ORIGIN
              valueFrom:
                configMapKeyRef:
                  name: nostr-bbs-config
                  key: origin
            - name: PUBLIC_RELAY_URL
              valueFrom:
                secretKeyRef:
                  name: nostr-bbs-secrets
                  key: relay-url
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: nostr-bbs
spec:
  selector:
    app: nostr-bbs
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nostr-bbs
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - bbs.example.com
      secretName: nostr-bbs-tls
  rules:
    - host: bbs.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nostr-bbs
                port:
                  number: 80
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace nostr-bbs

# Create config and secrets
kubectl create configmap nostr-bbs-config \
  --from-literal=origin=https://bbs.example.com \
  -n nostr-bbs

kubectl create secret generic nostr-bbs-secrets \
  --from-literal=relay-url=wss://relay.example.com \
  -n nostr-bbs

# Apply manifests
kubectl apply -f k8s/ -n nostr-bbs

# Check status
kubectl get pods -n nostr-bbs
kubectl get ingress -n nostr-bbs
```

---

## Running Your Own Relay

### Using nostr-rs-relay

```toml
# relay-config.toml
[info]
relay_url = "wss://relay.example.com"
name = "My Relay"
description = "Private relay for Nostr BBS"
pubkey = "your-hex-pubkey"
contact = "admin@example.com"

[database]
data_directory = "/data"

[network]
port = 7000
address = "0.0.0.0"

[limits]
messages_per_sec = 5
subscriptions_per_min = 10
max_event_bytes = 65536
max_ws_message_bytes = 131072

[authorization]
# Require NIP-42 authentication
nip42_auth = true

# Whitelist specific pubkeys (optional)
# pubkey_whitelist = ["pubkey1", "pubkey2"]
```

### Deploy Relay with Docker

```yaml
# Add to docker-compose.yml
relay:
  image: scsibug/nostr-rs-relay:latest
  restart: unless-stopped
  ports:
    - '7000:7000'
  volumes:
    - ./relay-config.toml:/usr/src/app/config.toml:ro
    - relay-data:/data
  environment:
    - RUST_LOG=info
```

---

## Backup and Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups/nostr-bbs

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /opt/nostr-bbs

# Docker volumes
docker run --rm \
  -v nostr-bbs_relay-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar -czf /backup/relay_$DATE.tar.gz /data

# Retain last 7 days
find $BACKUP_DIR -mtime +7 -delete
```

### Restore

```bash
#!/bin/bash
# restore.sh

# Stop services
sudo systemctl stop nostr-bbs
docker compose down

# Restore application
tar -xzf /backups/nostr-bbs/app_latest.tar.gz -C /

# Restore Docker volume
docker run --rm \
  -v nostr-bbs_relay-data:/data \
  -v /backups/nostr-bbs:/backup \
  alpine tar -xzf /backup/relay_latest.tar.gz -C /

# Start services
sudo systemctl start nostr-bbs
docker compose up -d
```

---

## Monitoring

### Health Check Script

```bash
#!/bin/bash
# healthcheck.sh

HEALTH_URL="http://localhost:3000/health"
ALERT_EMAIL="admin@example.com"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$response" != "200" ]; then
    echo "Health check failed at $(date)" | mail -s "Nostr BBS Alert" $ALERT_EMAIL
    systemctl restart nostr-bbs
fi
```

### Prometheus Metrics

Add to application:

```typescript
// src/lib/server/metrics.ts
import { Counter, Histogram, Registry } from 'prom-client';

export const registry = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [registry]
});

export const wsConnections = new Counter({
  name: 'websocket_connections_total',
  help: 'Total WebSocket connections',
  registers: [registry]
});
```

---

## Security Hardening

### System Security

```bash
# Enable firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Application Security

1. **Run as non-root user**
2. **Use read-only filesystem where possible**
3. **Limit network access**
4. **Regular security updates**
5. **Enable audit logging**

---

## Troubleshooting

### Check Logs

```bash
# Systemd
sudo journalctl -u nostr-bbs -f

# Docker
docker compose logs -f app

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 502 Bad Gateway | App not running | Check app status, restart |
| SSL errors | Certificate expired | Renew with certbot |
| High memory | Memory leak | Restart, check for leaks |
| Slow responses | Cold start | Enable keep-alive |

---

## Related Documentation

- [Deployment Overview](index.md) — All deployment options
- [GitHub Pages](github-pages.md) — Static hosting
- [Cloud Run](cloud-run.md) — Google Cloud deployment
- [Configuration Reference](../reference/configuration.md) — All config options

---

[← Back to Deployment](index.md)
