---
title: "Authentication Components - Structure & Specifications"
description: "This document outlines the component hierarchy, props, state management, and implementation details for the Nostr chat signup and login flows."
category: tutorial
tags: ['authentication', 'developer', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Authentication Components - Structure & Specifications

This document outlines the component hierarchy, props, state management, and implementation details for the Nostr chat signup and login flows.

---

## Component Hierarchy

```
App
├── AuthLayout
│   ├── SignupPathSelector
│   │   ├── PathCard
│   │   └── SignupLink
│   ├── SignupQuick
│   │   ├── QuickSignupNickname
│   │   │   ├── TextInput
│   │   │   ├── ValidationMessage
│   │   │   └── Button
│   │   ├── QuickSignupSuccess
│   │   │   ├── WarningBox
│   │   │   ├── PasswordDisplay
│   │   │   │   ├── CopyButton
│   │   │   │   └── PasswordField
│   │   │   ├── NicknameDisplay
│   │   │   ├── Checkbox
│   │   │   └── Button
│   │   └── RecoveryPhraseModal
│   ├── LoginTabs
│   │   ├── TabNavigation
│   │   ├── LoginSimple
│   │   │   ├── PasswordInput
│   │   │   ├── ValidationMessage
│   │   │   ├── InfoBox
│   │   │   ├── Button
│   │   │   └── Links
│   │   ├── LoginRecoveryPhrase
│   │   │   ├── TextAreaInput
│   │   │   ├── WordValidation
│   │   │   ├── SuggestionList
│   │   │   ├── Button
│   │   │   └── Links
│   │   └── LoginExtension
│   │       ├── InfoBox
│   │       ├── ExtensionButton
│   │       ├── AutoDetect
│   │       └── FallbackLinks
│   └── SecurityUpgradePrompt
│       ├── Option
│       ├── Button
│       └── DismissButton
└── ChatHome
```

---

## Core Components

### 1. AuthLayout

**Path**: `src/components/auth/AuthLayout.tsx`

**Purpose**: Wrapper for all auth screens with consistent styling

```typescript
interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  maxWidth?: number; // default 600px
  showBackButton?: boolean;
  onBack?: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  maxWidth = 600,
  showBackButton,
  onBack,
}) => {
  return (
    <div className="auth-layout">
      <div className="auth-container" style={{ maxWidth }}>
        {showBackButton && <BackButton onClick={onBack} />}
        {title && <h1>{title}</h1>}
        {subtitle && <p className="subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
};
```

**Styling**:
- Full screen background
- Centered content card
- Responsive width (90% mobile, 600px desktop max)
- Consistent padding and spacing

---

### 2. SignupPathSelector

**Path**: `src/components/auth/SignupPathSelector.tsx`

**Purpose**: Choose between Quick Start and Secure Setup paths

```typescript
interface SignupPathSelectorProps {
  onSelectPath: (path: 'quick' | 'secure') => void;
  isLoading?: boolean;
  onNavigateToLogin?: () => void;
}

export const SignupPathSelector: React.FC<SignupPathSelectorProps> = ({
  onSelectPath,
  isLoading,
  onNavigateToLogin,
}) => {
  return (
    <AuthLayout title="Create Your Nostr Chat Account">
      <div className="path-cards">
        <PathCard
          title="🚀 QUICK START (Recommended)"
          features={[
            'Get started in 30 seconds',
            'One-click setup',
            'Auto-generated password',
            'Perfect for casual users',
          ]}
          onClick={() => onSelectPath('quick')}
          isLoading={isLoading}
          variant="primary"
        />

        <PathCard
          title="🔐 SECURE SETUP"
          features={[
            'For security-conscious users',
            '12-word recovery phrase',
            'Full control & backup',
            'Recommended for power users',
          ]}
          onClick={() => onSelectPath('secure')}
          isLoading={isLoading}
        />
      </div>

      <div className="path-footer">
        Already have an account?{' '}
        <TextLink onClick={onNavigateToLogin}>Login</TextLink>
      </div>
    </AuthLayout>
  );
};

interface PathCardProps {
  title: string;
  features: string[];
  onClick: () => void;
  isLoading?: boolean;
  variant?: 'primary' | 'secondary';
}

const PathCard: React.FC<PathCardProps> = ({
  title,
  features,
  onClick,
  isLoading,
  variant = 'secondary',
}) => (
  <div className={`path-card path-card--${variant}`}>
    <h3>{title}</h3>
    <ul className="features">
      {features.map((feature, i) => (
        <li key={i}>• {feature}</li>
      ))}
    </ul>
    <Button
      onClick={onClick}
      disabled={isLoading}
      loading={isLoading}
      variant={variant === 'primary' ? 'primary' : 'secondary'}
    >
      Choose {title.split(' ')[0]}
    </Button>
  </div>
);
```

---

### 3. QuickSignupNickname

**Path**: `src/components/auth/QuickSignupNickname.tsx`

**Purpose**: Collect nickname for quick signup path

```typescript
interface QuickSignupNicknameProps {
  onSubmit: (nickname: string) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
  initialNickname?: string;
}

interface FormState {
  nickname: string;
  error: string | null;
  isValidating: boolean;
}

export const QuickSignupNickname: React.FC<QuickSignupNicknameProps> = ({
  onSubmit,
  onBack,
  isLoading,
  initialNickname = '',
}) => {
  const [formState, setFormState] = React.useState<FormState>({
    nickname: initialNickname,
    error: null,
    isValidating: false,
  });

  const handleChange = async (value: string) => {
    setFormState({
      nickname: value,
      error: null,
      isValidating: true,
    });

    // Validate in real-time
    const validation = validateNickname(value);
    if (!validation.isValid) {
      setFormState((prev) => ({
        ...prev,
        error: validation.error,
        isValidating: false,
      }));
      return;
    }

    // Check availability
    try {
      const isAvailable = await checkNicknameAvailability(value);
      if (!isAvailable) {
        setFormState((prev) => ({
          ...prev,
          error: 'This nickname is already taken',
          isValidating: false,
        }));
      } else {
        setFormState((prev) => ({
          ...prev,
          isValidating: false,
        }));
      }
    } catch (err) {
      // Network error - allow user to proceed
      setFormState((prev) => ({
        ...prev,
        isValidating: false,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(formState.nickname);
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        error: 'Failed to create account',
      }));
    }
  };

  const isValid = formState.error === null && formState.nickname.length >= 2;

  return (
    <AuthLayout
      title="Create Your Account"
      showBackButton
      onBack={onBack}
    >
      <form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="nickname">What's your nickname?</Label>
          <HelperText>(This is how others will see you)</HelperText>

          <TextInput
            id="nickname"
            value={formState.nickname}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="alex_smith"
            disabled={isLoading}
            error={!!formState.error}
            autoFocus
          />

          <HelperText>
            2-50 characters, letters/numbers/underscore
          </HelperText>

          {formState.error && (
            <ValidationMessage type="error">
              {formState.error}
            </ValidationMessage>
          )}

          {!formState.error && formState.nickname.length > 0 && (
            <ValidationMessage type="success">
              Nickname available ✓
            </ValidationMessage>
          )}

          <HelperText>
            ⓘ Your nickname can be changed later in settings
          </HelperText>
        </FormGroup>

        <Button
          type="submit"
          disabled={!isValid || isLoading}
          loading={isLoading}
          fullWidth
        >
          Create Account
        </Button>
      </form>
    </AuthLayout>
  );
};
```

---

### 4. QuickSignupSuccess

**Path**: `src/components/auth/QuickSignupSuccess.tsx`

**Purpose**: Display password and confirmation for signup completion

```typescript
interface QuickSignupSuccessProps {
  nickname: string;
  hexPrivkey: string;
  publicKey: string;
  onContinue: () => Promise<void>;
  onGenerateRecoveryPhrase?: () => void;
  isLoading?: boolean;
}

interface SuccessFormState {
  isSaved: boolean;
  copied: boolean;
  showRecoveryPhrase: boolean;
}

export const QuickSignupSuccess: React.FC<QuickSignupSuccessProps> = ({
  nickname,
  hexPrivkey,
  publicKey,
  onContinue,
  onGenerateRecoveryPhrase,
  isLoading,
}) => {
  const [formState, setFormState] = React.useState<SuccessFormState>({
    isSaved: false,
    copied: false,
    showRecoveryPhrase: false,
  });

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(hexPrivkey);
      setFormState((prev) => ({ ...prev, copied: true }));
      setTimeout(() => {
        setFormState((prev) => ({ ...prev, copied: false }));
      }, 2000);
    } catch (err) {
      // Fallback copy method
      const input = document.createElement('input');
      input.value = hexPrivkey;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setFormState((prev) => ({ ...prev, copied: true }));
    }
  };

  const handleContinue = async () => {
    await onContinue();
  };

  return (
    <AuthLayout title="Account Created! 🎉">
      <WarningBox
        title="⚠️  SAVE YOUR PASSWORD"
        description="This is your private login password. We can't recover it if you lose it. Save it somewhere safe (password manager, paper, secure note, etc.)"
      />

      <FormGroup>
        <Label>Your Password:</Label>
        <HelperText>
          Your unique login password (save in password manager)
        </HelperText>

        <PasswordDisplay
          password={hexPrivkey}
          onCopy={handleCopyPassword}
          copied={formState.copied}
        />
      </FormGroup>

      <FormGroup>
        <Label>Your Nickname:</Label>
        <div className="nickname-display">
          <span className="nickname-value">{nickname}</span>
          <HelperText>(Can change anytime)</HelperText>
        </div>
      </FormGroup>

      <Checkbox
        id="saved-password"
        checked={formState.isSaved}
        onChange={(checked) =>
          setFormState((prev) => ({ ...prev, isSaved: checked }))
        }
        label="I have saved my password in a safe place"
      />

      <Button
        onClick={handleContinue}
        disabled={!formState.isSaved || isLoading}
        loading={isLoading}
        fullWidth
        variant="primary"
      >
        Start Chatting
      </Button>

      {onGenerateRecoveryPhrase && (
        <TextLink onClick={onGenerateRecoveryPhrase}>
          Want more security options? View Recovery Phrase
        </TextLink>
      )}
    </AuthLayout>
  );
};
```

---

### 5. LoginTabs

**Path**: `src/components/auth/LoginTabs.tsx`

**Purpose**: Unified login interface with three methods

```typescript
type LoginTab = 'simple' | 'recovery' | 'extension';

interface LoginTabsProps {
  activeTab?: LoginTab;
  onTabChange?: (tab: LoginTab) => void;
  isLoading?: boolean;
  error?: string;
}

export const LoginTabs: React.FC<LoginTabsProps> = ({
  activeTab = 'simple',
  onTabChange,
  isLoading,
  error,
}) => {
  const [currentTab, setCurrentTab] = React.useState<LoginTab>(activeTab);

  const handleTabChange = (tab: LoginTab) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  return (
    <AuthLayout title="Login to Your Chat">
      <TabNavigation
        tabs={[
          { id: 'simple', label: 'Simple Login' },
          { id: 'recovery', label: 'Recovery Phrase' },
          { id: 'extension', label: 'Browser Extension' },
        ]}
        activeTab={currentTab}
        onChange={handleTabChange}
      />

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {currentTab === 'simple' && (
        <LoginSimple
          onSubmit={handleSimpleLogin}
          isLoading={isLoading}
          error={error}
        />
      )}

      {currentTab === 'recovery' && (
        <LoginRecoveryPhrase
          onSubmit={handleRecoveryLogin}
          isLoading={isLoading}
          error={error}
        />
      )}

      {currentTab === 'extension' && (
        <LoginExtension
          onConnect={handleExtensionLogin}
          isLoading={isLoading}
          error={error}
        />
      )}

      <div className="login-footer">
        <TextLink onClick={onNavigateToSignup}>Create Account</TextLink>
        {currentTab === 'simple' && (
          <TextLink onClick={() => handleTabChange('recovery')}>
            Forgot password? Recover Account
          </TextLink>
        )}
      </div>
    </AuthLayout>
  );
};
```

---

### 6. LoginSimple

**Path**: `src/components/auth/LoginSimple.tsx`

**Purpose**: Login with hex private key password

```typescript
interface LoginSimpleProps {
  onSubmit: (privkey: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onNavigateToSignup?: () => void;
  onNavigateToRecover?: () => void;
}

interface LoginFormState {
  privkey: string;
  showPassword: boolean;
  validationError?: string;
}

export const LoginSimple: React.FC<LoginSimpleProps> = ({
  onSubmit,
  isLoading,
  error,
  onNavigateToSignup,
  onNavigateToRecover,
}) => {
  const [formState, setFormState] = React.useState<LoginFormState>({
    privkey: '',
    showPassword: false,
    validationError: undefined,
  });

  const handlePrivkeyChange = (value: string) => {
    const cleaned = value.trim().toLowerCase();

    // Real-time validation
    const validation = validatePrivkey(cleaned);

    setFormState({
      privkey: cleaned,
      showPassword: formState.showPassword,
      validationError: validation.isValid ? undefined : validation.error,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePrivkey(formState.privkey);
    if (!validation.isValid) {
      setFormState((prev) => ({
        ...prev,
        validationError: validation.error,
      }));
      return;
    }

    try {
      await onSubmit(formState.privkey);
    } catch (err) {
      // Error handled by parent
    }
  };

  const isValid =
    formState.privkey.length === 64 &&
    /^[0-9a-f]{64}$/.test(formState.privkey) &&
    !formState.validationError;

  return (
    <form onSubmit={handleSubmit}>
      <FormGroup>
        <Label htmlFor="privkey">Enter your password to login</Label>

        <PasswordInput
          id="privkey"
          value={formState.privkey}
          onChange={(e) => handlePrivkeyChange(e.target.value)}
          placeholder="Your 64-character password"
          showPassword={formState.showPassword}
          onToggleShow={() =>
            setFormState((prev) => ({
              ...prev,
              showPassword: !prev.showPassword,
            }))
          }
          disabled={isLoading}
          error={!!formState.validationError}
          autoFocus
        />

        <HelperText>
          This is your account password from signup
        </HelperText>

        <HelperText>64 character hex string</HelperText>

        {formState.validationError && (
          <ValidationMessage type="error">
            {formState.validationError}
          </ValidationMessage>
        )}

        {!formState.validationError && formState.privkey.length > 0 && (
          <ValidationMessage type="success">
            Valid password format ✓
          </ValidationMessage>
        )}
      </FormGroup>

      <InfoBox
        icon="ℹ️"
        title="SECURITY TIP"
        description="For better security, consider using a browser extension (Alby, nos2x) instead"
      />

      <Button
        type="submit"
        disabled={!isValid || isLoading}
        loading={isLoading}
        fullWidth
        variant="primary"
      >
        Login
      </Button>

      <div className="login-links">
        <TextLink onClick={onNavigateToSignup}>Create Account</TextLink>
        <TextLink onClick={onNavigateToRecover}>Recover Account</TextLink>
      </div>
    </form>
  );
};
```

---

### 7. LoginRecoveryPhrase

**Path**: `src/components/auth/LoginRecoveryPhrase.tsx`

**Purpose**: Login with 12-word recovery phrase

```typescript
interface LoginRecoveryPhraseProps {
  onSubmit: (mnemonic: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onNavigateToSignup?: () => void;
}

interface RecoveryFormState {
  mnemonic: string;
  words: string[];
  invalidWords: string[];
  suggestions: Record<string, string[]>;
}

export const LoginRecoveryPhrase: React.FC<LoginRecoveryPhraseProps> = ({
  onSubmit,
  isLoading,
  error,
  onNavigateToSignup,
}) => {
  const [formState, setFormState] = React.useState<RecoveryFormState>({
    mnemonic: '',
    words: [],
    invalidWords: [],
    suggestions: {},
  });

  const handleMnemonicChange = (value: string) => {
    const words = value
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const result = validateMnemonic(words);

    setFormState({
      mnemonic: value,
      words,
      invalidWords: result.invalidWords,
      suggestions: result.suggestions,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateMnemonic(formState.words);
    if (!validation.isValid) {
      return;
    }

    try {
      await onSubmit(formState.mnemonic);
    } catch (err) {
      // Error handled by parent
    }
  };

  const isValid =
    formState.words.length === 12 && formState.invalidWords.length === 0;

  return (
    <form onSubmit={handleSubmit}>
      <FormGroup>
        <Label htmlFor="mnemonic">
          Enter your 12-word recovery phrase
        </Label>

        <TextAreaInput
          id="mnemonic"
          value={formState.mnemonic}
          onChange={(e) => handleMnemonicChange(e.target.value)}
          placeholder="one two three four five six seven eight nine ten eleven twelve"
          disabled={isLoading}
          rows={4}
          autoFocus
        />

        <HelperText>12 words separated by spaces</HelperText>

        {formState.words.length > 0 && (
          <WordValidationDisplay
            words={formState.words}
            invalidWords={formState.invalidWords}
            suggestions={formState.suggestions}
          />
        )}
      </FormGroup>

      <Button
        type="submit"
        disabled={!isValid || isLoading}
        loading={isLoading}
        fullWidth
        variant="primary"
      >
        Recover Account
      </Button>

      <div className="recovery-links">
        <TextLink onClick={onNavigateToSignup}>
          Lost your phrase? Create New Account
        </TextLink>
      </div>
    </form>
  );
};

interface WordValidationDisplayProps {
  words: string[];
  invalidWords: string[];
  suggestions: Record<string, string[]>;
}

const WordValidationDisplay: React.FC<WordValidationDisplayProps> = ({
  words,
  invalidWords,
  suggestions,
}) => (
  <div className="word-validation">
    <div className="word-grid">
      {words.map((word, index) => (
        <WordChip
          key={index}
          number={index + 1}
          word={word}
          isValid={!invalidWords.includes(word)}
        />
      ))}
    </div>

    {invalidWords.length > 0 && (
      <div className="invalid-words">
        {invalidWords.map((word) => (
          <div key={word} className="invalid-word">
            <span className="error">⚠️ "{word}" is not valid</span>
            {suggestions[word] && (
              <div className="suggestions">
                Did you mean:{' '}
                {suggestions[word].map((s) => (
                  <span key={s} className="suggestion">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    <div className="word-count">
      {words.length < 12 ? (
        <span className="warning">
          Expected 12 words, got {words.length}
        </span>
      ) : (
        <span className="success">Valid recovery phrase ✓</span>
      )}
    </div>
  </div>
);

interface WordChipProps {
  number: number;
  word: string;
  isValid: boolean;
}

const WordChip: React.FC<WordChipProps> = ({ number, word, isValid }) => (
  <div className={`word-chip ${isValid ? 'valid' : 'invalid'}`}>
    <span className="number">{number}</span>
    <span className="word">{word}</span>
    <span className="status">{isValid ? '✓' : '✗'}</span>
  </div>
);
```

---

### 8. LoginExtension

**Path**: `src/components/auth/LoginExtension.tsx`

**Purpose**: Login with NIP-07 browser extension

```typescript
interface LoginExtensionProps {
  onConnect: (pubkey: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  detectedExtensions?: ExtensionType[];
  onNavigateToSimple?: () => void;
}

type ExtensionType = 'alby' | 'nos2x' | 'unknown';

interface ExtensionState {
  isConnecting: boolean;
  connectedExtension?: ExtensionType;
  pubkey?: string;
  detectedExtensions: ExtensionType[];
}

export const LoginExtension: React.FC<LoginExtensionProps> = ({
  onConnect,
  isLoading,
  error,
  detectedExtensions: initialDetected,
  onNavigateToSimple,
}) => {
  const [extensionState, setExtensionState] = React.useState<ExtensionState>({
    isConnecting: false,
    detectedExtensions: initialDetected || [],
  });

  React.useEffect(() => {
    // Detect available extensions on mount
    detectExtensions().then((detected) => {
      setExtensionState((prev) => ({
        ...prev,
        detectedExtensions: detected,
      }));
    });
  }, []);

  const handleExtensionConnect = async (ext: ExtensionType) => {
    setExtensionState((prev) => ({
      ...prev,
      isConnecting: true,
    }));

    try {
      const pubkey = await connectToExtension(ext);
      setExtensionState((prev) => ({
        ...prev,
        connectedExtension: ext,
        pubkey,
      }));
      await onConnect(pubkey);
    } catch (err) {
      // Error handled by parent
      setExtensionState((prev) => ({
        ...prev,
        isConnecting: false,
      }));
    }
  };

  return (
    <div>
      <InfoBox
        icon="ℹ️"
        title="MOST SECURE OPTION"
        description="Your keys never leave your device. Extensions like Alby manage your keys locally, and this app only requests permission to sign messages."
      />

      <div className="extension-buttons">
        <ExtensionButton
          name="alby"
          icon="🦊"
          label="Connect with Alby"
          onClick={() => handleExtensionConnect('alby')}
          disabled={isLoading || extensionState.isConnecting}
          loading={
            isLoading || extensionState.connectedExtension === 'alby'
          }
          isDetected={extensionState.detectedExtensions.includes('alby')}
        />

        <ExtensionButton
          name="nos2x"
          icon="🔐"
          label="Connect with nos2x"
          onClick={() => handleExtensionConnect('nos2x')}
          disabled={isLoading || extensionState.isConnecting}
          loading={
            isLoading || extensionState.connectedExtension === 'nos2x'
          }
          isDetected={extensionState.detectedExtensions.includes('nos2x')}
        />
      </div>

      {extensionState.detectedExtensions.length === 0 && (
        <NoExtensionBox
          onGetAlby={() => openAlbyDownload()}
          onLearnMore={() => openExtensionDocs()}
          onUsePassword={onNavigateToSimple}
        />
      )}
    </div>
  );
};

interface ExtensionButtonProps {
  name: string;
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  isDetected?: boolean;
}

const ExtensionButton: React.FC<ExtensionButtonProps> = ({
  icon,
  label,
  onClick,
  disabled,
  loading,
  isDetected,
}) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    loading={loading}
    fullWidth
    variant={isDetected ? 'primary' : 'secondary'}
    icon={icon}
  >
    {label}
    {isDetected && <span className="badge">Detected</span>}
  </Button>
);

interface NoExtensionBoxProps {
  onGetAlby: () => void;
  onLearnMore: () => void;
  onUsePassword: () => void;
}

const NoExtensionBox: React.FC<NoExtensionBoxProps> = ({
  onGetAlby,
  onLearnMore,
  onUsePassword,
}) => (
  <div className="no-extension-box">
    <h4>📦 Don't have an extension?</h4>
    <p>Install Alby for the most secure way to login</p>
    <div className="extension-links">
      <Button onClick={onGetAlby} variant="secondary">
        Get Alby
      </Button>
      <TextLink onClick={onLearnMore}>Learn More</TextLink>
      <TextLink onClick={onUsePassword}>Use Password Instead</TextLink>
    </div>
  </div>
);
```

---

### 9. SecurityUpgradePrompt

**Path**: `src/components/auth/SecurityUpgradePrompt.tsx`

**Purpose**: Progressive security upgrade offer after multiple logins

```typescript
interface SecurityUpgradePromptProps {
  loginCount: number;
  onCreateRecoveryPhrase: () => void;
  onInstallExtension: () => void;
  onDismiss: () => void;
  isShowing: boolean;
}

export const SecurityUpgradePrompt: React.FC<SecurityUpgradePromptProps> = ({
  loginCount,
  onCreateRecoveryPhrase,
  onInstallExtension,
  onDismiss,
  isShowing,
}) => {
  if (!isShowing) return null;

  return (
    <Modal backdrop onClose={onDismiss}>
      <div className="security-upgrade-modal">
        <h2>Upgrade Your Account Security</h2>

        <p>
          You've logged in {loginCount} times using your password. Let's
          secure your account with additional options.
        </p>

        <div className="upgrade-options">
          <UpgradeOption
            icon="✓"
            title="Create Recovery Phrase"
            description="Backup your account with a 12-word phrase you can use to recover your account anytime."
            onClick={onCreateRecoveryPhrase}
          />

          <UpgradeOption
            icon="✓"
            title="Install Browser Extension"
            description="Use Alby or nos2x for the most secure login. Your keys stay safe on your device."
            onClick={onInstallExtension}
          />
        </div>

        <Button onClick={onDismiss} variant="secondary" fullWidth>
          Maybe Later
        </Button>
      </div>
    </Modal>
  );
};

interface UpgradeOptionProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

const UpgradeOption: React.FC<UpgradeOptionProps> = ({
  icon,
  title,
  description,
  onClick,
}) => (
  <div className="upgrade-option">
    <div className="option-header">
      <span className="icon">{icon}</span>
      <h4>{title}</h4>
    </div>
    <p>{description}</p>
    <Button onClick={onClick} variant="primary" fullWidth>
      {title.split(' ')[0]}
    </Button>
  </div>
);
```

---

## Shared UI Components

### PasswordDisplay

**Path**: `src/components/common/PasswordDisplay.tsx`

```typescript
interface PasswordDisplayProps {
  password: string;
  onCopy: () => void;
  copied: boolean;
  showFull?: boolean;
}

export const PasswordDisplay: React.FC<PasswordDisplayProps> = ({
  password,
  onCopy,
  copied,
  showFull = false,
}) => {
  const displayPassword = showFull
    ? password
    : `${password.slice(0, 8)}...${password.slice(-8)}`;

  return (
    <div className="password-display">
      <code className="password-value">{displayPassword}</code>
      <button
        onClick={onCopy}
        className="copy-button"
        type="button"
        title="Copy password"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};
```

### WarningBox

**Path**: `src/components/common/WarningBox.tsx`

```typescript
interface WarningBoxProps {
  title: string;
  description: string;
  icon?: string;
  type?: 'warning' | 'info' | 'error';
}

export const WarningBox: React.FC<WarningBoxProps> = ({
  title,
  description,
  icon = '⚠️',
  type = 'warning',
}) => (
  <div className={`warning-box warning-box--${type}`}>
    <div className="warning-header">
      <span className="icon">{icon}</span>
      <h3>{title}</h3>
    </div>
    <p>{description}</p>
  </div>
);
```

### InfoBox

**Path**: `src/components/common/InfoBox.tsx`

```typescript
interface InfoBoxProps {
  title: string;
  description: string;
  icon?: string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({
  title,
  description,
  icon = 'ℹ️',
}) => (
  <div className="info-box">
    <div className="info-header">
      <span className="icon">{icon}</span>
      <h4>{title}</h4>
    </div>
    <p>{description}</p>
  </div>
);
```

### ValidationMessage

**Path**: `src/components/common/ValidationMessage.tsx`

```typescript
interface ValidationMessageProps {
  children: React.ReactNode;
  type: 'error' | 'warning' | 'success';
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({
  children,
  type,
}) => (
  <div className={`validation-message validation-message--${type}`}>
    {type === 'error' && '❌ '}
    {type === 'warning' && '⚠️ '}
    {type === 'success' && '✓ '}
    {children}
  </div>
);
```

---

## State Management Strategy

### Local Component State
- Form inputs and validation
- UI states (loading, showing/hiding)
- Tab selection

### Session State
- Authenticated user data
- Login method used
- Session token/ID
- Expiry time

### Storage
- localStorage: Encrypted session (if available)
- IndexedDB: (optional) Secure key storage

### Context
- AuthContext: Provides auth state to entire app

```typescript
interface AuthContextType {
  state: AuthState;
  login: (method: LoginMethod, credentials: any) => Promise<void>;
  signup: (nickname: string) => Promise<SignupResult>;
  logout: () => void;
  updateSecurityMetrics: (metrics: Partial<SecurityMetrics>) => void;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(
  undefined
);
```

---

## Summary

This component structure provides:

1. **Clear separation of concerns** - Each component handles one screen/feature
2. **Type safety** - Full TypeScript coverage
3. **Reusability** - Shared components for common patterns
4. **Testability** - Small, focused components with clear props
5. **Accessibility** - ARIA labels, semantic HTML
6. **Progressive enhancement** - Works without JavaScript (form-based)

Implementation should follow these components exactly as specified, with proper error handling, loading states, and accessibility features.
