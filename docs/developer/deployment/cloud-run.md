---
title: "Google Cloud Run Deployment"
description: "Deploy the platform to Google Cloud Run for serverless container hosting."
category: tutorial
tags: ['deployment', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Google Cloud Run Deployment

Deploy the platform to Google Cloud Run for serverless container hosting.

---

## Overview

Cloud Run provides fully managed serverless containers with automatic scaling, HTTPS, and custom domain support. This guide covers deploying the SvelteKit application with server-side rendering.

---

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed locally
- Project with Node adapter configured

---

## Configuration

### 1. Install Node Adapter

```bash
npm install -D @sveltejs/adapter-node
```

### 2. Configure SvelteKit

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: true,
      envPrefix: ''
    })
  }
};

export default config;
```

### 3. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build
RUN npm prune --production

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "build"]
```

### 4. Add Health Check Endpoint

```typescript
// src/routes/health/+server.ts
import { json } from '@sveltejs/kit';

export function GET() {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}
```

### 5. Create .dockerignore

```
node_modules
.svelte-kit
build
.env*
.git
*.md
tests
```

---

## Deployment

### Initial Setup

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create nostr-bbs \
  --repository-format=docker \
  --location=europe-west1 \
  --description="Nostr BBS images"
```

### Build and Deploy

```bash
# Configure Docker for Artifact Registry
gcloud auth configure-docker europe-west1-docker.pkg.dev

# Build image
docker build -t europe-west1-docker.pkg.dev/YOUR_PROJECT/nostr-bbs/app:latest .

# Push to registry
docker push europe-west1-docker.pkg.dev/YOUR_PROJECT/nostr-bbs/app:latest

# Deploy to Cloud Run
gcloud run deploy nostr-bbs \
  --image europe-west1-docker.pkg.dev/YOUR_PROJECT/nostr-bbs/app:latest \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"
```

---

## CI/CD with Cloud Build

### Create cloudbuild.yaml

```yaml
# cloudbuild.yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'europe-west1-docker.pkg.dev/$PROJECT_ID/nostr-bbs/app:$COMMIT_SHA'
      - '-t'
      - 'europe-west1-docker.pkg.dev/$PROJECT_ID/nostr-bbs/app:latest'
      - '.'

  # Push the container image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '--all-tags'
      - 'europe-west1-docker.pkg.dev/$PROJECT_ID/nostr-bbs/app'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'nostr-bbs'
      - '--image'
      - 'europe-west1-docker.pkg.dev/$PROJECT_ID/nostr-bbs/app:$COMMIT_SHA'
      - '--region'
      - 'europe-west1'
      - '--platform'
      - 'managed'

images:
  - 'europe-west1-docker.pkg.dev/$PROJECT_ID/nostr-bbs/app:$COMMIT_SHA'
  - 'europe-west1-docker.pkg.dev/$PROJECT_ID/nostr-bbs/app:latest'

options:
  logging: CLOUD_LOGGING_ONLY

substitutions:
  _REGION: europe-west1

timeout: '1200s'
```

### Set Up Cloud Build Trigger

```bash
# Connect repository
gcloud builds triggers create github \
  --repo-name=YOUR_REPO \
  --repo-owner=YOUR_USERNAME \
  --branch-pattern='^main$' \
  --build-config=cloudbuild.yaml \
  --name=deploy-main
```

---

## Environment Variables

### Configure Secrets

```bash
# Create secrets
echo -n "wss://relay.example.com" | \
  gcloud secrets create relay-url --data-file=-

# Grant Cloud Run access
gcloud secrets add-iam-policy-binding relay-url \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Use Secrets in Cloud Run

```bash
gcloud run deploy nostr-bbs \
  --image europe-west1-docker.pkg.dev/YOUR_PROJECT/nostr-bbs/app:latest \
  --set-secrets="PUBLIC_RELAY_URL=relay-url:latest"
```

### Environment Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port (auto-set) | `8080` |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | `cumbriadreamlab` |
| `VITE_RELAY_URL` | Nostr relay (WSS) | `wss://nostr-relay-617806532906.us-central1.run.app` |
| `VITE_EMBEDDING_API_URL` | Embedding API | `https://embedding-api-617806532906.us-central1.run.app` |
| `VITE_IMAGE_API_URL` | Image upload API | `https://image-api-617806532906.us-central1.run.app` |
| `VITE_ADMIN_PUBKEY` | Admin hex pubkey | `64-character-hex-string` |
| `ORIGIN` | App origin for CSRF | `https://app.example.com` |

### List Deployed Services

```bash
# Get all Cloud Run service URLs
gcloud run services list --format="table(SERVICE,REGION,URL)"
```

---

## Custom Domain

### Map Domain to Cloud Run

```bash
# Verify domain ownership first in Google Search Console

# Map domain
gcloud run domain-mappings create \
  --service nostr-bbs \
  --domain app.example.com \
  --region europe-west1
```

### Configure DNS

Add the DNS records shown after creating the mapping:

```
# For apex domain
A     @     <IP from gcloud output>

# For subdomain
CNAME app   ghs.googlehosted.com
```

### Enable Managed SSL

Cloud Run automatically provisions SSL certificates for mapped domains.

---

## Scaling Configuration

### Auto-Scaling Settings

```bash
gcloud run services update nostr-bbs \
  --region europe-west1 \
  --min-instances 1 \
  --max-instances 100 \
  --concurrency 80 \
  --cpu-throttling
```

### Configuration Options

| Setting | Description | Recommended |
|---------|-------------|-------------|
| `min-instances` | Always-on instances | 1 for production |
| `max-instances` | Maximum scale | 10-100 |
| `concurrency` | Requests per instance | 80 |
| `cpu-throttling` | CPU only during requests | Enable for cost |
| `memory` | Instance memory | 512Mi-1Gi |
| `cpu` | CPU allocation | 1-2 |

---

## Monitoring

### View Logs

```bash
# Stream logs
gcloud run services logs read nostr-bbs --region europe-west1 --tail 100

# View in console
gcloud run services logs tail nostr-bbs --region europe-west1
```

### Set Up Alerts

```bash
# Create uptime check
gcloud monitoring uptime-check-configs create nostr-bbs-uptime \
  --display-name="Nostr BBS Uptime" \
  --resource-type=uptime-url \
  --hostname=app.example.com \
  --path=/health \
  --period=60
```

### View Metrics

- **Request count**: Total requests over time
- **Request latency**: Response time percentiles
- **Instance count**: Active instances
- **CPU/Memory**: Resource utilisation

Access at: `console.cloud.google.com/run/detail/europe-west1/nostr-bbs/metrics`

---

## Cost Optimisation

### Free Tier

Cloud Run includes:
- 2 million requests/month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds

### Cost Reduction Tips

1. **Set minimum instances to 0** for development
2. **Enable CPU throttling** for background tasks
3. **Use appropriate memory** (512Mi usually sufficient)
4. **Configure concurrency** to maximise instance utilisation

### Estimate Costs

```bash
# View current usage
gcloud run services describe nostr-bbs \
  --region europe-west1 \
  --format='value(status.traffic[0].percent)'
```

---

## Security

### Service Account

Create dedicated service account:

```bash
# Create account
gcloud iam service-accounts create nostr-bbs-runner \
  --display-name="Nostr BBS Runner"

# Assign minimal permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:nostr-bbs-runner@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Deploy with service account
gcloud run deploy nostr-bbs \
  --service-account nostr-bbs-runner@YOUR_PROJECT.iam.gserviceaccount.com
```

### VPC Connector (Optional)

For private database access:

```bash
# Create connector
gcloud compute networks vpc-access connectors create nostr-connector \
  --region europe-west1 \
  --subnet nostr-subnet

# Attach to service
gcloud run services update nostr-bbs \
  --vpc-connector nostr-connector
```

---

## Troubleshooting

### Container Fails to Start

Check startup logs:

```bash
gcloud run services logs read nostr-bbs \
  --region europe-west1 \
  --limit 50
```

Common issues:
- Port not matching `PORT` env var
- Missing environment variables
- Health check failing

### Cold Start Latency

Mitigate with:
- Set `min-instances: 1`
- Optimise container image size
- Use startup CPU boost

### WebSocket Issues

Cloud Run supports WebSockets but with timeouts:
- Default timeout: 300 seconds
- Maximum: 3600 seconds

```bash
gcloud run services update nostr-bbs \
  --timeout 3600
```

---

## Related Documentation

- [Deployment Overview](index.md) — All deployment options
- [GitHub Pages](github-pages.md) — Static hosting
- [Self-Hosting](self-hosting.md) — Run your own instance
- [Configuration Reference](../reference/configuration.md) — All config options

---

[← Back to Deployment](index.md)
