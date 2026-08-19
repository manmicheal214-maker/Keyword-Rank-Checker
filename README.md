# SEO Keyword Rank Checker

A production-oriented Google SERP keyword rank checker built on the existing static GitHub Pages dashboard. Users enter a website domain, keyword, country, and device, then the server-side API queries ZenRows and returns the matching organic Google result when it is within the first 100 results.

## Project description

The frontend remains plain HTML/CSS/JavaScript and keeps the existing dashboard, filters, Semrush metrics, and static ranking data. The new rank-checker form is additive and calls a separate Node.js serverless endpoint so the ZenRows credential never reaches the browser.

## Architecture

```text
GitHub Pages
    |
    | Static HTML/CSS/JavaScript
    v
Rank checker frontend
    |
    | POST /api/rank
    v
Vercel Node.js Serverless Function
    |
    | ZENROWS_API_KEY (server environment only)
    v
ZenRows Universal Scraper API
    |
    | Google SERP URL + locale + device + structured autoparse
    v
Google organic results
    |
    v
Ranking result returned as JSON
```

GitHub Pages is a static hosting service, so it cannot execute the Node.js endpoint itself. The `/api/rank.js` function is intended for a separate Vercel deployment. Vercel supports Node.js serverless functions from the repository's `api` directory.

## Repository structure

- `index.html` — existing dashboard plus injected rank-checker UI.
- `scripts/rank-checker.js` — browser-side form validation, loading state, API call, and result rendering. It contains no ZenRows secret.
- `api/rank.js` — server-side API endpoint and ZenRows integration.
- `api/rank.test.js` — domain normalization and hostname matching tests.
- `api/rank.integration.test.js` — mocked API behavior tests for validation, success, no-ranking, ZenRows failure, and CORS.
- `scripts/inject_rank_checker_ui.py` — idempotent UI injector used to preserve the existing dashboard design.
- `.github/workflows/apply-rank-checker-ui.yml` — keeps the generated UI block in `index.html` synchronized.
- `.env.example` — safe environment-variable template.
- `package.json` — Node test command; no frontend framework is introduced.

## Local development

### Frontend

The frontend is static. You can serve the repository root with any static HTTP server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

Set the backend URL before using the checker. The browser script reads:

```js
window.RANK_CHECKER_API_URL || "YOUR_BACKEND_URL"
```

For a local backend, define `window.RANK_CHECKER_API_URL` before `scripts/rank-checker.js` is loaded, or temporarily change the value in the script for local development. Do not put credentials in that variable.

### Backend

The endpoint is designed for Node.js 20+ and Vercel. For a local Vercel-compatible environment:

```bash
npm install
npx vercel dev
```

Create a local `.env` file from `.env.example` and set a real key locally. Never commit that file.

## ZenRows setup

The backend uses the ZenRows Universal Scraper API endpoint requested by this project: `https://api.zenrows.com/v1/`. It sends the Google search URL, JavaScript rendering, Premium Proxy, country-specific proxy routing, device, and `autoparse=true`. Structured organic results are preferred; a narrowly scoped Google HTML parser is used only as a fallback when ZenRows returns an unstructured response.

ZenRows documents the Universal Scraper API parameters, including `autoparse` and `proxy_country`, in its API specification documentation.

Create or retrieve your ZenRows API key from your ZenRows account, then store it only as the server environment variable:

```text
ZENROWS_API_KEY=your_zenrows_api_key
```

The Google query URL requests up to 100 results and includes country/locale parameters so the SERP is localized.

## Environment variables

Only this server-side variable is required:

| Variable | Required | Where it belongs |
| --- | --- | --- |
| `ZENROWS_API_KEY` | Yes | Vercel environment variables / local uncommitted `.env` |

Never use `NEXT_PUBLIC_ZENROWS_API_KEY`, browser JavaScript, `localStorage`, or committed source code for this secret.

## Backend deployment with Vercel

1. Sign in to Vercel.
2. Create a new project and import this existing GitHub repository.
3. Keep the project rooted at the repository root; do not create a Next.js application.
4. In **Project Settings → Environment Variables**, add:
   - Name: `ZENROWS_API_KEY`
   - Value: your actual ZenRows API key
   - Environments: enable Production (and Preview/Development if you want those environments to work).
5. Deploy the project.
6. Copy the resulting Vercel project URL, for example `https://your-project.vercel.app`.
7. Configure the GitHub Pages frontend's `window.RANK_CHECKER_API_URL` to that Vercel origin. Do not include `/api/rank` in the base URL.
8. Redeploy the frontend after that configuration change.

Vercel automatically detects Node.js functions placed in the root `api` directory. See the Vercel Node.js serverless function documentation for the platform model.

## GitHub Pages deployment

The existing site remains a static project. No Next.js conversion is required.

If the repository is already configured to publish `main`, keep that configuration. GitHub Pages can publish static files directly from a branch, and GitHub also supports custom Actions-based Pages deployments. The existing Semrush workflows are preserved.

The rank-checker UI is inserted into `index.html` by `scripts/inject_rank_checker_ui.py`. The generated UI is committed to the feature branch by the dedicated workflow so the pull request contains the actual frontend change.

## API documentation

### `POST /api/rank`

Request body:

```json
{
  "keyword": "best running shoes",
  "domain": "example.com",
  "country": "United States",
  "device": "desktop"
}
```

Successful ranking response:

```json
{
  "success": true,
  "keyword": "best running shoes",
  "domain": "example.com",
  "position": 7,
  "url": "https://example.com/running-shoes",
  "title": "Best Running Shoes",
  "checkedAt": "2026-08-19T10:30:00.000Z"
}
```

Successful no-ranking response:

```json
{
  "success": true,
  "keyword": "best running shoes",
  "domain": "example.com",
  "position": null,
  "url": null,
  "title": null,
  "checkedAt": "2026-08-19T10:30:00.000Z"
}
```

The frontend renders `position: null` as **Not ranked in the top 100**.

### Supported countries

- United States
- United Kingdom
- Canada
- Australia
- India
- United Arab Emirates

### Supported devices

- Desktop
- Mobile

## Domain matching

Input is normalized from forms such as `https://www.example.com/`, `http://example.com`, `www.example.com`, and `example.com/path` to `example.com`.

Ranking URLs are compared by hostname. The exact domain and subdomains such as `www.example.com` and `blog.example.com` are accepted. A hostname such as `example.com.evil.com` is not treated as a match.

## Error handling and security

The endpoint implements:

- Exact CORS allowlisting for the GitHub Pages origin plus local development origins.
- No wildcard `Access-Control-Allow-Origin`.
- Server-only ZenRows authentication.
- Domain and keyword validation.
- Supported country/device allowlists.
- Request body size guard.
- Per-instance request throttling (10 requests per minute per client IP).
- 25-second ZenRows timeout.
- Safe public error messages without API keys, environment values, or server paths.
- `Cache-Control: no-store` for API responses.

The in-memory rate limit is intentionally lightweight for a serverless deployment. For high-volume production traffic, add a shared rate limiter such as a managed KV/database service or an upstream gateway.

## Testing

Run:

```bash
npm test
```

The test suite covers:

- Domain normalization.
- Exact/subdomain hostname matching.
- Malicious lookalike hostname rejection.
- Missing `ZENROWS_API_KEY`.
- Successful mocked ZenRows response.
- No-ranking response.
- ZenRows HTTP failure.
- CORS origin rejection.

A real ZenRows success request requires your private API key and a live network/API account. It is therefore not falsely represented as a locally verified live call in this repository.

## Secret scanning

Before committing changes, verify that no credential is present:

```bash
git grep -nE 'ZENROWS_API_KEY|api[_-]?key|apikey|secret' -- ':!README.md' ':!.env.example'
```

`.env.example` contains only a placeholder. Never commit a real `.env` file.

## Deployment checklist

1. Add `ZENROWS_API_KEY` to Vercel.
2. Deploy the Vercel backend.
3. Set `window.RANK_CHECKER_API_URL` to the Vercel origin in the static frontend.
4. Publish the existing GitHub Pages site from `main`.
5. Test the form from the live GitHub Pages URL.
6. Confirm the browser never receives the ZenRows key.

## Existing functionality

The existing dashboard, Semrush data, scheduled workflows, and static data files are preserved. The rank checker is added as a separate interactive feature rather than replacing the current dashboard.
