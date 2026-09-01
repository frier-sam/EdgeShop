# Integrations Page Design

**Date:** 2026-02-21
**Feature:** Admin Integrations Page
**Status:** Approved

---

## Overview

A single dedicated admin page at `/admin/integrations` that consolidates all third-party integration configuration. Tabbed layout with three tabs: **Payment**, **Shipping**, and **Email**.

---

## Architecture

### Frontend
- New page: `frontend/src/admin/pages/AdminIntegrations.tsx`
- Tabbed layout — tabs: Payment | Shipping | Email
- Reads settings from `GET /api/settings/admin` (includes sensitive keys)
- Saves to `PUT /api/settings`
- Test-connection endpoints via `POST /api/admin/integrations/*`

### Backend
1. D1 migration `0011_integrations.sql` — seed ShipRocket settings keys
2. `settings.ts` — expand allowed PUT whitelist with ShipRocket keys
3. `email.ts` — add SendGrid + Brevo provider support
4. New route `worker/src/routes/admin/integrations.ts` — two endpoints
5. `worker/src/index.ts` — mount the new route
6. `AdminSettings.tsx` — remove Razorpay section (moved to Integrations)
7. `AdminLayout.tsx` — add Integrations nav item to Store section
8. `App.tsx` — register `/admin/integrations` route

---

## Tab Specifications

### Tab 1 — Payment

**Razorpay card** (moved from AdminSettings):
- Status badge: "Connected" (green) if `razorpay_key_id` is non-empty, else "Not configured" (gray)
- Input: Key ID (`razorpay_key_id`)
- Input: Key Secret — masked password field (`razorpay_key_secret`)
- Help note: "Webhook secret is configured via the `RAZORPAY_WEBHOOK_SECRET` env var in Cloudflare Workers"
- Save button

**Cash on Delivery card** (moved from AdminSettings):
- Toggle to enable/disable COD (`cod_enabled`)
- Save button

---

### Tab 2 — Shipping (ShipRocket)

**ShipRocket card:**
- Enable toggle (`shiprocket_enabled`)
- Status badge: "Connected" (green) if `shiprocket_enabled === 'true'` AND token is cached, else "Not connected" (gray)
- Input: Email (`shiprocket_email`)
- Input: Password — masked (`shiprocket_password`)
- Input: Pickup Location — text input, default "Primary" (`shiprocket_pickup_location`)
- **"Test Connection" button**: calls `POST /api/admin/integrations/shiprocket/test`
  - On success: shows green inline message with company name from ShipRocket
  - On failure: shows red inline error
- Quick instructions: link to https://app.shiprocket.in → Settings → API
- Save button

---

### Tab 3 — Email

**Email provider card:**
- Status badge: "Configured" (green) if `email_api_key` is non-empty, else "Not configured" (gray)
- Provider selector (radio): **Resend** | **SendGrid** | **Brevo** (`email_provider`, default: `resend`)
- Input: API Key — masked password field (`email_api_key`)
- Input: From Name (`email_from_name`)
- Input: From Email (`email_from_address`)
- **"Send test email" button**: calls `POST /api/admin/integrations/email/test`
  - Sends a test email to `merchant_email` (from settings)
  - Shows inline success/error result
- Save button

---

## Backend: New Settings Keys (D1)

```sql
-- migration 0011_integrations.sql
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shiprocket_email', ''),
  ('shiprocket_password', ''),
  ('shiprocket_pickup_location', 'Primary'),
  ('shiprocket_enabled', 'false'),
  ('shiprocket_token', ''),
  ('shiprocket_token_expires_at', '');
```

---

## Backend: `admin/integrations.ts` Endpoints

### `POST /api/admin/integrations/shiprocket/test`
```
Body: { email: string, password: string }
→ POST https://apiv2.shiprocket.in/v1/external/auth/login
→ On success: save token + expiry to D1 settings, return { ok: true, company: string }
→ On failure: return { ok: false, error: string }
```

### `POST /api/admin/integrations/email/test`
```
Body: { provider: string, api_key: string, from_name: string, from_address: string, test_to: string }
→ Uses same sendEmail() logic with provider routing
→ Returns { ok: true } or { ok: false, error: string }
```

---

## Backend: `email.ts` Provider Routing

Add `email_provider` parameter to `sendEmail()`. Route to:
- `resend` → `https://api.resend.com/emails` (current implementation)
- `sendgrid` → `https://api.sendgrid.com/v3/mail/send` (Bearer token, different JSON shape)
- `brevo` → `https://api.brevo.com/v3/smtp/email` (api-key header, different JSON shape)

---

## Settings Whitelist Additions

Add to `allowed` array in `settings.ts` PUT handler:
```
'shiprocket_email', 'shiprocket_password', 'shiprocket_pickup_location',
'shiprocket_enabled', 'shiprocket_token', 'shiprocket_token_expires_at'
```

Also add `shiprocket_password` to `SENSITIVE_KEYS` set.

---

## Navigation Change

Add to `Store` section in `AdminLayout.tsx`:
```
{ to: '/admin/integrations', label: 'Integrations', icon: <IconPlug />, permission: 'settings' }
```
Position: between Shipping and Settings.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Tabbed layout (not cards) | User chose this; all statuses visible per tab |
| Move Razorpay + COD out of AdminSettings | Settings page has too many unrelated sections; dedicated Integrations page is cleaner |
| ShipRocket token cached in D1 settings | Workers runtime has no in-memory cache across invocations; D1 is the right place; expiry checked before use |
| SMTP not supported | Cloudflare Workers cannot make raw TCP connections; only HTTP-based email APIs work |
| `shiprocket_password` in SENSITIVE_KEYS | Masked from public GET /api/settings; only accessible via /api/settings/admin (admin-auth protected) |
| Test endpoints in `admin/integrations.ts` | Keeps integration logic isolated; reuses existing `sendEmail()` and `requireAdmin` middleware |
