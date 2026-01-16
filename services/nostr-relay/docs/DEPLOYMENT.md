# Deployment Guide

Deploy the Fairfield Nostr Relay to production environments.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- PostgreSQL 14+ database (Cloud SQL recommended for production)

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Server
PORT=8080
HOST=0.0.0.0

# Database (PostgreSQL connection string)
DATABASE_URL=postgresql://user:password@localhost:5432/nostr_relay

# For Cloud SQL via Unix socket:
# DATABASE_URL=postgresql://user:password@localhost/nostr_relay?host=/cloudsql/PROJECT:REGION:INSTANCE

# Access Control
WHITELIST_PUBKEYS=pubkey1,pubkey2,pubkey3
ADMIN_PUBKEYS=admin-pubkey

# Rate Limiting (optional)
RATE_LIMIT_EVENTS_PER_SEC=10
RATE_LIMIT_MAX_CONNECTIONS=10
```

## Deployment Options

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/server.js"]
```

Build and run:

```bash
docker build -t nostr-relay .
docker run -d \
  --name nostr-relay \
  -p 8080:8080 \
  -e DATABASE_URL="postgresql://user:password@host:5432/nostr_relay" \
  -e WHITELIST_PUBKEYS="pubkey1,pubkey2" \
  -e ADMIN_PUBKEYS="admin-pubkey" \
  nostr-relay
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nostr_relay
      POSTGRES_USER: nostr
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nostr -d nostr_relay"]
      interval: 10s
      timeout: 5s
      retries: 5

  nostr-relay:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - DATABASE_URL=postgresql://nostr:${POSTGRES_PASSWORD}@postgres:5432/nostr_relay
      - WHITELIST_PUBKEYS=${WHITELIST_PUBKEYS}
      - ADMIN_PUBKEYS=${ADMIN_PUBKEYS}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres-data:
```

### Google Cloud Run with Cloud SQL

```mermaid
graph LR
    subgraph "Cloud Run"
        CR[Container Instance]
    end

    subgraph "Cloud SQL"
        PG[(PostgreSQL)]
    end

    CLIENT[Clients] -->|HTTPS| CR
    CR -->|Unix Socket| PG
```

**Prerequisites:**

1. Create Cloud SQL PostgreSQL instance:
```bash
gcloud sql instances create nostr-relay-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --storage-size=10GB

# Create database
gcloud sql databases create nostr_relay --instance=nostr-relay-db

# Create user
gcloud sql users create nostr --instance=nostr-relay-db --password=YOUR_PASSWORD
```

**Deployment Steps:**

1. Build container image:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/nostr-relay
```

2. Deploy with Cloud SQL connection:
```bash
gcloud run deploy nostr-relay \
  --image gcr.io/PROJECT_ID/nostr-relay \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:europe-west1:nostr-relay-db \
  --set-env-vars "DATABASE_URL=postgresql://nostr:YOUR_PASSWORD@localhost/nostr_relay?host=/cloudsql/PROJECT_ID:europe-west1:nostr-relay-db"
```

**Alternative: Use Secret Manager for credentials:**
```bash
# Store database URL as secret
echo -n "postgresql://nostr:PASSWORD@localhost/nostr_relay?host=/cloudsql/PROJECT_ID:europe-west1:nostr-relay-db" | \
  gcloud secrets create nostr-relay-db-url --data-file=-

# Deploy with secret
gcloud run deploy nostr-relay \
  --image gcr.io/PROJECT_ID/nostr-relay \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --add-cloudsql-instances PROJECT_ID:europe-west1:nostr-relay-db \
  --set-secrets "DATABASE_URL=nostr-relay-db-url:latest"
```

### Systemd Service

Create `/etc/systemd/system/nostr-relay.service`:

```ini
[Unit]
Description=Fairfield Nostr Relay
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=nostr
Group=nostr
WorkingDirectory=/opt/nostr-relay
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=10

Environment=NODE_ENV=production
Environment=PORT=8080
EnvironmentFile=/etc/nostr-relay/config

[Install]
WantedBy=multi-user.target
```

Create config file `/etc/nostr-relay/config`:
```bash
DATABASE_URL=postgresql://nostr:password@localhost:5432/nostr_relay
WHITELIST_PUBKEYS=pubkey1,pubkey2
ADMIN_PUBKEYS=admin-pubkey
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nostr-relay
sudo systemctl start nostr-relay
```

## Reverse Proxy

### Nginx Configuration

```nginx
upstream nostr_relay {
    server 127.0.0.1:8080;
}

server {
    listen 443 ssl http2;
    server_name relay.example.com;

    ssl_certificate /etc/letsencrypt/live/relay.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/relay.example.com/privkey.pem;

    location / {
        proxy_pass http://nostr_relay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

### Caddy Configuration

```
relay.example.com {
    reverse_proxy localhost:8080
}
```

## Production Checklist

```mermaid
graph TD
    A[Pre-Deployment] --> B[Configure Environment]
    B --> C[Set Whitelist]
    C --> D[Configure Rate Limits]
    D --> E[Enable TLS]
    E --> F[Setup Monitoring]
    F --> G[Configure Backups]
    G --> H[Deploy]

    subgraph Monitoring
        F --> M1[Health Endpoint]
        F --> M2[Logs]
        F --> M3[Metrics]
    end

    subgraph Backups
        G --> B1[PostgreSQL Backup]
        G --> B2[Cloud SQL Snapshots]
    end
```

### Security

- [ ] Configure whitelist pubkeys
- [ ] Set admin pubkeys
- [ ] Enable TLS via reverse proxy
- [ ] Configure firewall rules
- [ ] Set appropriate rate limits

### Reliability

- [ ] Configure health checks
- [ ] Set up log aggregation
- [ ] Configure automatic restarts
- [ ] Plan database backups

### Performance

- [ ] Tune PostgreSQL connection pool (default: 20 connections)
- [ ] Configure pg_bouncer for high connection counts
- [ ] Monitor memory usage
- [ ] Enable pg_stat_statements for query analysis

## Backup Strategy

### PostgreSQL backup:

```bash
# Logical backup (pg_dump)
pg_dump -h localhost -U nostr nostr_relay > /backup/nostr-$(date +%Y%m%d).sql

# Compressed backup
pg_dump -h localhost -U nostr -Fc nostr_relay > /backup/nostr-$(date +%Y%m%d).dump

# Restore from backup
pg_restore -h localhost -U nostr -d nostr_relay /backup/nostr-20240215.dump
```

### Cloud SQL automated backups:

```bash
# Enable automated backups
gcloud sql instances patch nostr-relay-db \
  --backup-start-time=02:00 \
  --enable-bin-log

# Create on-demand backup
gcloud sql backups create --instance=nostr-relay-db

# List backups
gcloud sql backups list --instance=nostr-relay-db

# Restore from backup
gcloud sql backups restore BACKUP_ID --restore-instance=nostr-relay-db
```

## Monitoring

### Health Check

```bash
curl http://localhost:8080/health | jq .
```

### Prometheus Metrics (Future)

Metrics endpoint planned for future versions:
- `nostr_events_total` - Total events stored
- `nostr_connections_active` - Active WebSocket connections
- `nostr_events_per_second` - Event throughput

### Log Analysis

```bash
# View recent logs
journalctl -u nostr-relay -f

# Filter errors
journalctl -u nostr-relay --priority=err
```

## Scaling Considerations

```mermaid
graph TB
    subgraph "Single Instance"
        R1[Relay]
        PG1[(PostgreSQL)]
        R1 --> PG1
    end

    subgraph "Horizontal Scaling"
        LB[Load Balancer]
        R2[Relay 1]
        R3[Relay 2]
        R4[Relay 3]
        POOL[PgBouncer<br/>Connection Pool]
        PRIMARY[(PostgreSQL<br/>Primary)]
        READ1[(Read Replica 1)]
        READ2[(Read Replica 2)]

        LB --> R2
        LB --> R3
        LB --> R4
        R2 --> POOL
        R3 --> POOL
        R4 --> POOL
        POOL -->|Writes| PRIMARY
        POOL -->|Reads| READ1
        POOL -->|Reads| READ2
        PRIMARY -->|Replication| READ1
        PRIMARY -->|Replication| READ2
    end

    style PG1 fill:#99f
    style PRIMARY fill:#99f
    style READ1 fill:#9cf
    style READ2 fill:#9cf
```

For high-volume deployments, consider:
- Read replicas for query load distribution
- PgBouncer for connection pooling (reduces connection overhead)
- Cloud SQL HA configuration for automatic failover
- CDN for static content
- Separate read/write connection strings for optimal routing
