const PROXY = 'multiverproxy.unethical.team';
const YML_URL = 'https://launcherupdates.lunarclientcdn.com/latest.yml';
const WEBHOOK = '';

let previousContent = '';
let latestVersion = '';
let ymlContent = '';

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function fetchLatestLauncherVersion() {
  try {
    if (!ymlContent) {
      const response = await fetch(YML_URL);

      if (response.ok) {
        ymlContent = await response.text();
      } else {
        throw new Error(`Failed to fetch YML content: ${response.status} ${response.statusText}`);
      }
    }

    const match = ymlContent.match(/version: (.+)/);
    latestVersion = match && match[1] ? match[1] : '1.0.0';

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

    const userAgent = request.headers.get('User-Agent');
    const isRegularVisitor = userAgent.includes('Mozilla') && !userAgent.includes('bot') && !userAgent.includes('AI');

    const clientIPAddress = request.headers.get('cf-connecting-ip');
    const isTargetIPAddress = clientIPAddress === '2a06:98c0:3600:0:0:0:0:103';

    await fetchLatestLauncherVersion();

    const targetURL = 'https://api.lunarclientprod.com/launcher/launch';

    const requestBody = {
      version: '1.8.9',
      branch: 'master',
      os: 'win32',
      arch: 'x64',
      launcher_version: latestVersion,
      hwid: '0',
    };

    const headers = {
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': `Lunar Client Launcher v${requestBody.launcher_version}`,
    };

    const response = await fetch(targetURL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Request to Lunar Client API failed with status ${response.status}`);
    }

    const responseBody = await response.text();

    if (await hasWebsiteChanged(responseBody) && (isTargetIPAddress || isRegularVisitor)) {
      const changesContent = await getChangesContent(previousContent, responseBody);

      if (changesContent) {
        await sendDiscordWebhook(WEBHOOK, changesContent, userAgent);
      }

      previousContent = responseBody;
    }

    if (isRegularVisitor) {
      return new Response(responseBody, { status: response.status });
    }
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('An error occurred while processing the request.', { status: 500 });
  }
}

async function hasWebsiteChanged(newContent) {
  return newContent !== previousContent;
}

function getChangesContent(previousContent, newContent) {
  const previousLines = previousContent.split('\n');
  const newLines = newContent.split('\n');

  const addedLines = newLines.filter((line) => !previousLines.includes(line));
  const removedLines = previousLines.filter((line) => !newLines.includes(line));

  const differences = [];

  if (addedLines.length > 0) {
    differences.push(`Added Lines:\n${addedLines.join('\n')}`);
  }

  if (removedLines.length > 0) {
    differences.push(`Removed Lines:\n${removedLines.join('\n')}`);
  }

  if (differences.length === 0) {
    return '';
  }

  return differences.join('\n\n');
}

async function sendDiscordWebhook(webhookURL, message, userAgent) {
  try {
    const payload = {
      content: 'multiver Changes:'
    };

    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(payload));
    formData.append('multiverchanges.json', new Blob([message], { type: 'application/json' }), 'multiverchanges.json');

    await fetch(webhookURL, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    throw new Error('Failed to send Discord webhook: ' + error.message);
  }
}
