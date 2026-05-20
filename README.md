# web-prodeeplinks

Secure deep linking SDK for **web apps** with license key validation and browser fingerprinting.

Works with any JavaScript web framework — React, Next.js, Vue, Svelte, Angular, or vanilla JS — because the core SDK has **zero required framework dependencies**.

> **License required**: A valid license key from the ProDeepLinks portal is required.

## Features

- License key validation against `api.prodeeplinks.com`
- Browser fingerprint matching for deferred deep links
- Same resolution flow as `rn-prodeeplinks`: **API first → URL fallback → null**
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
import { init, getDeepLink } from 'web-prodeeplinks';

const initResult = await init({
  licenseKey: 'your-license-key-from-portal',
  appVersion: '1.0.0', // optional, sent in fingerprint
});

if (!initResult.success) {
  console.error(initResult.error);
} else {
  const result = await getDeepLink();
  if (result.success && result.url) {
    window.location.href = result.url;
  }
}
```

## Deep link resolution flow

1. Collect browser fingerprint (user agent, screen, timezone, etc.)
2. Call `/custom-deep-link/fingerprint/match` on the ProDeepLinks API
3. If no API match, check the current page URL for common query params (`url`, `deeplink`, `link`, `redirect`, `target`, `dl`) or hash redirects
4. Return `null` if nothing is found

## React (Vite, CRA, etc.)

```tsx
import { useEffect, useState } from 'react';
import { init, getDeepLink } from 'web-prodeeplinks';

export function App() {
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      await init({ licenseKey: import.meta.env.VITE_PRODEEPLINKS_KEY });
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
    licenseKey: process.env.NEXT_PUBLIC_PRODEEPLINKS_KEY!,
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
  await init({ licenseKey: 'your-license-key' });
  const { url } = await getDeepLink();
  if (url) window.location.href = url;
});
```

## API reference

### `init(config)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `licenseKey` | string | yes | License key from portal |
| `appVersion` | string | no | Version sent in fingerprint (default: `"web"`) |

### `getDeepLink(callback?)`

Returns `{ success, url?, message?, error? }`.

### `trackAnalyticsEvent(event)`

Send custom analytics after `init()`.

### `isReady()` / `reset()`

Check initialization state or clear stored license key.

### `useProDeepLink(options)` — from `web-prodeeplinks/next`

Client-only React hook. Options match `init()` plus `autoResolve` (default `true`).

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

## License

MIT — see [LICENSE](./LICENSE). Usage requires a valid ProDeepLinks license key.
