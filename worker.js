const YML_URL = 'https://launcherupdates.lunarclientcdn.com/latest.yml';
const API_URL = 'https://api.lunarclientprod.com/launcher/launch';

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

async function handleRequest(request, env) {
  if (request.method === 'GET') {
    return await handleGetRequest(request, env);
  } else {
    return new Response('Method Not Allowed', { status: 405 });
  }
}

async function fetchLatestLauncherVersion(env) {
  try {
    const cachedVersion = await env.KV.get('latestVersion');
    if (cachedVersion) {
      console.log('Cached version found:', cachedVersion);
      return cachedVersion;
    } else {
      console.log('No cached version found, fetching latest version...');
    }
  } catch (error) {
    console.error('Error accessing KV:', error.message);
  }

  try {
    const response = await fetch(YML_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch YML content: ${response.status} ${response.statusText}`);
    }

    const ymlContent = await response.text();
    const match = ymlContent.match(/version:\s*(.+)/);
    const latestVersion = match ? match[1] : '1.0.0';

    console.log('Fetched latest version:', latestVersion);

    if (env.KV) {
      try {
        await env.KV.put('latestVersion', latestVersion, { expirationTtl: 3600 });
        console.log('Stored latest version in KV:', latestVersion);
      } catch (error) {
        console.error('Error storing in KV:', error.message);
      }
    }

    return latestVersion;
  } catch (error) {
    console.error('Error fetching latest version:', error.message);
    return '1.0.0';
  }
}

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
    console.error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
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
