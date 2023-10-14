# multiverproxy
A Cloudflare Worker designed to proxy Lunar Client's multiver changes.
- [demo the proxy](https://multiverproxy.unethical.team)

**Important Notice:**  <br>
This worker is currently under development, and its reliability has not been fully tested. <br>
It is not recommended for use in projects until this notice is removed.


## How the Worker Works
### Constants

```javascript
const PROXY = 'multiverproxy.unethical.team';
const YML_URL = 'https://launcherupdates.lunarclientcdn.com/latest.yml';
```

- `PROXY`: This sets the expected hostname for incoming requests. If a request's 'host' header doesn't match this value, the worker responds with an 'Access Denied' message. It's specific to our use case and not required.
- `YML_URL`: This stores the URL of Lunar Client's 'latest.yml' file, which contains info about the latest Lunar Client launcher version.

### Event Listener

```javascript
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});
```

- This listener triggers whenever a fetch request is made to the worker. It calls the `handleRequest` function to process the request and respond accordingly.

### `fetchLatestLauncherVersion`

```javascript
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
```

- This fetches the latest version of the Lunar Client's launcher from the 'latest.yml' file. This information is used in handleRequest.

### `handleRequest`

```javascript
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
```

- This function manages incoming requests and acts as a proxy for Lunar Client's API.
- It checks if the 'host' header in the incoming request matches the expected 'PROXY' constant. If not, it responds with a '403 Access Denied' error.
- It then calls fetchLatestLauncherVersion to obtain the latest launcher version.
- It sends a POST request to the Lunar Client API.
- If the request succeeds, it returns the response from the Lunar Client API.
- If the request fails, it responds with a '500 Internal Server Error' and logs the error for debugging purposes.
