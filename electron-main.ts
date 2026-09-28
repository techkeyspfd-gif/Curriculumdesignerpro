import { app, BrowserWindow, Menu, dialog, protocol, net, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Why a custom app:// origin instead of http://localhost:<port>
//
// localStorage (where API key, student profiles, lessons, and everything else
// live) is scoped to the page ORIGIN. An http://localhost origin includes the
// port, so any change of port produces a fresh, empty storage bucket — which is
// exactly what happened: the app opened on a different port each launch and
// looked like it had wiped all saved data.
//
// The fix: always serve the UI from the constant origin `app://curriculum`.
// The API server still runs in-process on whatever port it can get, but the
// window never loads from that port — the app:// protocol handler proxies
// /api/* to it internally (main process → no CORS). The origin, and therefore
// all saved data, is now identical on every launch.
// ---------------------------------------------------------------------------
const APP_ORIGIN = 'app://curriculum';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
]);

let mainWindow: BrowserWindow;
let apiPort = 0;
let backendError = '';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json', '.txt': 'text/plain'
};

async function startBackend(): Promise<boolean> {
  process.env.NODE_ENV = 'production';
  process.env.PORT = '0'; // any free port — the app:// origin no longer depends on it
  try {
    const mod = require(path.join(__dirname, 'server.cjs'));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Server did not start within 15 seconds.')), 15000));
    apiPort = (await Promise.race([mod.ready, timeout])) as number;
    const res = await fetch(`http://localhost:${apiPort}/api/key-status`);
    if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
    return true;
  } catch (err: any) {
    backendError = err?.stack || err?.message || String(err);
    console.error('Failed to start backend:', backendError);
    return false;
  }
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    // Proxy API calls to the in-process Express server. This runs in the main
    // process, so there is no cross-origin restriction and no CORS to configure.
    if (pathname.startsWith('/api/')) {
      if (!apiPort) {
        return new Response(JSON.stringify({ error: 'The built-in server is not running.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
      const method = request.method;
      const hasBody = method !== 'GET' && method !== 'HEAD';
      try {
        return await net.fetch(`http://localhost:${apiPort}${pathname}${url.search}`, {
          method,
          headers: request.headers,
          body: hasBody ? await request.arrayBuffer() : undefined,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Server request failed.' }),
          { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Everything else is a static asset from the bundled dist folder.
    const rel = pathname === '/' || pathname === '' ? 'index.html' : pathname.replace(/^\/+/, '');
    let filePath = path.normalize(path.join(__dirname, rel));
    // Block path traversal outside dist; fall back to the SPA entry point.
    if (!filePath.startsWith(__dirname)) filePath = path.join(__dirname, 'index.html');
    try {
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
      });
    } catch {
      // Unknown path → serve index.html so the single-page app still loads.
      const html = await fs.promises.readFile(path.join(__dirname, 'index.html'));
      return new Response(new Uint8Array(html), { status: 200, headers: { 'Content-Type': MIME['.html'] } });
    }
  });
}

// ---------------------------------------------------------------------------
// Google sign-in for Drive backup (system-browser + loopback flow).
//
// Two earlier approaches both failed:
//   1. Firebase signInWithPopup from the app:// origin — Google only authorizes
//      http(s) domains, so the popup closed instantly (unauthorized_domain).
//   2. Running OAuth inside an embedded Electron BrowserWindow — Google blocks
//      sign-in in embedded webviews ("this browser or app may not be secure",
//      i.e. disallowed_useragent), and UA spoofing is both unreliable and
//      against Google's policy.
//
// The supported native-app flow is used instead: open the consent page in the
// user's real default browser via shell.openExternal, and catch the redirect on
// a one-shot HTTP server bound to the loopback address. This uses the OAuth 2.0
// Authorization Code flow with PKCE. It requires an OAuth client of type
// "Desktop app" (its client id + secret live in firebase-applet-config.json);
// Desktop clients accept http://127.0.0.1:<any-port> as a redirect with no
// pre-registration, which is why a random loopback port works.
// ---------------------------------------------------------------------------

const base64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

ipcMain.handle('google-oauth', async (_event, opts: { clientId: string; clientSecret: string; scopes: string }) => {
  const { clientId, clientSecret, scopes } = opts;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Drive backup isn’t set up yet. In Google Cloud Console create an OAuth ' +
      '“Desktop app” client, then paste its Client ID and secret into ' +
      'firebase-applet-config.json (desktopOAuthClientId / desktopOAuthClientSecret).'
    );
  }

  // PKCE: a random verifier and its SHA-256 challenge. Protects the auth code
  // in transit without needing to keep the client secret truly confidential.
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout;

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { server.close(); } catch { /* already closing */ }
      fn();
    };

    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        if (reqUrl.pathname !== '/') { res.writeHead(404); res.end(); return; }

        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        // Always show the user a friendly page in their browser first.
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Curriculum Pro</title></head>
          <body style="font-family:system-ui,sans-serif;text-align:center;padding:3rem 1.5rem;color:#111827">
          <h2 style="margin-bottom:.5rem">${code ? 'You’re signed in ✅' : 'Sign-in didn’t finish'}</h2>
          <p style="color:#6b7280">You can close this tab and return to Curriculum Pro.</p>
          </body></html>`);

        if (error) { done(() => reject(new Error(`Google sign-in failed: ${error}`))); return; }
        if (!code) return; // ignore stray requests (e.g. favicon)
        if (settled) return;

        const port = (server.address() as any).port;
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: `http://127.0.0.1:${port}`
          }).toString()
        });

        if (!tokenRes.ok) {
          let detail = '';
          try { detail = (await tokenRes.json())?.error_description || ''; } catch { /* ignore */ }
          done(() => reject(new Error(`Could not complete Google sign-in (${tokenRes.status}). ${detail}`.trim())));
          return;
        }
        const token = await tokenRes.json();
        done(() => resolve({ accessToken: token.access_token, expiresIn: token.expires_in || 3600 }));
      } catch (err: any) {
        done(() => reject(new Error(err?.message || 'Could not complete Google sign-in.')));
      }
    });

    server.on('error', (err) => done(() => reject(err)));

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${port}`,
        response_type: 'code',
        scope: scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'online',
        prompt: 'select_account'
      }).toString();
      shell.openExternal(authUrl);
    });

    // If the user never finishes in the browser, don't leave the port open.
    timer = setTimeout(() => {
      done(() => reject(new Error('Google sign-in timed out. Please try again.')));
    }, 5 * 60 * 1000);
  });
});

const createWindow = (backendOk: boolean) => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    mainWindow.loadURL(isDev);
    mainWindow.webContents.openDevTools();
  } else {
    // Always load from the constant app:// origin so saved data persists, even
    // if the backend failed (the UI still opens; AI calls return a clear error).
    if (!backendOk) {
      dialog.showErrorBox(
        'Curriculum Pro — backend failed to start',
        'The built-in server could not start, so AI generation will not work. ' +
        'Your saved data is safe. Try restarting the app.\n\n' +
        `Details:\n${backendError.slice(0, 900)}`
      );
    }
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
};

app.on('ready', async () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    createWindow(true);
    return;
  }
  const backendOk = await startBackend();
  registerAppProtocol();
  createWindow(backendOk);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow(apiPort !== 0);
  }
});

// Create application menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template as any));
