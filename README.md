# Nostr BBS

**A private community platform where your conversations stay yours.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Nostr](https://img.shields.io/badge/Nostr-Protocol-purple.svg)](https://nostr.com)

---

## What is this?

Nostr BBS is a private community chat platform for groups who want to communicate without giving up their privacy. Think of it as a Discord or Slack alternative where:

- **Your private messages are truly private** - Not even administrators can read them
- **You own your identity** - No email or password needed, just a recovery phrase you control
- **It works offline** - Read and compose messages without an internet connection
- **No accounts to hack** - Your identity is a cryptographic key, not a password in a database

Perfect for social clubs, family groups, creative communities, or any group that values privacy.

---

## Features

### Communication

| | |
|:---:|:---:|
| ![Chat Hub](static/images/screenshots/06-chat-hub.png) | ![Private Messages](static/images/screenshots/09-dm.png) |
| **Group Channels** - Organised conversations by topic | **Private Messages** - End-to-end encrypted, truly private |

### Organisation

| | |
|:---:|:---:|
| ![Forums](static/images/screenshots/07-forums.png) | ![Events](static/images/screenshots/08-events.png) |
| **Forums** - Long-form discussions and announcements | **Calendar** - Schedule events, track RSVPs |

### Works Everywhere

| Desktop | Tablet | Mobile |
|:-------:|:------:|:------:|
| ![Desktop](static/images/screenshots/landing-page-desktop.png) | ![Tablet](static/images/screenshots/landing-page-tablet.png) | ![Mobile](static/images/screenshots/landing-page-mobile.png) |

---

## Getting Started

### Join an existing community

1. **Get an invite** from a community administrator
2. **Visit the community URL** in your browser
3. **Create your account** - takes about 2 minutes
4. **Save your recovery phrase** - this is your key to your account

### First time using the app

1. Click **Create Account**
2. Choose a nickname (you can change it later)
3. **Write down your recovery phrase** and store it somewhere safe
4. Start chatting!

> **Important:** Your recovery phrase is the only way to recover your account. Store it in a password manager or secure location.

### Install on your phone

The platform works as a mobile app:

1. Visit the community URL in your phone's browser
2. Tap **Add to Home Screen** (or "Install App" in the menu)
3. The app icon appears on your home screen
4. Messages you've loaded work offline

---

## Privacy & Security

### What makes it different

| Traditional Platforms | Nostr BBS |
|-----------------------|-----------|
| Company stores your password | You control your keys |
| Admins can read private messages | Private messages are end-to-end encrypted |
| Account locked to one service | Your identity works anywhere |
| Data sold to advertisers | No tracking, no ads |

### Your private messages are protected by "gift wrapping"

When you send a private message:
- The **content** is encrypted
- The **timestamp** is hidden
- The **sender** is hidden
- Only you and the recipient can read it

Even if someone intercepts the message, they only see encrypted data with no way to know who sent it or when.

---

<details>
<summary><strong>Developer Setup (Core Team)</strong></summary>

### Quick Start (Live System)

For core team members with access to the `.env` file:

```bash
# 1. Clone and install
git clone https://github.com/jjohare/Nostr-BBS.git
cd Nostr-BBS
npm install

# 2. Get .env from team (contains live credentials)
# Place it in the project root - DO NOT commit this file

# 3. Verify connectivity to live services
npm run dev

# 4. Access: http://localhost:5173
```

### Live Services (cumbriadreamlab project)

| Service | URL |
|---------|-----|
| **Nostr Relay** | `wss://nostr-relay-617806532906.us-central1.run.app` |
| **Embedding API** | `https://embedding-api-617806532906.us-central1.run.app` |
| **Image API** | `https://image-api-617806532906.us-central1.run.app` |

### Testing Against Live

```bash
# Verify relay is responding
curl -s https://nostr-relay-617806532906.us-central1.run.app/health | jq

# Check embedding API
curl -s https://embedding-api-617806532906.us-central1.run.app/health | jq

# Run dev server with live backend
npm run dev
```

### Creating Test Accounts

1. Open `http://localhost:5173` in browser
2. Click **Create Account**
3. Enter a test nickname (e.g., `dev-yourname`)
4. Save the recovery phrase (for test accounts, store in password manager)
5. Request zone access from an admin

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run all tests (927 tests) |
| `npm run test:unit` | Run unit tests only |
| `npm run check` | TypeScript type checking |
| `npm run lint` | ESLint code linting |

### Environment Variables

```bash
# Required
GOOGLE_CLOUD_PROJECT=cumbriadreamlab
VITE_RELAY_URL=wss://nostr-relay-617806532906.us-central1.run.app
VITE_ADMIN_PUBKEY=<64-char-hex-pubkey>

# Cloud Run APIs
VITE_EMBEDDING_API_URL=https://embedding-api-617806532906.us-central1.run.app
VITE_IMAGE_API_URL=https://image-api-617806532906.us-central1.run.app

# Optional
VITE_APP_NAME=Minimoonoir
VITE_NDK_DEBUG=false
```

### Discovering Cloud Run Services

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project cumbriadreamlab

# List all deployed services
gcloud run services list --format="table(SERVICE,REGION,URL)"
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| WebSocket fails | Check `VITE_RELAY_URL` uses `wss://` not `https://` |
| 401 on relay | Your pubkey may not be whitelisted - ask admin |
| Embedding search empty | Verify `VITE_EMBEDDING_API_URL` is set |
| Images don't upload | Check `VITE_IMAGE_API_URL` is set |

### Documentation

- [Development Setup](docs/developer/getting-started/development-setup.md)
- [Project Structure](docs/developer/getting-started/project-structure.md)
- [Deployment Guide](docs/developer/deployment/index.md)
- [Admin Guide](docs/admin-guide.md)

</details>

---

<details>
<summary><strong>Architecture</strong></summary>

### System Overview

```
Browser (PWA) ─────> GitHub Pages (Static CDN)
     │
     ├─── WebSocket ──> Nostr Relay (Messages)
     │
     └─── HTTPS ──────> Cloud Run (Semantic Search API)
                              │
                              └──> Cloud Storage (Vector Index)
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | SvelteKit 5, TailwindCSS, DaisyUI |
| Protocol | Nostr (NDK) |
| Encryption | NIP-44, NIP-17/59 (Gift Wrap) |
| Search | HNSW vector search, sentence-transformers |
| Hosting | GitHub Pages (static), Cloud Run (API) |
| Storage | IndexedDB (local), Cloud Storage (vectors) |

### Supported Nostr NIPs

| NIP | Feature |
|-----|---------|
| NIP-01 | Basic protocol, events, relays |
| NIP-17/59 | Private DMs with gift wrapping |
| NIP-28 | Public chat channels |
| NIP-44 | Modern encryption |
| NIP-52 | Calendar events with RSVP |
| NIP-42 | Relay authentication |

### Free Tier Hosting

The platform runs entirely on free tiers:

- **GitHub Pages** - Unlimited bandwidth for static files
- **Cloud Run** - 2M requests/month free
- **Cloud Storage** - 5 GB storage free

Typical usage (100k messages): **$0/month**

### Documentation

- [System Architecture](docs/developer/architecture/index.md)
- [Component Structure](docs/developer/architecture/components.md)
- [Data Flow](docs/developer/architecture/data-flow.md)
- [NIP Protocol Reference](docs/developer/reference/nip-protocol-reference.md)

</details>

---

<details>
<summary><strong>Contributing</strong></summary>

### Ways to Contribute

- **Bug fixes** - Fix reported issues
- **Features** - Implement new functionality
- **Documentation** - Improve guides
- **Translations** - Help localise the platform
- **Bug reports** - Report issues with detail

### Quick Start

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our [code style](docs/developer/contributing/code-style.md)
4. Write tests for new features
5. Commit with conventional commits (`git commit -m 'feat: add amazing feature'`)
6. Push and open a Pull Request

### Labels

Look for issues with these labels:
- `good first issue` - Great for newcomers
- `help wanted` - Ready for contribution
- `documentation` - Doc improvements needed

### Code of Conduct

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the community

### Documentation

- [Contributing Guide](docs/developer/contributing/index.md)
- [Code Style](docs/developer/contributing/code-style.md)
- [Testing Guide](docs/developer/contributing/testing.md)
- [Pull Request Process](docs/developer/contributing/pull-requests.md)

</details>

---

<details>
<summary><strong>Security</strong></summary>

### Encryption

| Message Type | Protection |
|--------------|------------|
| Private Messages | End-to-end encrypted (NIP-44), gift-wrapped (NIP-59) |
| Channel Messages | Transport encrypted, visible to zone members |
| Keys | Stored encrypted in browser (AES-256-GCM) |

### What administrators CAN see

- Channel messages in their zones
- Member lists and public profiles
- Event attendance

### What administrators CANNOT see

- Your private messages (end-to-end encrypted)
- Your recovery phrase or private key
- Messages in zones they don't administer

### Security Features

- **NIP-42 authentication** - Cryptographic proof of identity
- **Cohort-based access** - Fine-grained permissions per zone
- **Rate limiting** - Protection against abuse
- **No server-side secrets** - Keys never leave your device

### Reporting Vulnerabilities

Please report security issues privately via GitHub Security Advisories.

### Documentation

- [Privacy Overview](docs/user/safety/privacy.md)
- [Account Security](docs/user/safety/account-security.md)
- [Security Architecture](docs/developer/architecture/security.md)

</details>

---

## Support

- **User Guide:** [docs/user/](docs/user/index.md)
- **Issues:** [GitHub Issues](https://github.com/jjohare/Nostr-BBS/issues)
- **Discussions:** [GitHub Discussions](https://github.com/jjohare/Nostr-BBS/discussions)

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Credits

Built with [Nostr Protocol](https://nostr.com), [SvelteKit](https://kit.svelte.dev), [NDK](https://github.com/nostr-dev-kit/ndk), and [DaisyUI](https://daisyui.com).
