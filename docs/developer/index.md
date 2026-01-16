---
title: "Developer Documentation"
description: "Technical documentation for building, extending, and deploying the platform with architecture guides and API reference"
category: reference
tags: [developer, architecture, api, deployment, contributing]
difficulty: advanced
related-docs:
  - ./getting-started/index.md
  - ./architecture/index.md
  - ../adr/README.md
last-updated: 2026-01-16
---

# Developer Documentation

Technical documentation for building, extending, and deploying the platform.

---

## Overview

This documentation is for developers who want to:

- **Understand** the platform's architecture
- **Contribute** to the codebase
- **Deploy** their own instance
- **Extend** functionality with custom features

---

## Documentation Structure

Following the [Diátaxis framework](https://diataxis.fr/), our developer documentation is organised into four types:

| Type | Purpose | Example |
|------|---------|---------|
| **Tutorials** | Learning-oriented guides | Getting started with local development |
| **How-to Guides** | Task-oriented instructions | Deploying to production |
| **Reference** | Information-oriented details | NIP protocol specifications |
| **Explanation** | Understanding-oriented discussion | Why we chose this architecture |

---

## Quick Navigation

### Getting Started

| Guide | Description |
|-------|-------------|
| [Development Setup](getting-started/development-setup.md) | Set up your local environment |
| [Project Structure](getting-started/project-structure.md) | Understand the codebase layout |
| [First Contribution](getting-started/first-contribution.md) | Make your first code change |

### Architecture

| Guide | Description |
|-------|-------------|
| [System Overview](architecture/index.md) | High-level architecture and design |
| [Component Architecture](architecture/components.md) | Frontend component structure |
| [Data Flow](architecture/data-flow.md) | Message lifecycle and data patterns |
| [Security Model](architecture/security.md) | Authentication and encryption |

### Features

| Guide | Description |
|-------|-------------|
| [Messaging System](features/messaging.md) | Channel and message implementation |
| [Private Messages](features/dm-implementation.md) | NIP-17/NIP-59 DM implementation |
| [Calendar & Events](features/calendar.md) | NIP-52 calendar event system |
| [PWA Implementation](features/pwa.md) | Progressive Web App features |
| [Semantic Search](features/semantic-search.md) | AI-powered vector search |

### Reference

| Guide | Description |
|-------|-------------|
| [NIP Protocol Reference](reference/nip-protocol-reference.md) | Nostr Implementation Possibilities |
| [API Reference](reference/api.md) | Internal API documentation |
| [Store Reference](reference/stores.md) | Svelte store documentation |
| [Configuration](reference/configuration.md) | Configuration options |
| [Event Kinds](reference/event-kinds.md) | Nostr event types used |

### Deployment

| Guide | Description |
|-------|-------------|
| [Deployment Overview](deployment/index.md) | Deployment options and strategies |
| [GitHub Pages](deployment/github-pages.md) | Static hosting setup |
| [Cloud Run](deployment/cloud-run.md) | Google Cloud deployment |
| [Self-Hosting](deployment/self-hosting.md) | Run your own instance |

### Contributing

| Guide | Description |
|-------|-------------|
| [Contributing Guide](contributing/index.md) | How to contribute |
| [Code Style](contributing/code-style.md) | Coding standards |
| [Testing](contributing/testing.md) | Testing guidelines |
| [Pull Requests](contributing/pull-requests.md) | PR workflow |

---

## Technology Stack

### Frontend

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | SvelteKit 2 | Application framework with SSR/SPA |
| **Language** | TypeScript | Type-safe development |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Nostr SDK** | NDK (nostr-dev-kit) | Nostr protocol implementation |
| **Storage** | IndexedDB (Dexie) | Client-side data persistence |
| **Build** | Vite | Fast development and builds |

### Backend / Infrastructure

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Relay** | Custom Nostr relay | Message routing and storage |
| **Hosting** | GitHub Pages / Cloud Run | Static and API hosting |
| **Database** | PostgreSQL + pgvector | Relational data and embeddings |
| **Storage** | Cloud Storage | Media and file storage |

### Protocols

| Protocol | Purpose |
|----------|---------|
| **Nostr** | Decentralised messaging protocol |
| **WebSocket** | Real-time communication |
| **NIP-44** | End-to-end encryption |
| **NIP-59** | Gift-wrapped private messages |

---

## Key Architectural Decisions

### Why Nostr?

We chose the Nostr protocol because:

1. **Decentralisation** — Users own their identity via cryptographic keys
2. **Interoperability** — Standard protocol with growing ecosystem
3. **Privacy** — Built-in encryption standards (NIP-44, NIP-59)
4. **Resilience** — No single point of failure
5. **Simplicity** — JSON-based events over WebSocket

### Why SvelteKit?

We chose SvelteKit because:

1. **Performance** — Compiled output, minimal runtime
2. **Developer Experience** — Reactive by default, less boilerplate
3. **PWA Support** — Excellent service worker integration
4. **SSR/SPA Flexibility** — Can deploy as static SPA or server-rendered
5. **Ecosystem** — Strong TypeScript support, active community

### Why a Private Relay?

We operate a private relay because:

1. **Control** — Guaranteed deletion, moderation capabilities
2. **Performance** — Optimised for our use case
3. **Privacy** — Data stays within our infrastructure
4. **Features** — Custom NIP-29 group implementation

---

## Core Concepts

### Identity

Users are identified by a **public/private key pair**:

- **Public key** (npub) — The user's identity, shareable
- **Private key** (nsec) — Proves ownership, never shared
- **Recovery phrase** — BIP-39 mnemonic that regenerates keys

### Events

Everything in Nostr is an **event** — a signed JSON object:

```typescript
interface NostrEvent {
  id: string;          // SHA256 hash of serialised event
  pubkey: string;      // Author's public key
  created_at: number;  // Unix timestamp
  kind: number;        // Event type (1=note, 4=DM, etc.)
  tags: string[][];    // Metadata tags
  content: string;     // Event content
  sig: string;         // Schnorr signature
}
```

### Zones

The platform organises content into **zones** (categories):

- **Minimoonoir** — Social community (cohort: `moomaa-tribe`)
- **DreamLab** — Business/creative (cohort: `business`)
- **Family** — Private family space (cohort: `family`)

Each zone has its own:
- Sections (sub-categories)
- Channels (NIP-28/29 groups)
- Branding (colours, images)
- Access control

---

## Development Workflow

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/nostr-bbs.git
cd nostr-bbs

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev

# Open http://localhost:5173
```

### Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run type checking
npm run check

# Run linting
npm run lint
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Getting Help

### Resources

- **GitHub Issues** — Bug reports and feature requests
- **Pull Requests** — Code contributions
- **Discussions** — Questions and ideas

### Community

- Join the `#development` channel in the platform
- Read existing issues before opening new ones
- Check the documentation first

---

## Next Steps

1. **[Development Setup](getting-started/development-setup.md)** — Get your environment ready
2. **[System Overview](architecture/index.md)** — Understand the architecture
3. **[NIP Protocol Reference](reference/nip-protocol-reference.md)** — Learn the protocol

---

[← Back to Documentation](../README.md)
