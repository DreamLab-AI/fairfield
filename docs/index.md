---
title: Nostr-BBS Documentation Index
description: Master documentation hub for Nostr-BBS with guides, architecture, features, and deployment documentation
category: reference
tags: [documentation, index, navigation]
last_updated: 2026-01-16
---

# Nostr-BBS Documentation Index

**Master documentation hub for Nostr-BBS** - A decentralised community bulletin board system built on the Nostr protocol with NIP-52 calendar events, NIP-28 public chat channels, NIP-17/59 encrypted direct messages, and AI-powered semantic search.

**Version:** 1.0.0
**Last Updated:** 2026-01-16

---

## Table of Contents

- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Features](#features)
- [Authentication](#authentication)
- [Guides](#guides)
- [Development](#development)
- [Deployment](#deployment)
- [Reference](#reference)
- [Maintenance and Quality](#maintenance-and-quality)

---

## Getting Started

### For Users

**[User Documentation](user/index.md)**
Complete user documentation including getting started guides, zone guides, and feature documentation.

**[Creating an Account](user/getting-started/creating-account.md)**
Step-by-step guide to creating your account and getting started with the platform.

**[First Steps](user/getting-started/first-steps.md)**
Your first steps after creating an account - navigating the platform and key features.

---

## Architecture

### System Design (SPARC Methodology)

**[01 - Specification](architecture/01-specification.md)**
Requirements analysis, functional specifications, and project scope definition.

**[02 - Architecture](architecture/02-architecture.md)**
System architecture overview including frontend, backend, relay, and cloud services integration.

**[03 - Pseudocode](architecture/03-pseudocode.md)**
Algorithm design and pseudocode for core protocols and data flows.

**[04 - Refinement](architecture/04-refinement.md)**
Implementation refinement, optimisations, and architectural improvements.

**[05 - Completion](architecture/05-completion.md)**
Integration testing, deployment procedures, and production readiness checklist.

### Additional Architecture Documentation

**[Architecture Overview](architecture.md)**
High-level architecture overview and system design summary.

---

## Features

### Developer Feature Documentation

**[Direct Messages Implementation](features/dm-implementation.md)**
NIP-17/59 encrypted direct messaging with gift wrap for metadata privacy.

**[Mobile UI Components](features/mobile-ui-components.md)**
Material Design 3 inspired mobile components including BottomSheet, SwipeableMessage, and VirtualList with touch gestures and accessibility.

**[Secure Clipboard and Memory](features/secure-clipboard.md)**
Security utilities for handling sensitive data with automatic clipboard clearing (60 second timeout) and memory-safe string handling.

**[Authentication](features/authentication.md)**
Authentication system implementation and design patterns.

### User Feature Documentation

For end-user feature guides, see the [User Features](user/features/index.md) section including:
- [Messaging](user/features/messaging.md)
- [Private Messages](user/features/private-messages.md)
- [Calendar](user/features/calendar.md)
- [Searching](user/features/searching.md)
- [Bookmarks](user/features/bookmarks.md)
- [Reactions](user/features/reactions.md)
- [Notifications](user/features/notifications.md)
- [Customisation](user/features/customisation.md)

---

## Authentication

### Authentication Design Package

**[AUTH_DESIGN_SUMMARY.md](AUTH_DESIGN_SUMMARY.md)**
High-level overview of authentication design patterns, user flows, and security considerations.

**[AUTH_FLOW_DESIGN.md](AUTH_FLOW_DESIGN.md)**
Screen-by-screen authentication flow specification with wireframes, button states, and validation rules.

**[AUTH_IMPLEMENTATION_GUIDE.md](AUTH_IMPLEMENTATION_GUIDE.md)**
Developer implementation reference with crypto utilities, validation, storage, and Nostr integration code.

**[AUTH_PACKAGE_INDEX.md](AUTH_PACKAGE_INDEX.md)**
Complete index of the authentication design package with component specifications.

**[COMPONENT_STRUCTURE.md](COMPONENT_STRUCTURE.md)**
React component hierarchy and specifications with TypeScript interfaces.

**[NIP07_ANALYSIS.md](NIP07_ANALYSIS.md)**
Analysis of NIP-07 browser extension integration for secure key management.

---

## Guides

### Implementation Guides

**[Quick Start Guide](guides/quick-start.md)**
Step-by-step implementation guide for getting started with the authentication system.

---

## Development

### Developer Documentation

**[Developer Index](developer/index.md)**
Main developer documentation hub with guides for getting started, architecture, features, and contributing.

**[Development Setup](developer/getting-started/development-setup.md)**
Local development environment setup guide.

**[Project Structure](developer/getting-started/project-structure.md)**
Overview of the project directory structure and organisation.

**[Contributing Guidelines](developer/contributing/index.md)**
How to contribute to the project including code style and pull request process.

---

## Deployment

### Production Deployment

**[Deployment Index](developer/deployment/index.md)**
Overview of deployment options and strategies.

**[GitHub Pages Deployment](developer/deployment/github-pages.md)**
Deploy the application to GitHub Pages.

**[Cloud Run Deployment](developer/deployment/cloud-run.md)**
Deploy to Google Cloud Run for serverless container hosting.

**[Self-Hosting Guide](developer/deployment/self-hosting.md)**
Guide for self-hosting the application.

---

## Reference

### API Documentation

**[Developer Reference Index](developer/reference/api.md)**
API documentation for components and utilities.

**[Configuration Reference](developer/reference/configuration.md)**
Environment variables and configuration settings.

**[NIP Protocol Reference](developer/reference/nip-protocol-reference.md)**
Nostr Improvement Proposals (NIPs) implemented in the system with usage examples.

**[Event Kinds Reference](developer/reference/event-kinds.md)**
Nostr event kinds used in the application.

**[Stores Reference](developer/reference/stores.md)**
Svelte store API reference.

---

## Maintenance and Quality

### Project Maintenance

**[Contributing Guidelines](developer/contributing/index.md)**
Contributing guidelines, code style, pull request process, and development workflow.

**[Testing Guide](developer/contributing/testing.md)**
How to write and run tests for the project.

**[Pull Requests](developer/contributing/pull-requests.md)**
Pull request guidelines and review process.

### Quality Assurance

**[Link Validation Report](link-validation-report.md)**
Automated link validation report for documentation quality.

---

## Documentation Standards

### Diataxis Framework

This documentation follows the [Diataxis framework](https://diataxis.fr/) for systematic documentation:

- **Tutorials** - Learning-oriented, step-by-step guides for beginners
- **How-to Guides** - Task-oriented, practical solutions to specific problems
- **Reference** - Information-oriented, technical descriptions of APIs and configuration
- **Explanation** - Understanding-oriented, discussion of architecture and design decisions

### Quality Standards

- **UK English** spelling and grammar throughout
- **Mermaid diagrams** for all architecture and flow visualisations
- **YAML frontmatter** with title, description, tags, and last_updated metadata
- **100% link coverage** with automated validation
- **Accessibility** - WCAG 2.1 Level AA compliance for diagrams and content

### File Organisation

```
docs/
├── INDEX.md                   # This file - master hub
├── README.md                  # Documentation overview
├── architecture/              # System design (SPARC)
├── adr/                       # Architecture Decision Records
├── ddd/                       # Domain-Driven Design documentation
├── developer/                 # Developer documentation
│   ├── architecture/          # Technical architecture
│   ├── contributing/          # Contribution guidelines
│   ├── deployment/            # Deployment guides
│   ├── features/              # Feature implementation
│   ├── getting-started/       # Development setup
│   └── reference/             # API reference
├── features/                  # Feature documentation
├── guides/                    # Implementation guides
├── security/                  # Security documentation
└── user/                      # End-user documentation
    ├── features/              # User feature guides
    ├── getting-started/       # User onboarding
    ├── safety/                # Privacy and security
    └── zones/                 # Community zone guides
```

---

## Quick Links

- **[Project README](../README.md)** - Main project overview with screenshots and quick start
- **[User Documentation](user/index.md)** - End-user guides and tutorials
- **[Developer Documentation](developer/index.md)** - Technical documentation for developers
- **[Contributing](developer/contributing/index.md)** - How to contribute to the project
- **[GitHub Repository](https://github.com/jjohare/Nostr-BBS)** - Source code and issue tracking

---

## Support and Community

- **Documentation Issues** - Report broken links or unclear documentation via [GitHub Issues](https://github.com/jjohare/Nostr-BBS/issues)
- **Discussions** - Join community discussions at [GitHub Discussions](https://github.com/jjohare/Nostr-BBS/discussions)
- **Security** - Report security issues privately to [@jjohare](https://github.com/jjohare)

---

**Last validated:** 2026-01-16
**Documentation version:** 1.0.0
