---
title: "Information Architecture Specification"
description: "Diataxis-compliant documentation reorganization specification for 95 documentation files"
category: reference
tags: [architecture, documentation, diataxis, specification]
difficulty: advanced
related-docs:
  - ./CONTRIBUTING.md
  - ./MAINTENANCE.md
last-updated: 2026-01-16
---

# Information Architecture Specification
## Diataxis-Compliant Documentation Reorganization

**Document Version:** 1.0
**Date:** 2026-01-16
**Author:** System Architecture Designer Agent
**Status:** Design Complete - Awaiting Approval

---

## Executive Summary

This specification defines a comprehensive reorganization of 95 documentation files (38,800 lines) from a fragmented 9-directory structure into a unified 7-section Diataxis-compliant information architecture. The reorganization will eliminate 15 duplicate files, consolidate overlapping content, and establish clear ownership and maintenance protocols.

**Key Metrics:**
- Current: 95 files across 9 directories with 15 root-level files
- Target: ~80 files across 7 sections with zero root-level files
- Consolidation: 15 files removed through merging
- Compliance: 100% Diataxis framework alignment

---

## 1. Proposed 7-Section Structure

### 1.1 Tutorials (`/docs/tutorials/`)

**Purpose:** Learning-oriented guides for getting started
**Owner:** User Education Lead
**Target Files:** 12 files

```
tutorials/
├── index.md (new)
├── user-onboarding/
│   ├── creating-account.md (from user/getting-started/)
│   ├── first-steps.md (from user/getting-started/)
│   └── quick-start.md (from guides/)
├── zone-guides/
│   ├── minimoonoir.md (from user/zones/)
│   ├── dreamlab.md (from user/zones/)
│   └── family.md (from user/zones/)
└── developer-onboarding/
    ├── development-setup.md (from developer/getting-started/)
    ├── project-structure.md (from developer/getting-started/)
    └── first-contribution.md (from developer/getting-started/)
```

**Success Metrics:**
- Time to first contribution < 30 minutes
- User onboarding completion rate > 85%

---

### 1.2 How-To Guides (`/docs/how-to/`)

**Purpose:** Task-oriented instructions for accomplishing specific goals
**Owner:** Technical Writer
**Target Files:** 25 files

```
how-to/
├── index.md (new)
├── user-tasks/
│   ├── authentication.md (from features/)
│   ├── messaging.md (from user/features/)
│   ├── calendar.md (from user/features/)
│   ├── bookmarks.md (from user/features/)
│   ├── notifications.md (from user/features/)
│   └── customisation.md (from user/features/)
├── developer-tasks/
│   ├── auth-implementation.md (from AUTH_IMPLEMENTATION_GUIDE.md)
│   ├── dm-implementation.md (consolidate features/ + developer/features/)
│   ├── calendar-integration.md (from developer/features/)
│   ├── messaging-features.md (from developer/features/)
│   └── pwa-setup.md (from developer/features/)
├── operations/
│   ├── admin-guide.md (from admin-guide.md)
│   └── admin-security.md (from security/)
└── security-tasks/
    └── secure-clipboard.md (from features/)
```

---

### 1.3 Reference (`/docs/reference/`)

**Purpose:** Information-oriented technical specifications
**Owner:** Technical Architect
**Target Files:** 18 files

```
reference/
├── index.md (new)
├── api/
│   ├── index.md (from developer/reference/api.md)
│   ├── event-kinds.md (from developer/reference/)
│   └── stores.md (from developer/reference/)
├── protocols/
│   ├── nip-protocol-reference.md (from developer/reference/)
│   └── nip07-analysis.md (from NIP07_ANALYSIS.md)
├── configuration/
│   ├── index.md (from developer/reference/configuration.md)
│   └── auth-packages.md (from AUTH_PACKAGE_INDEX.md)
├── components/
│   ├── structure.md (from COMPONENT_STRUCTURE.md)
│   └── mobile-components.md (from features/)
└── domain-model/
    ├── index.md (from ddd/README.md)
    ├── domain-model.md (from ddd/01-domain-model.md)
    ├── bounded-contexts.md (from ddd/02-bounded-contexts.md)
    ├── aggregates.md (from ddd/03-aggregates.md)
    ├── domain-events.md (from ddd/04-domain-events.md)
    ├── value-objects.md (from ddd/05-value-objects.md)
    └── ubiquitous-language.md (from ddd/06-ubiquitous-language.md)
```

---

### 1.4 Explanation (`/docs/explanation/`)

**Purpose:** Understanding-oriented concepts and architectural decisions
**Owner:** System Architect
**Target Files:** 20 files

```
explanation/
├── index.md (new)
├── architecture/
│   ├── index.md (merge architecture.md + developer/architecture/index.md)
│   ├── auth-design.md (merge AUTH_DESIGN_SUMMARY.md + AUTH_FLOW_DESIGN.md)
│   ├── components.md (from developer/architecture/)
│   ├── data-flow.md (from developer/architecture/)
│   └── security.md (from developer/architecture/)
├── adr/
│   ├── README.md (from adr/)
│   ├── 000-template.md
│   ├── 001-nostr-protocol-foundation.md
│   ├── 002-three-tier-hierarchy.md
│   ├── 003-gcp-cloud-run-infrastructure.md
│   ├── 004-zone-based-access-control.md
│   ├── 005-nip-44-encryption-mandate.md
│   ├── 006-client-side-wasm-search.md
│   ├── 007-sveltekit-ndk-frontend.md
│   ├── 008-postgresql-relay-storage.md
│   └── ADR-001-user-registration-flow.md
├── sparc/
│   ├── 01-specification.md (from architecture/)
│   ├── 02-architecture.md (from architecture/)
│   ├── 03-pseudocode.md (from architecture/)
│   ├── 04-refinement.md (from architecture/)
│   └── 05-completion.md (from architecture/)
└── product/
    └── requirements.md (from PRD.md)
```

---

### 1.5 User Documentation (`/docs/user/`)

**Purpose:** End-user documentation hub (already well-structured)
**Owner:** User Experience Lead
**Target Files:** 20 files
**Status:** Minimal changes - already Diataxis-aligned

```
user/
├── index.md (merge with user-guide.md)
├── features/ (retain existing structure)
├── safety/ (retain existing structure)
└── zones/ (retain existing structure)
```

---

### 1.6 Developer Documentation (`/docs/developer/`)

**Purpose:** Developer contribution and implementation guides
**Owner:** Developer Relations
**Target Files:** 15 files
**Status:** Partial restructure - move getting-started to tutorials, deployment to operations

```
developer/
├── index.md (merge with DEVELOPER.md)
├── contributing/
│   ├── index.md
│   ├── code-style.md
│   ├── testing.md
│   └── pull-requests.md
└── features/ (consolidate implementation guides)
    └── semantic-search.md
```

---

### 1.7 Operations (`/docs/operations/`)

**Purpose:** DevOps, deployment, and security operations
**Owner:** DevOps Lead
**Target Files:** 8 files

```
operations/
├── index.md (new)
├── deployment/
│   ├── index.md (from developer/deployment/)
│   ├── github-pages.md (from developer/deployment/)
│   ├── cloud-run.md (from developer/deployment/)
│   └── self-hosting.md (from developer/deployment/)
└── security-audits/
    ├── 2025-01-audit.md (from security/SECURITY_AUDIT.md)
    └── 2025-01-report.md (consolidate 3 audit files)
```

---

## 2. File Migration Mapping

### 2.1 Phase 1: Consolidate Root Files (15 files)

| Current Path | New Path | Action |
|--------------|----------|--------|
| `docs/AUTH_DESIGN_SUMMARY.md` | `docs/explanation/architecture/auth-design.md` | Move + merge with AUTH_FLOW_DESIGN.md |
| `docs/AUTH_FLOW_DESIGN.md` | `docs/explanation/architecture/auth-design.md` | Merge into auth-design.md |
| `docs/AUTH_IMPLEMENTATION_GUIDE.md` | `docs/how-to/developer-tasks/auth-implementation.md` | Move |
| `docs/AUTH_PACKAGE_INDEX.md` | `docs/reference/configuration/auth-packages.md` | Move |
| `docs/COMPONENT_STRUCTURE.md` | `docs/reference/components/structure.md` | Move |
| `docs/DEVELOPER.md` | `docs/developer/index.md` | Merge |
| `docs/INDEX.md` | `docs/README.md` | Merge |
| `docs/NIP07_ANALYSIS.md` | `docs/reference/protocols/nip07-analysis.md` | Move |
| `docs/PRD.md` | `docs/explanation/product/requirements.md` | Move |
| `docs/admin-guide.md` | `docs/how-to/operations/admin-guide.md` | Move |
| `docs/user-guide.md` | `docs/user/index.md` | Merge |
| `docs/architecture.md` | `docs/explanation/architecture/index.md` | Merge |
| `docs/security-audit-report.md` | `docs/operations/security-audits/2025-01-report.md` | Merge with other audits |
| `docs/link-validation-report.md` | Delete (generated file) | Delete |

**Result:** Root directory cleared of documentation files

---

### 2.2 Phase 2-8: Directory Migrations

**Phase 2:** ADRs → `docs/explanation/adr/` (9 files)
**Phase 3:** DDD → `docs/reference/domain-model/` (7 files)
**Phase 4:** SPARC architecture → `docs/explanation/sparc/` (5 files)
**Phase 5:** Features consolidation (4 files merged)
**Phase 6:** Security consolidation (4 files merged into 2)
**Phase 7:** Developer reorganization (20 files moved)
**Phase 8:** Tutorial creation (10 files moved/copied)

---

## 3. Consolidation Opportunities

### 3.1 High-Priority Merges

| Content Area | Files to Merge | Result |
|--------------|----------------|--------|
| **Authentication** | AUTH_DESIGN_SUMMARY.md + AUTH_FLOW_DESIGN.md | `explanation/architecture/auth-design.md` |
| **DM Implementation** | features/dm-implementation.md + developer/features/dm-implementation.md | `how-to/developer-tasks/dm-implementation.md` |
| **Security Audits** | 3 audit files | `operations/security-audits/2025-01-report.md` |
| **Architecture** | architecture.md + developer/architecture/index.md | `explanation/architecture/index.md` |
| **Index Files** | INDEX.md + README.md | `docs/README.md` |

**Estimated File Reduction:** 95 → 80 files (-15 files, -16%)

---

## 4. Section Ownership Matrix

| Section | Primary Owner | Contributors | Review Cadence | Success Metrics |
|---------|---------------|--------------|----------------|-----------------|
| **Tutorials** | User Education Lead | Technical Writer, DevRel | Quarterly | Time to first contribution, Onboarding completion |
| **How-To** | Technical Writer | All teams | Monthly | Task completion rate, User satisfaction |
| **Reference** | Technical Architect | Backend/Frontend teams | Per release | API coverage, Specification accuracy |
| **Explanation** | System Architect | Tech Arch, Security Arch | Per ADR | Decision clarity, Arch consistency |
| **User** | UX Lead | User Education, Community | Monthly | User satisfaction, Support ticket reduction |
| **Developer** | Developer Relations | Backend/Frontend teams | Per sprint | Onboarding time, Contribution quality |
| **Operations** | DevOps Lead | Security, Infrastructure | Per deployment | Deployment success, Incident resolution |

### 4.1 Cross-Cutting Concerns

| Concern | Owner | Frequency | Tool |
|---------|-------|-----------|------|
| Link Validation | Technical Writer | Weekly (automated) | link-checker CI |
| Screenshot Updates | UX Lead | Per UI change | Automated capture |
| Version Updates | Release Manager | Per release | Manual review |

---

## 5. Navigation Hierarchy

### 5.1 Primary Entry Point

**File:** `/docs/README.md`

**Structure:**
1. Platform Preview (screenshots with device views)
2. Community Introduction (3 zones)
3. For Users → Links to tutorials, how-to, features, safety
4. For Developers (collapsible) → Links to dev sections

### 5.2 Section Index Pages

Each of the 7 sections requires an `index.md` with:
- Section purpose (Diataxis type)
- Quick navigation table
- Key links to subsections
- Breadcrumb navigation

**Example:** `/docs/tutorials/index.md`
```markdown
# Tutorials

**Learning-oriented guides to get you started**

These step-by-step tutorials help you learn by doing...

## User Onboarding
- [Creating an Account](user-onboarding/creating-account.md)
- [First Steps](user-onboarding/first-steps.md)

## Zone Guides
- [Minimoonoir](zone-guides/minimoonoir.md)
- [DreamLab](zone-guides/dreamlab.md)
- [Family](zone-guides/family.md)

## Developer Onboarding
- [Development Setup](developer-onboarding/development-setup.md)
- [Project Structure](developer-onboarding/project-structure.md)
```

### 5.3 Breadcrumb Pattern

```
Docs > Section > Subsection > Page
```

**Examples:**
- `Docs > Tutorials > User Onboarding > Creating Account`
- `Docs > How-To > Developer Tasks > Auth Implementation`
- `Docs > Reference > API > Event Kinds`
- `Docs > Explanation > ADR > NIP-44 Encryption Mandate`

### 5.4 Cross-Reference Strategy

**Contextual Linking Between Types:**

| From → To | Example |
|-----------|---------|
| Tutorial → How-To | "Creating Account" → "Advanced Authentication" |
| How-To → Reference | "DM Implementation" → "NIP-44 Protocol Spec" |
| Explanation → Reference | "Security Model" → "Encryption Specifications" |
| Reference → How-To | "API Reference" → "Using the API" |

---

## 6. Implementation Plan

### 6.1 Timeline (5 Weeks)

| Phase | Duration | Priority | Deliverables |
|-------|----------|----------|--------------|
| **Phase 1: Foundation** | 1 week | Critical | 7 section directories, 7 index files, updated README |
| **Phase 2: Migration** | 2 weeks | High | All 95 files moved/merged, links updated |
| **Phase 3: Validation** | 1 week | High | Zero broken links, navigation tested |
| **Phase 4: Enhancement** | 1 week | Medium | Breadcrumbs, search optimization |
| **Phase 5: Maintenance** | Ongoing | Medium | Ownership assigned, metrics tracked |

### 6.2 Phase 1: Foundation (Week 1)

**Tasks:**
1. Create 7 top-level section directories
2. Write 7 section index.md files
3. Update main README.md with new navigation
4. Set up CI link validation job

**Deliverables:**
- `docs/tutorials/index.md`
- `docs/how-to/index.md`
- `docs/reference/index.md`
- `docs/explanation/index.md`
- `docs/operations/index.md`
- Updated `docs/README.md`
- Updated `docs/user/index.md`
- Updated `docs/developer/index.md`

### 6.3 Phase 2: Migration (Weeks 2-3)

**Substeps:**
1. **Week 2, Days 1-2:** Consolidate 15 root files
2. **Week 2, Days 3-4:** Move ADRs (9 files) and DDD (7 files)
3. **Week 2, Day 5:** Split architecture docs (5 files)
4. **Week 3, Days 1-2:** Consolidate features and security
5. **Week 3, Days 3-4:** Reorganize developer docs (20 files)
6. **Week 3, Day 5:** Create tutorials section (10 files)

**Link Update Strategy:**
- Use global find/replace for moved files
- Automated script for bulk link updates
- Manual review of complex cross-references

### 6.4 Phase 3: Validation (Week 4)

**Tasks:**
1. Run automated link checker (CI job)
2. Manual validation of all index pages
3. Test 3 user journeys:
   - New user onboarding
   - Developer contribution
   - Operations deployment
4. Stakeholder review and approval

**Acceptance Criteria:**
- ✅ Zero broken internal links
- ✅ All files categorized by Diataxis type
- ✅ Navigation tested successfully
- ✅ Stakeholder sign-off

### 6.5 Phase 4: Enhancement (Week 5)

**Tasks:**
1. Add breadcrumb navigation component
2. Implement search keyword metadata
3. Create quick reference cards (PDF)
4. Add visual architecture diagrams

### 6.6 Phase 5: Maintenance (Ongoing)

**Tasks:**
- Assign section ownership per matrix
- Establish review cadences
- Monitor success metrics
- Iterate based on user feedback

**Metrics to Track:**
- Documentation coverage (% of features documented)
- User satisfaction scores (survey)
- Time to find information (analytics)
- Contribution quality (PR reviews)

---

## 7. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Broken Links** | High | High | Automated link checker in CI, manual review before merge |
| **Content Loss** | Medium | High | Git history preservation, archive branch for old structure |
| **User Disruption** | Low | Medium | Redirect map, announcement, parallel structure during transition |
| **Ownership Gaps** | Medium | Medium | Clear assignment matrix, escalation path defined |
| **Scope Creep** | Medium | Low | Strict phase gating, focus on migration first |

---

## 8. Success Criteria

### 8.1 Quantitative Metrics

- ✅ 95+ files organized into 7 sections
- ✅ Zero broken internal links
- ✅ 15+ duplicate files consolidated
- ✅ 100% Diataxis compliance
- ✅ File count reduced to ~80 files

### 8.2 Qualitative Outcomes

- ✅ Clear ownership per section
- ✅ Intuitive navigation structure
- ✅ Consistent cross-referencing
- ✅ Stakeholder approval
- ✅ Improved user/developer experience

---

## 9. Appendices

### 9.1 Search Optimization Keywords

| Section | Keywords |
|---------|----------|
| Tutorials | getting started, first time, introduction, walkthrough |
| How-To | how to, guide, step by step, instructions |
| Reference | api, specification, protocol, configuration |
| Explanation | architecture, design, concept, why |
| User | feature, use, help, guide |
| Developer | contribute, develop, implement, code |
| Operations | deploy, configure, monitor, audit |

### 9.2 Tools and Automation

| Tool | Purpose | Frequency |
|------|---------|-----------|
| link-checker | Validate all internal links | Weekly (CI) |
| screenshot-capture | Update UI screenshots | Per UI change |
| markdown-linter | Enforce consistent formatting | Per commit |
| spellchecker | Catch typos and errors | Per commit |

### 9.3 References

- [Diataxis Framework](https://diataxis.fr/)
- [SvelteKit Documentation](https://kit.svelte.dev/docs) (example of good IA)
- [Nostr Protocol NIPs](https://github.com/nostr-protocol/nips) (protocol reference model)

---

## 10. Approval & Sign-Off

| Role | Name | Approval Date | Signature |
|------|------|---------------|-----------|
| System Architect | [Pending] | | |
| Technical Writer | [Pending] | | |
| UX Lead | [Pending] | | |
| DevOps Lead | [Pending] | | |
| Developer Relations | [Pending] | | |

---

**Document Status:** ✅ Design Complete - Ready for Review
**Next Steps:** Stakeholder review → Approval → Phase 1 execution
**Questions/Feedback:** Submit to documentation working group

---

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-16 | Architecture Designer Agent | Initial specification |

