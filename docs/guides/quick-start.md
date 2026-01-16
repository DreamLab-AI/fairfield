---
title: "Progressive Security Onboarding: Implementation Quick Start Guide"
description: "**For:** Nostr chat app development team **Focus:** Build Phase 1 (MVP) in 2-3 weeks **Expected Outcome:** Users can chat within 30 seconds; security onboarding happens over their first week"
category: howto
tags: ['developer', 'guide', 'security', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Progressive Security Onboarding: Implementation Quick Start Guide

**For:** Nostr chat app development team
**Focus:** Build Phase 1 (MVP) in 2-3 weeks
**Expected Outcome:** Users can chat within 30 seconds; security onboarding happens over their first week

---

## Phase 1: MVP Deliverables (2 Weeks)

### Components to Build

```
1. SignupPathSelector
   - 3 radio button options
   - Icon + title + description layout
   - Leads to different flows

2. SecurityHint
   - Dismissible bottom sheet
   - Shows on day 1-3 (once)
   - "Learn how" + "Not now" buttons

3. BackupMethodSelector
   - 3 expandable options (password manager, cloud, manual)
   - Each shows steps
   - Single CTA per method

4. SecurityChecklist
   - Visual progress bar (3 items)
   - Checkbox-style items
   - Status labels (not started, in progress, complete)

5. HelpSection (FAQ)
   - Expandable Q&A pairs
   - No jargon, honest answers
   - Links to detailed help
```

### Feature Requirements

**MVP Signup:**
```
✓ Email/username entry
✓ Select account type (new, import key, password manager)
✓ Auto-generate key for new users
✓ Store key securely on device
- Cloud backup (done in Phase 2)
- Device lock (done in Phase 2)
```

**MVP Settings:**
```
✓ Show current key status
✓ Display backup status
✓ Simple "Backup" button that opens BackupMethodSelector
✓ Link to help/FAQ
- Recovery flow (done in Phase 2)
- Advanced options (done in Phase 3)
```

**MVP Messaging:**
```
✓ One contextual hint (backup reminder)
✓ FAQ with 5 key questions
✓ Success confirmation when backup done
- Complex warning states (done in Phase 2)
- Recovery instructions (done in Phase 2)
```

---

## Data Model: Backup & Security State

### User Security Profile Schema

```typescript
interface UserSecurityProfile {
  // Key management
  privateKeyStored: "device" | "external" | "none";
  keyGeneratedAt: number; // timestamp
  keyExportedAt?: number;

  // Backup status
  backupMethods: BackupMethod[];
  lastBackupAt?: number;
  lastBackupMethod?: "bitwarden" | "google-drive" | "icloud" | "manual";

  // Device security
  deviceLockEnabled: boolean;
  loginNotificationsEnabled: boolean;

  // User journey
  completedSetupSteps: Set<"backup" | "device-lock" | "login-notifications">;
  lastReminderAt?: number;
  reminderFrequency: "aggressive" | "moderate" | "gentle";

  // Onboarding state
  signupPath: "new_user" | "import_key" | "password_manager";
  signupCompletedAt: number;
  firstBackupAt?: number;

  // Privacy preferences
  dismissedHints: Set<string>; // "backup-hint-1", etc
}

interface BackupMethod {
  id: string;
  type: "bitwarden" | "1password" | "lastpass" | "google-drive" | "icloud" | "manual";
  confirmedAt: number;
  verified: boolean;
  backupCode?: string; // For cloud backups
}
```

### Storage Architecture

```
Device Storage:
├── /secure/private-key         [encrypted]
├── /secure/backup-password     [encrypted, if using local backup]
└── /state/security-profile     [plain JSON]

Server State (if applicable):
├── /user/{id}/backup-status    [shows "backed up" but no details]
└── /user/{id}/login-history    [no sensitive data]

Never Store:
✗ Raw private key in plaintext
✗ Backup passwords
✗ Recovery keys
✗ Seed phrases
```

---

## Phase 1 Component Implementation Outline

### 1. SignupPathSelector Component

**File Structure:**
```
src/components/
├── SignupPathSelector/
│   ├── index.tsx
│   ├── SignupPathSelector.tsx
│   ├── PathOption.tsx
│   ├── PathOption.module.css
│   └── types.ts
```

**Key Props:**
```typescript
interface SignupPathSelectorProps {
  onSelect: (path: "new_user" | "import_key" | "password_manager") => void;
  onCancel: () => void;
}
```

**Implementation Notes:**
- Use radio buttons (native or custom styled)
- Each option is a card-like container
- Icon (48px), title (bold), description (gray)
- Margin between options: 12px
- Padding inside option: 16px

**Example JSX:**
```jsx
<div className="path-selector">
  <h2>Choose how to get started</h2>

  <label className="path-option">
    <input
      type="radio"
      name="signup-path"
      value="new_user"
      onChange={() => onSelect("new_user")}
    />
    <span className="path-icon">👋</span>
    <div className="path-content">
      <h3>I'm new to Nostr</h3>
      <p>We'll generate a private key and store it safely on your device.</p>
    </div>
  </label>

  {/* More options... */}

  <button onClick={handleContinue}>Continue</button>
</div>
```

---

### 2. SecurityHint Component

**File Structure:**
```
src/components/
├── SecurityHint/
│   ├── index.tsx
│   ├── SecurityHint.tsx
│   └── SecurityHint.module.css
```

**Props:**
```typescript
interface SecurityHintProps {
  id: string;
  title: string;
  description: string;
  onLearnMore: () => void;
  onDismiss: () => void;
  show: boolean;
}
```

**Key Behaviors:**
```typescript
// Show hint after 24 hours + 1 message
useEffect(() => {
  if (userCreatedAt < 24h ago && messagesSent > 0 && !keyBackedUp) {
    setShowHint(true);
  }
}, [userAge, messageCount, backupStatus]);

// Dismiss handling
const handleDismiss = () => {
  // Store dismissal timestamp
  localStorage.setItem('hint-backup-dismissed', Date.now());
  // Show again in 3 days
  const nextShow = Date.now() + (3 * 24 * 60 * 60 * 1000);
  localStorage.setItem('hint-backup-next-show', nextShow);
  setShowHint(false);
};
```

**CSS Animation:**
```css
.hint-container {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  animation: slideUp 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

---

### 3. BackupMethodSelector Component

**File Structure:**
```
src/components/
├── BackupMethodSelector/
│   ├── index.tsx
│   ├── BackupMethodSelector.tsx
│   ├── BackupMethodCard.tsx
│   ├── BackupMethodCard.module.css
│   └── types.ts
```

**Props:**
```typescript
interface BackupMethodSelectorProps {
  selectedMethod?: string;
  onSelect: (method: string) => void;
  onSkip: () => void;
}

interface BackupMethod {
  id: string;
  icon: string;
  title: string;
  description: string;
  steps: BackupStep[];
  estimatedTime: string;
  provider?: string;
}

interface BackupStep {
  number: number;
  text: string;
}
```

**State Management:**
```typescript
const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
const [expandedMethods, setExpandedMethods] = useState<Set<string>>(new Set());

const toggleExpand = (methodId: string) => {
  const newExpanded = new Set(expandedMethods);

  // Close others (only one expanded)
  for (const id of newExpanded) {
    newExpanded.delete(id);
  }

  // Toggle this one
  if (newExpanded.has(methodId)) {
    newExpanded.delete(methodId);
  } else {
    newExpanded.add(methodId);
  }

  setExpandedMethods(newExpanded);
};
```

**Rendering:**
```jsx
<div className="backup-selector">
  {backupMethods.map(method => (
    <BackupMethodCard
      key={method.id}
      method={method}
      isExpanded={expandedMethods.has(method.id)}
      onToggle={() => toggleExpand(method.id)}
      onSelect={() => {
        setSelectedMethod(method.id);
        onSelect(method.id);
      }}
    />
  ))}

  <button onClick={onSkip} className="secondary">
    Skip for now
  </button>
</div>
```

---

### 4. SecurityChecklist Component

**File Structure:**
```
src/components/
├── SecurityChecklist/
│   ├── index.tsx
│   ├── SecurityChecklist.tsx
│   ├── ChecklistItem.tsx
│   ├── ChecklistItem.module.css
│   └── ProgressBar.tsx
```

**Props:**
```typescript
interface SecurityChecklistProps {
  items: ChecklistItem[];
  onItemClick: (itemId: string) => void;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: "not-started" | "in-progress" | "completed";
  timeline: "do-first" | "do-next" | "nice-to-have";
  completed: boolean;
}
```

**Calculate Progress:**
```typescript
const completedCount = items.filter(i => i.completed).length;
const totalCount = items.length;
const percentage = Math.round((completedCount / totalCount) * 100);

return (
  <div className="checklist">
    <ProgressBar
      completed={completedCount}
      total={totalCount}
      percentage={percentage}
    />

    {items.map(item => (
      <ChecklistItem
        key={item.id}
        item={item}
        onClick={() => onItemClick(item.id)}
      />
    ))}
  </div>
);
```

**Visual States:**
```css
.checklist-item {
  &.not-started {
    input[type="checkbox"] { /* unchecked */ }
    .title { color: gray; }
  }

  &.in-progress {
    input { /* indeterminate state */ }
    .title { color: blue; }
    animation: pulse 2s infinite;
  }

  &.completed {
    input { /* checked */ }
    .title { color: green; }
    opacity: 0.7;
  }
}
```

---

### 5. HelpSection (FAQ) Component

**File Structure:**
```
src/components/
├── HelpSection/
│   ├── index.tsx
│   ├── HelpSection.tsx
│   ├── FAQItem.tsx
│   ├── FAQItem.module.css
│   └── faq-data.ts
```

**FAQ Data Structure:**
```typescript
interface FAQItem {
  id: string;
  category: "general" | "backup" | "recovery" | "security";
  question: string;
  answer: string;
  learnMoreUrl?: string;
  relatedItems?: string[];
}

const faqs: FAQItem[] = [
  {
    id: "what-is-key",
    category: "general",
    question: "What is a private key?",
    answer: `Your private key is a secret cryptographic number that proves
             your identity on Nostr. It's like a master password but stronger.
             Anyone with it can pretend to be you and send messages as you.`,
    learnMoreUrl: "/docs/private-keys"
  },
  // More items...
];
```

**Component:**
```jsx
<div className="help-section">
  <h2>Security FAQ</h2>

  {faqs.map(faq => (
    <FAQItem
      key={faq.id}
      question={faq.question}
      answer={faq.answer}
      learnMoreUrl={faq.learnMoreUrl}
    />
  ))}
</div>
```

**FAQItem Implementation:**
```jsx
const [expanded, setExpanded] = useState(false);

return (
  <div className={`faq-item ${expanded ? 'expanded' : ''}`}>
    <button
      className="question"
      onClick={() => setExpanded(!expanded)}
    >
      <span>{question}</span>
      <span className="icon">{expanded ? '▲' : '▼'}</span>
    </button>

    {expanded && (
      <div className="answer">
        {answer}
        {learnMoreUrl && (
          <a href={learnMoreUrl} className="learn-more">
            Learn more →
          </a>
        )}
      </div>
    )}
  </div>
);
```

---

## Backup Flow Implementation: Bitwarden Example

### BackupFlowBitwarden Component

```typescript
interface BackupFlowBitwardenProps {
  privateKey: string;
  onComplete: (backupCode?: string) => void;
  onCancel: () => void;
}

type Step = "copy-key" | "confirm-saved" | "success";

function BackupFlowBitwarden({ privateKey, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>("copy-key");
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(privateKey);
    setCopied(true);

    // Show toast
    showToast("Key copied to clipboard");

    // Reset after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (!confirmed) return;

    // Save backup info to securityProfile
    updateSecurityProfile({
      backupMethods: [...(profile.backupMethods || []), {
        id: generateId(),
        type: "bitwarden",
        confirmedAt: Date.now(),
        verified: true
      }],
      lastBackupAt: Date.now(),
      lastBackupMethod: "bitwarden"
    });

    setStep("success");
  };

  switch (step) {
    case "copy-key":
      return (
        <BackupStepCopyKey
          privateKey={privateKey}
          copied={copied}
          onCopyKey={handleCopyKey}
          onNext={() => setStep("confirm-saved")}
          onBack={onCancel}
        />
      );

    case "confirm-saved":
      return (
        <BackupStepConfirm
          confirmed={confirmed}
          onConfirm={setConfirmed}
          onNext={handleConfirm}
          onBack={() => setStep("copy-key")}
        />
      );

    case "success":
      return (
        <BackupStepSuccess
          method="Bitwarden"
          onDone={() => onComplete()}
          onNext={() => /* offer device lock or other feature */}
        />
      );
  }
}
```

---

## Settings Panel: Basic Implementation

### SecuritySettings Component

```typescript
interface SecuritySettingsProps {
  profile: UserSecurityProfile;
  onUpdate: (updates: Partial<UserSecurityProfile>) => void;
}

function SecuritySettings({ profile, onUpdate }: Props) {
  const backupStatus = profile.backupMethods?.length > 0;
  const backupMethod = profile.lastBackupMethod;
  const lastBackupDate = profile.lastBackupAt ?
    new Date(profile.lastBackupAt).toLocaleDateString() :
    "Never";

  return (
    <div className="security-settings">
      <h2>Account Security</h2>

      <ChecklistSection>
        <ChecklistItem
          completed={backupStatus}
          title="Key Backup"
          description="Save your private key somewhere safe"
          status={backupStatus ? "completed" : "not-started"}
          actionLabel={backupStatus ? "Update backup" : "Set up backup"}
          onAction={() => openBackupFlow()}
        />

        <ChecklistItem
          completed={false}
          title="Device Lock"
          description="Require fingerprint to open app"
          status="not-started"
          actionLabel="Enable"
          onAction={() => openDeviceLockSetup()}
        />

        <ChecklistItem
          completed={false}
          title="Login Notifications"
          description="Get alerted if account accessed"
          status="not-started"
          actionLabel="Enable"
          onAction={() => enableLoginNotifications()}
        />
      </ChecklistSection>

      <InfoSection>
        {backupStatus && (
          <div className="backup-status">
            <span className="checkmark">✓</span>
            <div>
              <p>Backed up to {backupMethod}</p>
              <p className="date">Last updated: {lastBackupDate}</p>
            </div>
          </div>
        )}
      </InfoSection>
    </div>
  );
}
```

---

## State Management: Using Context API (Recommended for MVP)

### SecurityContext.tsx

```typescript
interface SecurityContextType {
  profile: UserSecurityProfile;
  updateProfile: (updates: Partial<UserSecurityProfile>) => Promise<void>;
  startBackupFlow: (method: string) => Promise<void>;
  completeBackup: (method: BackupMethod) => Promise<void>;
  recordHintDismissal: (hintId: string) => void;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserSecurityProfile>(null);
  const [loading, setLoading] = useState(true);

  // Load profile on mount
  useEffect(() => {
    loadSecurityProfile().then(p => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const updateProfile = async (updates: Partial<UserSecurityProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);

    // Persist to device storage
    await saveSecurityProfile(updated);

    // Sync to server (if applicable)
    await api.updateSecurityProfile(updated);
  };

  const completeBackup = async (method: BackupMethod) => {
    const backupMethods = [...(profile.backupMethods || []), method];

    await updateProfile({
      backupMethods,
      lastBackupAt: Date.now(),
      lastBackupMethod: method.type,
      completedSetupSteps: new Set([...profile.completedSetupSteps, "backup"])
    });
  };

  const recordHintDismissal = (hintId: string) => {
    updateProfile({
      dismissedHints: new Set([...profile.dismissedHints, hintId])
    });
  };

  if (loading) return <LoadingScreen />;

  return (
    <SecurityContext.Provider value={{ profile, updateProfile, completeBackup, recordHintDismissal }}>
      {children}
    </SecurityContext.Provider>
  );
}

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error("useSecurity must be used inside SecurityProvider");
  return context;
};
```

---

## Testing Checklist for MVP

### Unit Tests

```typescript
// backup.test.ts
describe("BackupMethodSelector", () => {
  test("renders 3 backup methods", () => {
    render(<BackupMethodSelector />);
    expect(screen.getAllByRole("button")).toHaveLength(3); // Bitwarden, Drive, Manual
  });

  test("only allows one method expanded at a time", () => {
    // Expand method 1
    // Expand method 2
    // Assert method 1 is now collapsed
  });

  test("calls onSelect when method is chosen", () => {
    const onSelect = jest.fn();
    render(<BackupMethodSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Bitwarden"));
    expect(onSelect).toHaveBeenCalledWith("bitwarden");
  });
});

// hint.test.ts
describe("SecurityHint", () => {
  test("shows after 24 hours + 1 message", async () => {
    const user = createTestUser({ createdAt: Date.now() - 24*60*60*1000 });
    render(<App user={user} />);

    // Send a message
    await sendTestMessage();

    expect(screen.getByText(/Back up your key/)).toBeVisible();
  });

  test("dismisses for 3 days when user clicks 'Not now'", () => {
    render(<SecurityHint />);

    fireEvent.click(screen.getByText("Not now"));
    expect(screen.queryByText(/Back up your key/)).not.toBeInTheDocument();

    // Fast forward 3 days
    jest.useFakeTimers();
    jest.advanceTimersByTime(3 * 24 * 60 * 60 * 1000);

    // Hint reappears
    expect(screen.getByText(/Back up your key/)).toBeVisible();
  });
});

// FAQ.test.ts
describe("FAQSection", () => {
  test("expands/collapses items", () => {
    render(<FAQSection />);

    const questions = screen.getAllByRole("button");
    fireEvent.click(questions[0]);

    expect(screen.getByText(/Your private key is/)).toBeVisible();

    fireEvent.click(questions[0]);
    expect(screen.queryByText(/Your private key is/)).not.toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// signup.integration.test.ts
describe("Signup Flow", () => {
  test("new user path: generate key -> hint appears -> backup option", async () => {
    // 1. Select "new user" path
    fireEvent.click(screen.getByText("I'm new to Nostr"));
    fireEvent.click(screen.getByText("Continue"));

    // 2. Enter email
    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123456");
    fireEvent.click(screen.getByText("Create account"));

    // 3. Key is generated
    expect(localStorage.getItem("private-key")).toBeDefined();

    // 4. User logs in and sends message
    await sendTestMessage();

    // 5. Hint appears
    await waitFor(() => {
      expect(screen.getByText(/Back up your key/)).toBeVisible();
    });

    // 6. User clicks "Learn how"
    fireEvent.click(screen.getByText("Learn how"));

    // 7. Backup flow opens
    expect(screen.getByText(/Back up to Bitwarden/)).toBeVisible();
  });
});

// backup-completion.integration.test.ts
describe("Backup Completion", () => {
  test("user completes backup -> checklist updates -> hint disappears", async () => {
    // 1. Open backup flow
    fireEvent.click(screen.getByText("Back up your key"));

    // 2. Complete backup
    fireEvent.click(screen.getByText("Copy key"));
    fireEvent.click(screen.getByText("I've saved it in Bitwarden"));

    // 3. Checklist updates
    await waitFor(() => {
      expect(screen.getByText(/Key Backup/).closest("div")).toHaveClass("completed");
    });

    // 4. Success screen shows
    expect(screen.getByText(/Key backed up!/)).toBeVisible();

    // 5. Hint doesn't reappear
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText(/Back up your key/)).not.toBeInTheDocument();
  });
});
```

---

## Phase 1 Timeline

```
Week 1:
├─ Day 1-2: Build components (Signup, Hint, Backup selector, Checklist, FAQ)
├─ Day 2-3: Implement security context + state management
├─ Day 3-4: Add hint timing logic + dismissal
└─ Day 4-5: Unit testing + component refinement

Week 2:
├─ Day 1-2: Build backup flows (Bitwarden, Google Drive mockups)
├─ Day 2-3: Settings panel integration
├─ Day 3-4: E2E testing signup -> backup -> checklist update
└─ Day 4-5: Polish animations, responsive behavior, accessibility

Deliverables:
✓ Users can sign up in 30 seconds
✓ Hint appears by day 1-3
✓ Backup methods are discoverable
✓ Checklist tracks progress
✓ FAQ answers key questions
✓ No scary language anywhere
```

---

## Success Metrics (Track These in Phase 1)

```
1. Signup Completion Rate
   Target: 80% of users complete signup
   Measurement: Signups started / completed

2. Backup Discovery Rate
   Target: 40% of users open backup flow within week 1
   Measurement: Users who click "Learn how" on hint

3. Backup Completion Rate
   Target: 20% of users back up key by end of week 1
   Measurement: Users with backupMethods.length > 0

4. Hint Engagement
   Target: 60% of users don't dismiss "Not now"
   Measurement: (Learn clicks) / (Learn clicks + Not now clicks)

5. FAQ Usage
   Target: 30% of users read ≥1 FAQ item
   Measurement: FAQ section views / new users

6. First Week Retention
   Target: 50% of users return on day 2
   Measurement: DAU / new users
   (Security friction can hurt retention - track closely)
```

---

## Common Pitfalls to Avoid

```
❌ DON'T show too many hints/notifications
   Instead: Single hint per week, max

❌ DON'T force security setup on signup
   Instead: Let users chat first, suggest after engagement

❌ DON'T use scary language
   Instead: Honest but friendly ("Back up your key")

❌ DON'T make backup flows too complex
   Instead: Each method should be 2-3 clear steps

❌ DON'T forget to save backup status
   Instead: Persist to storage, update checklist immediately

❌ DON'T show success screens that disappear
   Instead: Keep success visible until user dismisses

❌ DON'T implement NIP-46 in MVP
   Instead: Keep it simple: generate key locally, suggest backup

❌ DON'T assume users understand "private key"
   Instead: Explain in simple terms ("your secret ID")
```

---

## Next Steps (Phase 2 & Beyond)

### Phase 2 (Week 3-4)
- [ ] Backup flows with real integrations (Bitwarden API, Google Drive)
- [ ] Device lock setup (biometric + PIN)
- [ ] Login notifications
- [ ] Account recovery flow
- [ ] Error handling & edge cases

### Phase 3 (Week 5+)
- [ ] Advanced settings (remote signing, key export)
- [ ] Activity log (login history)
- [ ] Key rotation guide
- [ ] Progressive backup reminders (smarter timing)

### Phase 4+ (Month 2+)
- [ ] NIP-46 integration (remote signing)
- [ ] Multi-device sync
- [ ] Analytics on user security choices
- [ ] Personalized security recommendations

---

## File Structure (Reference)

```
src/
├── components/
│   ├── SignupPathSelector/
│   ├── SecurityHint/
│   ├── BackupMethodSelector/
│   ├── BackupFlowBitwarden/
│   ├── BackupFlowGoogleDrive/
│   ├── SecurityChecklist/
│   ├── HelpSection/
│   └── SecuritySettings/
│
├── contexts/
│   └── SecurityContext.tsx
│
├── hooks/
│   ├── useSecurity.ts
│   ├── useBackupHint.ts
│   └── useSecurityChecklist.ts
│
├── utils/
│   ├── crypto.ts (key generation, encryption)
│   ├── storage.ts (device storage operations)
│   └── timing.ts (hint timing logic)
│
├── types/
│   └── security.ts (UserSecurityProfile, etc)
│
├── data/
│   └── faq.ts (FAQ questions/answers)
│
└── pages/
    ├── Signup.tsx
    ├── Settings.tsx
    └── Help.tsx
```

---

## Quick Reference: Key Decision Points

| Decision | MVP Choice | Why |
|----------|-----------|-----|
| **Key Generation** | Local on device | Simple, avoids cloud key storage |
| **First Backup Prompt** | Day 1-3 hint | Low pressure, contextual |
| **Backup Methods** | Password manager, manual copy | Simple to implement, no APIs needed yet |
| **Recovery** | Deferred to Phase 2 | Complex, not critical for initial launch |
| **Device Lock** | Deferred to Phase 2 | Nice-to-have, not essential for signup |
| **Messaging** | Friendly, honest | Build trust, avoid alert fatigue |
| **Checklist** | 3 items, all optional | Progressive, gamified |
| **FAQ** | 5 Q&A pairs | Answers real questions, no jargon |

---

**Document Version:** 1.0
**Last Updated:** January 9, 2026
**Status:** Ready for Implementation

