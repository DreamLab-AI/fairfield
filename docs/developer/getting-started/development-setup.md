---
title: "Development Setup"
description: "Set up your local development environment to contribute to the platform."
category: tutorial
tags: ['developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Development Setup

Set up your local development environment to contribute to the platform.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20+ | JavaScript runtime |
| **npm** | 9+ | Package manager |
| **Git** | 2.30+ | Version control |

### Optional Software

| Software | Purpose |
|----------|---------|
| **Docker** | Local relay testing |
| **PostgreSQL** | Local database (or use Docker) |
| **VS Code** | Recommended editor |

---

## Quick Start

### 1. Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/your-org/nostr-bbs.git

# Or via SSH
git clone git@github.com:your-org/nostr-bbs.git

cd nostr-bbs
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies including:
- SvelteKit framework
- NDK (Nostr Development Kit)
- Tailwind CSS
- TypeScript tooling
- Testing frameworks

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit with your configuration
nano .env.local
```

**Minimum configuration:**

```bash
# Relay connection (use public relay for development)
PUBLIC_RELAY_URL=wss://relay.damus.io

# App configuration
PUBLIC_APP_NAME="Dev Instance"
PUBLIC_APP_URL=http://localhost:5173
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PUBLIC_RELAY_URL` | WebSocket URL for Nostr relay | `wss://relay.example.com` |
| `PUBLIC_APP_URL` | Public URL of the application | `http://localhost:5173` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_APP_NAME` | Application display name | `"Nostr BBS"` |
| `PUBLIC_DEBUG` | Enable debug logging | `false` |
| `PUBLIC_THEME` | Default colour theme | `"dark"` |

---

## Development Workflow

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:integration` | Run integration tests |

### Hot Module Replacement

The development server supports HMR:
- Component changes reflect immediately
- State is preserved where possible
- CSS changes apply without reload

### TypeScript

The project uses strict TypeScript:

```typescript
// tsconfig.json settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

Run type checking:

```bash
npm run check
```

---

## IDE Setup

### VS Code (Recommended)

Install recommended extensions:

```bash
# From the project root
code --install-extension svelte.svelte-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
```

**Workspace settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[svelte]": {
    "editor.defaultFormatter": "svelte.svelte-vscode"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Other Editors

- **WebStorm** — Built-in Svelte support
- **Neovim** — Use `svelte-language-server`
- **Sublime Text** — Install LSP and Svelte packages

---

## Local Relay Setup

For full offline development, run a local relay:

### Using Docker

```bash
# Start a local strfry relay
docker run -d \
  --name nostr-relay \
  -p 7777:7777 \
  -v relay-data:/app/strfry-db \
  dockurr/strfry

# Update .env.local
PUBLIC_RELAY_URL=ws://localhost:7777
```

### Relay Configuration

For development, configure the relay to:
- Accept all events (no authentication)
- Allow deletion
- Enable NIP-29 groups

---

## Database Setup (Optional)

For features requiring persistent storage:

### PostgreSQL with Docker

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=nostrbbs \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15

# Install pgvector extension
docker exec -it postgres psql -U postgres -d nostrbbs \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Connection String

```bash
DATABASE_URL=postgres://postgres:devpassword@localhost:5432/nostrbbs
```

---

## Troubleshooting

### Common Issues

<details>
<summary><strong>npm install fails</strong></summary>

**Symptoms:** Dependency resolution errors

**Solutions:**
1. Clear npm cache: `npm cache clean --force`
2. Delete `node_modules` and `package-lock.json`, then reinstall
3. Ensure Node.js version is 20+: `node --version`

</details>

<details>
<summary><strong>WebSocket connection fails</strong></summary>

**Symptoms:** Cannot connect to relay

**Solutions:**
1. Check relay URL is correct
2. For local relay, ensure Docker container is running
3. Check firewall isn't blocking WebSocket connections
4. Try a public relay: `wss://relay.damus.io`

</details>

<details>
<summary><strong>TypeScript errors</strong></summary>

**Symptoms:** Type checking fails

**Solutions:**
1. Run `npm run check` to see specific errors
2. Ensure VS Code is using workspace TypeScript
3. Restart TypeScript server: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

</details>

<details>
<summary><strong>Svelte compilation errors</strong></summary>

**Symptoms:** Component fails to compile

**Solutions:**
1. Check for syntax errors in `.svelte` files
2. Ensure proper script/style tag order
3. Check import paths are correct

</details>

---

## Next Steps

- [Project Structure](project-structure.md) — Understand the codebase layout
- [First Contribution](first-contribution.md) — Make your first code change
- [Code Style](../contributing/code-style.md) — Coding standards

---

[← Back to Developer Documentation](../index.md)
