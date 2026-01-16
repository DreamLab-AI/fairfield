---
title: "Configuration Reference"
description: "All configuration options for the platform."
category: reference
tags: ['developer', 'reference', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Configuration Reference

All configuration options for the platform.

---

## Environment Variables

### Required Variables

| Variable | Type | Description |
|----------|------|-------------|
| `PUBLIC_RELAY_URL` | `string` | WebSocket URL for the Nostr relay |
| `PUBLIC_APP_URL` | `string` | Public URL of the application |

### Optional Variables

#### Application Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_APP_NAME` | `string` | `"Nostr BBS"` | Display name in UI and PWA |
| `PUBLIC_APP_DESCRIPTION` | `string` | `""` | App description for meta tags |
| `PUBLIC_DEFAULT_THEME` | `string` | `"dark"` | Default colour theme (`dark` / `light`) |
| `PUBLIC_DEBUG` | `boolean` | `false` | Enable debug logging |

#### Relay Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_RELAY_TIMEOUT` | `number` | `5000` | Connection timeout in ms |
| `PUBLIC_RELAY_RECONNECT` | `boolean` | `true` | Auto-reconnect on disconnect |
| `PUBLIC_RELAY_MAX_RETRIES` | `number` | `5` | Max reconnection attempts |

#### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_ENABLE_DMS` | `boolean` | `true` | Enable direct messages |
| `PUBLIC_ENABLE_CALENDAR` | `boolean` | `true` | Enable calendar feature |
| `PUBLIC_ENABLE_REACTIONS` | `boolean` | `true` | Enable emoji reactions |
| `PUBLIC_ENABLE_PUSH` | `boolean` | `true` | Enable push notifications |

#### PWA Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUBLIC_VAPID_KEY` | `string` | — | VAPID public key for push notifications |
| `PUBLIC_SW_ENABLED` | `boolean` | `true` | Enable service worker |

#### Server-Side Only

| Variable | Type | Description |
|----------|------|-------------|
| `DATABASE_URL` | `string` | PostgreSQL connection string |
| `VAPID_PRIVATE_KEY` | `string` | VAPID private key |
| `ADMIN_PUBKEYS` | `string` | Comma-separated admin public keys |

---

## Configuration Files

### svelte.config.js

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    }),

    alias: {
      $components: 'src/lib/components',
      $stores: 'src/lib/stores',
      $services: 'src/lib/services',
      $types: 'src/lib/types',
      $utils: 'src/lib/utils'
    },

    csp: {
      mode: 'auto',
      directives: {
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'connect-src': ['self', 'wss:', 'https:']
      }
    }
  }
};

export default config;
```

---

### vite.config.ts

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],

  server: {
    port: 5173,
    strictPort: false,
    host: true
  },

  preview: {
    port: 4173
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true
  },

  optimizeDeps: {
    include: ['@nostr-dev-kit/ndk']
  }
});
```

---

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  darkMode: 'class',

  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',  // Main primary
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95'
        },
        accent: {
          DEFAULT: '#06b6d4',  // Cyan
          dark: '#0891b2'
        },
        background: {
          primary: '#0f0f23',
          secondary: '#1a1a2e',
          tertiary: '#252542'
        }
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },

      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out'
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },

  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms')
  ]
};
```

---

### tsconfig.json

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowJs": true,
    "checkJs": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ESNext"
  }
}
```

---

### .eslintrc.cjs

```javascript
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:svelte/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
    extraFileExtensions: ['.svelte']
  },
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser'
      }
    }
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'svelte/no-at-html-tags': 'warn'
  }
};
```

---

### .prettierrc

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [
    {
      "files": "*.svelte",
      "options": {
        "parser": "svelte"
      }
    }
  ]
}
```

---

## Runtime Configuration

### App Configuration Object

```typescript
// src/lib/config.ts
import { env } from '$env/dynamic/public';

export const config = {
  app: {
    name: env.PUBLIC_APP_NAME || 'Nostr BBS',
    url: env.PUBLIC_APP_URL || 'http://localhost:5173',
    description: env.PUBLIC_APP_DESCRIPTION || ''
  },

  relay: {
    url: env.PUBLIC_RELAY_URL,
    timeout: parseInt(env.PUBLIC_RELAY_TIMEOUT || '5000'),
    reconnect: env.PUBLIC_RELAY_RECONNECT !== 'false',
    maxRetries: parseInt(env.PUBLIC_RELAY_MAX_RETRIES || '5')
  },

  features: {
    dms: env.PUBLIC_ENABLE_DMS !== 'false',
    calendar: env.PUBLIC_ENABLE_CALENDAR !== 'false',
    reactions: env.PUBLIC_ENABLE_REACTIONS !== 'false',
    push: env.PUBLIC_ENABLE_PUSH !== 'false'
  },

  debug: env.PUBLIC_DEBUG === 'true'
} as const;
```

**Usage:**

```typescript
import { config } from '$lib/config';

if (config.features.dms) {
  // Enable DM functionality
}

console.log(`Connecting to ${config.relay.url}`);
```

---

## Zone Configuration

### zones.json

```json
{
  "zones": [
    {
      "id": "minimoonoir",
      "name": "Minimoonoir",
      "description": "UK community forum",
      "cohort": "moomaa-tribe",
      "theme": {
        "primary": "#8b5cf6",
        "accent": "#06b6d4"
      },
      "hero": "/images/zones/minimoonoir-hero.jpg",
      "logo": "/images/zones/minimoonoir-logo.png"
    },
    {
      "id": "dreamlab",
      "name": "DreamLab",
      "description": "Creative technology space",
      "cohort": "business",
      "theme": {
        "primary": "#ec4899",
        "accent": "#8b5cf6"
      },
      "hero": "/images/zones/dreamlab-hero.jpg",
      "logo": "/images/zones/dreamlab-logo.png"
    },
    {
      "id": "family",
      "name": "Family",
      "description": "Private family space",
      "cohort": "family",
      "theme": {
        "primary": "#10b981",
        "accent": "#06b6d4"
      },
      "hero": "/images/zones/family-hero.jpg",
      "logo": "/images/zones/family-logo.png"
    }
  ]
}
```

---

## Related Documentation

- [Development Setup](../getting-started/development-setup.md) — Environment setup
- [Deployment Guide](../deployment/index.md) — Production configuration
- [API Reference](api.md) — Internal APIs

---

[← Back to Developer Documentation](../index.md)
