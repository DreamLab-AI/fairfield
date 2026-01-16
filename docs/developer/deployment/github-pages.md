---
title: "GitHub Pages Deployment"
description: "Deploy the platform as a static site to GitHub Pages."
category: tutorial
tags: ['deployment', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# GitHub Pages Deployment

Deploy the platform as a static site to GitHub Pages.

---

## Overview

GitHub Pages provides free static hosting directly from your repository. This guide covers deployment for the SvelteKit static adapter.

---

## Prerequisites

- GitHub repository with push access
- Node.js 18+ installed locally
- SvelteKit configured with static adapter

---

## Configuration

### 1. Install Static Adapter

```bash
npm install -D @sveltejs/adapter-static
```

### 2. Configure SvelteKit

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',  // SPA fallback
      precompress: false,
      strict: true
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? '/your-repo-name' : ''
    }
  }
};

export default config;
```

### 3. Add Base Path Handling

For repository-based URLs (e.g., `username.github.io/repo-name`):

```typescript
// src/lib/config.ts
export const base = import.meta.env.BASE_URL;

// Usage in components
import { base } from '$lib/config';
// <a href="{base}/about">About</a>
```

---

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          NODE_ENV: production
          PUBLIC_RELAY_URL: ${{ vars.PUBLIC_RELAY_URL }}
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'build'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Method 2: Manual Deployment

```bash
# Build the project
npm run build

# Deploy using gh-pages package
npm install -D gh-pages
npx gh-pages -d build
```

Add to `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d build"
  }
}
```

---

## Repository Settings

### Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save changes

### Configure Custom Domain (Optional)

1. In **Settings** → **Pages**, enter your custom domain
2. Add DNS records:

   **For apex domain (example.com):**
   ```
   A     @    185.199.108.153
   A     @    185.199.109.153
   A     @    185.199.110.153
   A     @    185.199.111.153
   ```

   **For subdomain (www.example.com):**
   ```
   CNAME www  username.github.io
   ```

3. Enable **Enforce HTTPS**

4. Add `CNAME` file to `static/` directory:
   ```
   example.com
   ```

---

## Environment Variables

### Setting Variables in GitHub

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add variables under **Variables** tab:

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBLIC_RELAY_URL` | Default relay WebSocket URL | `wss://relay.example.com` |
| `PUBLIC_APP_NAME` | Application name | `Nostr BBS` |

### Accessing in Build

```yaml
# In workflow
env:
  PUBLIC_RELAY_URL: ${{ vars.PUBLIC_RELAY_URL }}
```

---

## Static Site Limitations

### What Works

- All client-side functionality
- WebSocket connections to relays
- Local storage and IndexedDB
- Service worker (PWA features)

### What Doesn't Work

- Server-side rendering (SSR)
- API routes (`+server.ts` files)
- Server-side authentication
- Dynamic OG images

### Workarounds

**For API Routes:**
Use external services or serverless functions:

```typescript
// Instead of +server.ts, use external API
const API_URL = import.meta.env.VITE_API_URL;

async function fetchData() {
  const response = await fetch(`${API_URL}/endpoint`);
  return response.json();
}
```

---

## Troubleshooting

### 404 on Page Refresh

Ensure `fallback: 'index.html'` is set in adapter config:

```javascript
adapter({
  fallback: 'index.html'  // Required for SPA routing
})
```

### Assets Not Loading

Check base path configuration:

```javascript
// svelte.config.js
kit: {
  paths: {
    base: '/repo-name'  // Must match repository name
  }
}
```

### Build Fails in CI

Check Node.js version matches local:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'  # Match your local version
```

### CORS Issues

Relays must allow connections from your GitHub Pages domain:

```
Access-Control-Allow-Origin: https://username.github.io
```

---

## Performance Optimisation

### Enable Compression

```javascript
// svelte.config.js
adapter({
  precompress: true  // Generates .gz and .br files
})
```

### Cache Headers

Add `_headers` file to `static/`:

```
/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/service-worker.js
  Cache-Control: no-cache
```

### Asset Optimisation

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['svelte', '@nostr-dev-kit/ndk'],
          crypto: ['@noble/hashes', '@noble/curves']
        }
      }
    }
  }
});
```

---

## Monitoring

### Check Deployment Status

1. Go to **Actions** tab
2. View workflow run logs
3. Check deployment URL in job output

### Verify Deployment

```bash
# Check if site is accessible
curl -I https://username.github.io/repo-name

# Test specific routes
curl -I https://username.github.io/repo-name/channels
```

---

## Related Documentation

- [Deployment Overview](index.md) — All deployment options
- [Cloud Run](cloud-run.md) — Google Cloud deployment
- [Self-Hosting](self-hosting.md) — Run your own instance
- [PWA Features](../features/pwa.md) — Progressive Web App setup

---

[← Back to Deployment](index.md)
