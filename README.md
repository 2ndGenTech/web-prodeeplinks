# web-prodeeplinks

Web SDK for **ProDeepLinks** — deferred deep linking, attribution param handling, and MMP event tracking.

Works with any JavaScript web framework — React, Next.js, Vue, Svelte, Angular, or vanilla JS — because the core SDK has **zero required framework dependencies**.

> **API key required**: Use your publishable key (`pdl_live_pk_*` / `pdl_test_pk_*`) from [prodeeplinks.com](https://prodeeplinks.com/signup).

## Features

- Deep link resolution (page URL first, then fingerprint match)
- Attribution param extraction (`clickId`, `pdlSessionId`, UTMs) from the current page URL
- MMP event tracking (`/v1/mmp/events`, batch, conversions, attribution)
- Deferred fingerprint matching (public endpoint, no auth header)
- Optional Next.js React hook (`web-prodeeplinks/next`)
- Full TypeScript support
- Tree-shakeable, framework-agnostic core

## Installation

```bash
npm install web-prodeeplinks
```

For the optional Next.js hook, `react` is a peer dependency (you already have it in Next.js apps):

```bash
npm install web-prodeeplinks react
```

## Quick start (any framework)

```typescript
import {
  init,
  getDeepLink,
  updateSessionId,
  setCustomerUserId,
  trackPurchase,
  isReady,
} from 'web-prodeeplinks';

// 1. Initialize (parses page attribution params + runs deferred fingerprint match)
const initResult = await init({
  apiKey: 'pdl_live_pk_xxxx', // or pdl_test_pk_* for QA
  appVersion: '1.0.0', // optional, sent in fingerprint
});

if (!initResult.success) {
  console.error(initResult.error);
} else {
  // 2. If your backend sends app_open and returns a sessionId:
  updateSessionId(sessionIdFromBackend);

  // 3. Resolve deep link URL
  const link = await getDeepLink();
  if (link.success && link.url) {
    window.location.href = link.url;
  }

  // 4. After login — auto-sends a login event
  await setCustomerUserId('user_42');

  // 5. Purchase — sends purchase event + conversion in parallel
  await trackPurchase({
    revenue: 29.99,
    currency: 'USD',
    orderId: 'order_123',
    productId: 'prod_annual',
  });
}
```

## Deep link resolution flow

On `init()`:

1. Parses the current page URL and stores `clickId`, `pdlSessionId`, and UTM params in memory
2. Checks common query params (`url`, `deeplink`, `link`, `redirect`, `target`, `dl`) or hash redirects
3. Runs deferred fingerprint match in parallel when no URL is present

On `getDeepLink()`:

1. Returns cached URL if already resolved
2. Falls back to page URL query/hash params
3. Falls back to `POST /custom-deep-link/fingerprint/match` (public, no auth)

```
User lands on page with link params
       ↓
init() stores clickId / pdlSessionId / UTMs
       ↓
getDeepLink() returns URL for navigation
       ↓
trackAnalyticsEvent / trackPurchase attach stored attribution params
```

## App launch (`app_open`) — backend responsibility

This SDK **does not** send `app_open` on page load. That is handled by your **backend MMP layer**.

When your backend returns a `sessionId` from its `app_open` handling, pass it into the SDK:

```typescript
updateSessionId(sessionId);
```

The SDK uses that `sessionId` on subsequent events (`login`, `purchase`, custom events, conversions).

## React (Vite, CRA, etc.)

```tsx
import { useEffect, useState } from 'react';
import { init, getDeepLink } from 'web-prodeeplinks';

export function App() {
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      await init({ apiKey: import.meta.env.VITE_PRODEEPLINKS_KEY });
      const result = await getDeepLink();
      if (result.url) setDeepLink(result.url);
    }
    setup();
  }, []);

  if (deepLink) {
    window.location.href = deepLink;
  }

  return null;
}
```

## Next.js (App Router)

Use the optional client hook from the `/next` subpath:

```tsx
'use client';

import { useProDeepLink } from 'web-prodeeplinks/next';

export function DeepLinkResolver() {
  const { loading, result } = useProDeepLink({
    apiKey: process.env.NEXT_PUBLIC_PRODEEPLINKS_KEY!,
    appVersion: '1.0.0',
  });

  if (loading) return null;

  if (result?.success && result.url) {
    window.location.href = result.url;
  }

  return null;
}
```

Mount `<DeepLinkResolver />` once in your root layout or a top-level client component.

## Vue / Svelte / Angular / Vanilla JS

Import the same functions from `web-prodeeplinks` and call `init()` + `getDeepLink()` on app mount. No framework-specific package is needed.

```javascript
import { init, getDeepLink } from 'web-prodeeplinks';

document.addEventListener('DOMContentLoaded', async () => {
  await init({ apiKey: 'pdl_live_pk_xxxx' });
  const { url } = await getDeepLink();
  if (url) window.location.href = url;
});
```

## API reference

### `init(config)`

| Field | Type | Description |
|-------|------|-------------|
| `apiKey` | string | **Preferred.** Publishable key `pdl_live_pk_*` or `pdl_test_pk_*` |
| `licenseKey` | string | Deprecated alias for `apiKey` |
| `apiBaseUrl` | string | Optional. Defaults to `https://api.prodeeplinks.com` |
| `appVersion` | string | Optional. Version sent in fingerprint (default: `"web"`) |

### `getDeepLink(callback?)`

Returns `{ success, url, message?, error? }`. URL is `null` when no deferred link is available.

### `updateSessionId(sessionId)`

Sets the in-memory MMP session ID from your backend `app_open` layer.

### `setCustomerUserId(userId)`

Stores the user ID and **automatically sends** a `login` event to `/v1/mmp/events`.

### `trackAnalyticsEvent(event)`

Sends custom/screen events. Secondary events are **batched** to `/v1/mmp/events/batch` (max 50). `login` and `purchase` are sent immediately.

Legacy event types are mapped automatically:

| Old | Sent as |
|-----|---------|
| `deeplink` | `app_open` |
| `identify` | `login` |
| `pro_track` | `custom` |

Auth uses the `x-api-key` header — do not put the key in the event body.

### `trackPurchase(payload)`

Sends **both** in parallel (per MMP integration guide):

- `POST /v1/mmp/events` with `eventType: "purchase"`
- `POST /v1/mmp/conversions` with `conversionType: "purchase"`

Duplicate `orderId` values are skipped client-side.

### `trackConversion(payload)`

Sends a conversion to `/v1/mmp/conversions`. Retries attribution fetch if inline attribution is null.

### `getAttribution(conversionId)`

Fetches attribution from `GET /v1/mmp/attribution/:conversionId`.

### `flush()`

Force-flushes the in-memory event batch queue.

### `isReady()` / `reset()`

Check initialization state or clear SDK runtime state.

### `ProDeepLink` class (optional)

```typescript
const pdl = new ProDeepLink({ apiKey: 'pdl_live_pk_xxxx', appVersion: '1.0.0' });
await pdl.initialize();
const result = await pdl.getDeepLinkUrl();
```

### `useProDeepLink(options)` — from `web-prodeeplinks/next`

Client-only React hook. Options match `init()` plus `autoResolve` (default `true`).

## Authentication

| Endpoint | Auth |
|----------|------|
| `/v1/mmp/*` | `x-api-key: pdl_live_pk_*` (or test key) |
| `/custom-deep-link/fingerprint/match` | None (public) |
| `/custom-deep-link/license/validate` | None (public, body only) |

Use **publishable** keys (`pk`) in client-side code. Never embed secret keys (`sk`).

Legacy keys (`cdl_pub_*`, `CDL-V1-*`) still work; the SDK logs a deprecation warning when the server returns `X-Api-Key-Deprecation`.

## MMP endpoints used

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/mmp/events` | Immediate events (`login`, `purchase`, `app_open`) |
| POST | `/v1/mmp/events/batch` | Batched secondary events |
| POST | `/v1/mmp/conversions` | Conversions + attribution |
| GET | `/v1/mmp/attribution/:id` | Attribution lookup |
| POST | `/custom-deep-link/fingerprint/match` | Deferred deep link resolution |

## TypeScript types

```typescript
import type {
  InitConfig,
  InitResponse,
  DeepLinkResponse,
  CustomDeepLinkAnalyticsEvent,
  MmpConversionPayload,
  MmpConversionResponse,
  TrackPurchasePayload,
} from 'web-prodeeplinks';
```

## Error handling

- Invalid API key format is rejected locally before any network call
- MMP API errors return `{ success: false, error: string }`
- Rate limit (`429`) responses retry with exponential backoff (up to 3 attempts)

## Troubleshooting

**`getDeepLink()` returns null**

- Normal on organic visits with no prior link click
- Deferred match requires a prior tracked click within the attribution window

**Events missing attribution**

- Ensure `init()` ran on page load (params are parsed from the current URL)
- Ensure `updateSessionId()` is called after your backend `app_open`

**401 on MMP calls**

- Verify `pdl_live_pk_*` / `pdl_test_pk_*` key (not `sk`)
- Confirm `init({ apiKey })` succeeded

## npm publishing notes

When you publish to npm:

- The **core entry** (`web-prodeeplinks`) works everywhere `fetch` and browser APIs exist
- The **Next entry** (`web-prodeeplinks/next`) is optional and only for React client components
- `next` and `react` are optional peer dependencies — non-React apps won't need them

```bash
npm run build
npm publish
```

## Related package

- [`rn-prodeeplinks`](https://www.npmjs.com/package/rn-prodeeplinks) — React Native SDK with the same API and resolution pattern

## Support

- Portal: [prodeeplinks.com/signup](https://prodeeplinks.com/signup)
- Technical issues: contact ProDeepLinks support

## License

MIT — see [LICENSE](./LICENSE). Usage requires a valid API key from the ProDeepLinks portal.
