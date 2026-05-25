# Tether App — Development Guide

**Project**: Personal productivity app with 5 sections (Daily Check-in, To-Do List, Habits Hub, Social/Contacts, Settings)
**Stack**: React + Vite frontend, Vercel serverless API, Notion database, Clerk auth, Google Contacts API

---

## Architecture Overview

### Frontend
- **Entry**: `src/App.jsx` — Router, auth check, main layout
- **Pages**: `src/checkin.jsx`, `src/hub.jsx` (tabs for tasks, habits, routines, social, settings)
- **Shared**: `src/shared.jsx` (UI components, EmojiRain confetti explosion)
- **Styles**: `src/styles.css` (variables, responsive design)
- **State**: `src/useAppData.js` (central state management, API calls)

### Backend API
All endpoints in `/api/*.js`:
- `checkin.js`, `tasks.js`, `goals.js`, `habits.js`, `routines.js` — CRUD for app data
- `contacts.js` — Person CRUD (Google People API)
- `contact-groups.js` — Group/label CRUD (Google People API)
- `contact-notes.js` — Notes per contact (Notion)
- `_google-people.js` — Google People API wrapper (auth, batch operations)
- `_notion.js` — Notion API wrapper (batch updates, queries)
- `google-auth.js`, `google-auth-callback.js` — OAuth flow
- `prefs.js` — User preferences (Notion `_prefs` table)

### Database
**Notion**: Primary storage for all app data (tasks, habits, contacts, notes, preferences)
**Google Contacts**: Real-time sync for contacts + groups (via Google People API)

---

## Key Implementation Details

### Google Contacts Integration
- **OAuth**: User logs in via Google OAuth. Refresh token stored in Notion `_prefs` table.
- **Contact Fields**: names, emailAddresses, phoneNumbers, addresses, birthdays, relations (linked contacts), userDefined (custom fields)
- **Custom Fields** (userDefined): `from`, `lastSeen`, `giftIdeas`, `context`, `introducedBy`, `linkedContacts` (JSON)
- **Groups/Labels**: User-created groups have numeric IDs (e.g., `contactGroups/123456`); system groups are `contactGroups/myContacts`, `contactGroups/starred`, etc.
- **Filtering**: In `contacts.js` `toContact()`, only show user group memberships (filter by regex `/^contactGroups\/\d+$/`)
- **Syncing**:
  - GET /api/contacts → lists all Google contacts, maps to app format
  - PATCH /api/contacts → updates contact in Google (via `updateContact`)
  - Group membership changes via `addContactToGroup`/`removeContactFromGroup`

### Daily Check-in Celebration
- **Confetti Animation**: 640 particles (260 emojis + 380 confetti pieces) with spring physics
- **Animation**: Burst from center, arc upward out of screen, come back down with gravity
- **Completion Flow**: User marks all 4 sections complete → celebration triggers → redirects to tasks after 2.4s
- **Undo**: Completion banner has "Undo" button to reset and reopen sections

### Linked Contacts
- **Storage**: Stored as JSON in Google userDefined field `linkedContacts`
- **Format**: `[{ id: "people/cXXX", relationship: "friend", group: "Group Name" }]`
- **UI**: 3-step flow in social.jsx: search existing contacts → select relationship type → optional group name
- **Reverse links**: Auto-create reverse link on the other contact (for two-way relationships)

### Partial Patch Handling
- **Problem**: PATCH with only `{ groups: [...] }` was clobbering contact name (setting to empty string)
- **Solution**: `toGooglePerson()` now checks `contact.field !== undefined` before setting each field
- **Re-fetch**: After group membership changes (which modify etag), fetch fresh person before calling `updateContact`

---

## Common Workflows

### Adding a New Contact Field
1. In `contacts.js` `toContact()`: add field from Google person object
2. In `contacts.js` `toGooglePerson()`: handle field in patch (add `if (contact.fieldName !== undefined) { ... }`)
3. In social.jsx `ContactCard`: add UI input for the field
4. Test PATCH endpoint with partial patch (only the new field changed)

### Adding a New Custom Field
1. Add to `setCustomField()` calls in `toGooglePerson()`
2. Add to `getCustomField()` in `toContact()`
3. Fields persist via Google userDefined

### Updating Version & Changelog
1. Edit `version.json` with new version (major.minor.patch) and changelog entry
2. Commit: version automatically syncs to settings
3. Settings page displays the new version with badges (major/minor/fix)

### Deploying to Vercel
1. Commit to main → push to GitHub
2. Vercel auto-deploys from GitHub webhook
3. Check deployment at `to-tether.app` or in Vercel dashboard

---

## Environment Variables (Vercel)
```
GOOGLE_CLIENT_ID           # OAuth client ID
GOOGLE_CLIENT_SECRET       # OAuth client secret
GOOGLE_REFRESH_TOKEN       # Stored after first auth (or in Notion prefs)
NOTION_API_KEY             # Notion integration token
NOTION_WORKSPACE_ID        # Workspace ID
CLERK_SECRET_KEY           # Clerk auth
```

---

## Common Bugs & Fixes

### System Groups Appearing as User Tags
- **Symptom**: Tags like "myContacts", "starred" show up in app, can't delete
- **Cause**: Filter was checking non-existent `metadata.isSystemContactGroup` field
- **Fix**: Use `g.groupType === "USER_CONTACT_GROUP"` and request `groupFields=groupType` in API call

### Tags Not Persisting After Removal
- **Symptom**: Remove tag from contact, save, refresh → tag comes back
- **Cause**: Group membership changes but `updateContact` fails (etag conflict or name cleared)
- **Fix**: After group membership changes, re-fetch fresh person before `updateContact`; only set name field if `contact.name !== undefined`

### Linked Contacts Not Saving
- **Symptom**: Add linked contact, refresh → gone
- **Cause**: `linkedContacts` not in `updatePersonFields` list, stored in Google relations (which only store text names)
- **Fix**: Store as JSON in userDefined field `linkedContacts`; update `toGooglePerson()` to serialize, `toContact()` to deserialize

### Emoji Sizes Not Scaling Right
- **Frontend**: Sizes in `shared.jsx` are in `px`, must be adjusted for intended visual hierarchy
- **CSS**: Scale factors in keyframes must account for initial `fontSize` prop

---

## File Locations Reference

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main router, layout |
| `src/checkin.jsx` | Daily check-in page + celebration |
| `src/hub.jsx` | Task, habit, routine, contact, settings tabs + SettingsTab |
| `src/social.jsx` | Contact cards, LinkedContactPicker |
| `src/useAppData.js` | Central state + API orchestration |
| `src/api.js` | Frontend fetch helpers |
| `api/*.js` | Backend endpoints |
| `version.json` | Current version + changelog (syncs to settings) |

---

## Quick Commands

```bash
# Local dev
npm run dev

# Build
npm run build

# Deploy (push to GitHub → Vercel auto-deploys)
git push origin main

# Update version (then commit)
# Edit version.json, commit: version auto-syncs to settings
```

---

## Key Architectural Decisions

1. **Notion Primary, Google Sync**: Notion is source of truth for all app data; Google Contacts is a real-time mirror for contacts only
2. **No App Backend Caching**: All data flows directly to Notion/Google, no local cache
3. **Graceful Degradation**: Failed contact API calls don't crash the app (wrapped in `.catch(() => [])`)
4. **Patch-Aware Updates**: `toGooglePerson()` only modifies fields present in the patch, avoiding unintended overwrites
5. **Semantic Versioning**: Track versions (major.minor.patch) and changelog in `version.json`; auto-syncs to settings UI

---

**Last Updated**: May 25, 2026 | **Version**: 2.1.0
