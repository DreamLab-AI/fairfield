# Screenshot Checklist

## Captured Views

### Public Pages (No Auth Required)
- [x] Landing Page (`01-landing.png`) - Welcome screen with login/signup options
- [x] Signup Gateway (`02-signup-gateway.png`) - Choose Quick Start vs Secure Setup
- [x] Simple Signup - Nickname Entry (`03-simple-signup.png`)
- [x] Simple Signup - Nickname Filled (`04-nickname-filled.png`)
- [x] Simple Signup - Password Shown (`05-password-shown.png`)
- [x] Login Page (`10-login.png`) - Quick login with password

### Authenticated Views (User)
- [x] Chat/Channels Hub (`06-chat-hub.png`) - Main channel listing
- [x] Forums Overview (`07-forums.png`) - Zone and section navigation
- [x] Events Page (`08-events.png`) - Calendar and events
- [x] DM List (`09-dm.png`) - Direct messages

### Mobile Views
- [x] Chat Hub Mobile (`11-chat-mobile.png`) - Responsive mobile layout
- [x] Signup Mobile (`12-signup-mobile.png`) - Mobile signup flow

### Admin Views (Requires Admin Key)
- [ ] Admin Dashboard - Pending (requires ADMIN_KEY)
- [ ] Admin Statistics - Pending (requires ADMIN_KEY)
- [ ] User Management - Pending (requires ADMIN_KEY)

## Screenshots Used in README

| Screenshot | Location | Description |
|------------|----------|-------------|
| `02-signup-gateway.png` | docs/README.md | Main hero - signup gateway |
| `06-chat-hub.png` | docs/README.md | Channels hub preview |
| `07-forums.png` | docs/README.md | Forums overview |
| `08-events.png` | docs/README.md | Events calendar |
| `11-chat-mobile.png` | docs/README.md | Mobile responsive demo |

## Viewport Sizes Used

| Viewport | Width | Height |
|----------|-------|--------|
| Desktop | 1920 | 1080 |
| Mobile | 390 | 844 |

## Capture Date

Generated: 2026-01-09

## How to Regenerate

```bash
# Run from project root
npm run dev &
sleep 5
npx tsx scripts/capture-screenshots.ts

# Or with admin screenshots (requires ADMIN_KEY env var)
ADMIN_KEY="your 12 word mnemonic" npx tsx scripts/capture-screenshots.ts
```
