# multiverproxy
A Cloudflare Worker designed to proxy Lunar Client's multiver changes.
- [demo the proxy](https://multiverproxy.unethical.team)

## How the Worker Works
### Constants

```javascript
const YML_URL = 'https://launcherupdates.lunarclientcdn.com/latest.yml';
const API_URL = 'https://api.lunarclientprod.com/launcher/launch';
```

- `YML_URL`: Points to the Lunar Client's latest.yml file, which contains the version info of the Lunar Client launcher.
- `API_URL`: This is the endpoint for Lunar Client's launcher API. Requests to this endpoint allow interaction with the launcher’s backend.

### `fetch` Event Listener

```javascript
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Error:', error.message);
      return new Response('Internal Server Error.', { status: 500 });
    }
  }
};
```

- This listener is triggered when the worker receives a fetch event. It forwards the request to the `handleRequest` function. If an error occurs, it catches and logs it, returning a `500 Internal Server Error` response.

### `handleRequest`

```javascript
async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    return await handleGetRequest(request, env);
  } else {
    return new Response('Method Not Allowed', { status: 405 });
  }
}
```

**Routing logic:**
- For any `GET` requests, it calls `handleGetRequest`.
- Any other HTTP methods result in a `405 Method Not Allowed` response.

### `fetchLatestLauncherVersion`

```javascript
async function fetchLatestLauncherVersion(env) {
  try {
    const cachedVersion = await env.KV.get('latestVersion');
    if (cachedVersion) {
      console.log('Cached version found:', cachedVersion);
      return cachedVersion;
    }
  } catch (error) {
    console.error('Error accessing KV:', error.message);
  }

  try {
    const response = await fetch(YML_URL);
    if (!response.ok) throw new Error(`Failed to fetch YML content: ${response.status}`);

    const ymlContent = await response.text();
    const match = ymlContent.match(/version:\s*(.+)/);
    const latestVersion = match ? match[1] : '1.0.0';

    if (env.KV) {
      await env.KV.put('latestVersion', latestVersion, { expirationTtl: 3600 });
    }

    return latestVersion;
  } catch (error) {
    console.error('Error fetching latest version:', error.message);
    return '1.0.0';
  }
}
```
**Fetching the latest version:**
- The function first checks Cloudflare KV storage for a cached version of the launcher.
- If no cache is found, it fetches the `latest.yml` file to extract the version.
- If successful, the fetched version is cached in KV storage for an hour (`expirationTtl: 3600`).

### `handleGetRequest`
```javascript
async function handleGetRequest(request, env) {
  const userAgent = request.headers.get('user-agent');

  if (userAgent.includes('Discord')) {
    return new Response(generateDiscordHtml(), { headers: { 'Content-Type': 'text/html' } });
  }

  const version = await fetchLatestLauncherVersion(env);
  const apiResponse = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': `Lunar Client Launcher v${version}`,
    },
    body: JSON.stringify({
      version: '1.8.9',
      branch: 'master',
      os: 'win32',
      arch: 'x64',
      launcher_version: version,
      hwid: '0',
      installation_id: crypto.randomUUID(),
      os_release: '10.0.22621',
    }),
  });

  if (!apiResponse.ok) {
    console.error(`API request failed: ${apiResponse.status}`);
    return new Response('API request failed.', { status: 502 });
  }

  const apiData = await apiResponse.json();
  return new Response(JSON.stringify(apiData), {
    headers: {
      'Content-Type': 'application/json',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    },
  });
}
```
- **Discord check:** If the request is from a Discord bot (based on the user agent), it generates an HTML page with Open Graph metadata.
- **API request:** Sends a `POST` request to Lunar Client’s launcher API with the latest version, system details, and random UUIDs for tracking.
- **Headers:** Adds several security-related headers like `Strict-Transport-Security`, `X-Frame-Options`, etc.

### `generateDiscordHtml`
```javascript
function generateDiscordHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Multiver Proxy</title>
      <meta property="og:title" content="multiver Proxy" />
      <meta property="og:description" content="A proxy that makes a POST request to Lunar Client's API for you. Made by unethical ❤️" />
      <meta property="og:image" content="https://unethicalcdn.com/transparent%20logo.png" />
      <meta name="theme-color" content="#2b2d31" />
    </head>
    <body>
    </body>
    </html>
  `;
}
```
- Generates a basic HTML page with Open Graph tags for Discord embeds, describing the service provided by the worker proxy.
