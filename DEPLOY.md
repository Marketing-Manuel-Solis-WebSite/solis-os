# Solis OS — Production Deploy Guide

## Environment Variables

### Required (Server-only)

| Variable | Description | Example |
|----------|-------------|---------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Full JSON of Firebase service account key | `{"type":"service_account","project_id":"solis-center",...}` |
| `GEMINI_API_KEY` | Google AI (Gemini) API key — **server-only, NOT `NEXT_PUBLIC_`** | `AIzaSy...` |
| `INTEGRATION_ENCRYPT_KEY` | 32-char hex key for encrypting OAuth/API tokens at rest | `a1b2c3d4...` |
| `WEBHOOK_PROCESSOR_SECRET` | Secret to authenticate internal webhook processor calls | Any random string |
| `RESEND_API_KEY` | Resend.com API key for transactional email | `re_...` |

**Alternative to `FIREBASE_SERVICE_ACCOUNT_KEY`** (individual vars):

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (with `\n` line breaks) |

### Required (Public — safe to expose)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app (e.g. `https://app.soliscenter.com`) |

### Optional

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_EMAILJS_*` | EmailJS config (client-side contact forms) |
| OAuth provider secrets | Per-provider (GitHub, Slack, etc.) — see `lib/oauth-providers.ts` |

---

## Firebase Admin SDK Setup

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key" — download the JSON file
3. Set the full JSON as `FIREBASE_SERVICE_ACCOUNT_KEY` in your hosting env vars
4. The app initializes the Admin SDK as a singleton in `lib/firebase-admin.ts`
5. All API routes use Admin SDK (`lib/db-admin.ts`, `lib/integrations-db-admin.ts`) — they bypass Firestore security rules

---

## Gemini API Key Rotation

The Gemini key was previously exposed as `NEXT_PUBLIC_GEMINI_API_KEY` (browser-visible). It has been migrated to `GEMINI_API_KEY` (server-only) and is now only used in `/api/ai/route.ts`.

**Action required:**
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Revoke the old key: `AIzaSyDZIQ7cPwYhMi_R12et4hK1CPrbLxyB5IU`
3. Generate a new key
4. Set it as `GEMINI_API_KEY` in your hosting environment
5. Verify `/api/ai` works after deploy

---

## Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

Key hardening already in place:
- All collections require `isOrgMember()` for reads
- Write operations require `isAdmin()` or `isManager()` by role
- `forms/{id}/submissions` — `allow create: if false` (writes go through `/api/forms/submit` via Admin SDK)
- `webhookEvents`, `webhook logs`, `automation logs` — `allow create: if false` (server-only)
- Role escalation blocked (members cannot modify `role`, `active`, `hierarchyLevel`)

---

## Smoke Tests Post-Deploy

Run these after deploying to verify critical paths:

### 1. Auth verification works
```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN/api/departments
# Expected: 401
```

### 2. Authenticated API route works
```bash
# Get a Firebase ID token from your app, then:
curl -H "Authorization: Bearer <ID_TOKEN>" https://YOUR_DOMAIN/api/departments
# Expected: 200 with {"teams":[...]}
```

### 3. OAuth blocked for anonymous
```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN/api/oauth/github/authorize
# Expected: 401
```

### 4. Public form submission works
```bash
curl -X POST https://YOUR_DOMAIN/api/forms/submit \
  -H "Content-Type: application/json" \
  -d '{"token":"<VALID_PUBLIC_TOKEN>","values":{"field1":"test"}}'
# Expected: 200 {"ok":true}
```

### 5. API v1 requires key
```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_DOMAIN/api/v1/tasks
# Expected: 401
```

### 6. Firestore rules block direct writes to submissions
From browser console with authenticated user:
```javascript
import { doc, setDoc } from 'firebase/firestore';
await setDoc(doc(db, 'forms/ANY_FORM_ID/submissions/test'), { test: true });
// Expected: PERMISSION_DENIED
```

### 7. Gemini AI endpoint works
```bash
curl -X POST https://YOUR_DOMAIN/api/ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -d '{"question":"ping"}'
# Expected: 200 with AI response
```
