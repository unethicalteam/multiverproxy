const PROXY = 'multiverproxy.unethical.team';
const YML_URL = 'https://launcherupdates.lunarclientcdn.com/latest.yml';

let ymlContent = '';
let latestVersion = '1.0.0';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function fetchLatestLauncherVersion() {
  if (ymlContent) return latestVersion;

  try {
    const response = await fetch(YML_URL);
    if (response.ok) {
      ymlContent = await response.text();
      const match = ymlContent.match(/version: (.+)/);
      latestVersion = match && match[1] ? match[1] : '1.0.0';
    } else {
      throw new Error(`Failed to fetch YML content: ${response.status} ${response.statusText}`);
    }
    return latestVersion;
  } catch (error) {
    throw new Error(`Failed to fetch latest launcher version: ${error.message}`);
  }
}

async function handleRequest(request) {
  try {
    if (request.headers.get('host') !== PROXY) {
      return new Response('Access Denied.', {
        status: 403,
      });
    }

    const launcherVersion = await fetchLatestLauncherVersion();
    const targetURL = 'https://api.lunarclientprod.com/launcher/launch';

    const headers = {
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': `Lunar Client Launcher v${launcherVersion}`,
    };

    const response = await fetch(targetURL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        version: '1.8.9',
        branch: 'master',
        os: 'win32',
        arch: 'x64',
        launcher_version: launcherVersion,
        hwid: '0',
      }),
    });

    if (!response.ok) {
      throw new Error(`Request to Lunar Client API failed with status ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('An error occurred while processing the request.', { status: 500 });
  }
}
