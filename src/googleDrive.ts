import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In the desktop app, Google sign-in runs in the Electron main process (the
// app:// origin cannot complete Firebase's popup flow); the preload script
// exposes this bridge. In a plain browser (dev server) it is absent and the
// Firebase popup flow is used instead.
declare global {
  interface Window {
    electronOAuth?: {
      signIn: (opts: { clientId: string; clientSecret: string; scopes: string }) => Promise<{ accessToken: string; expiresIn: number }>;
    };
  }
}

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

const hasValidToken = () => !!cachedAccessToken && Date.now() < tokenExpiresAt;

const clearToken = () => {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
};

// Desktop sign-in path: the main process runs the OAuth flow in the system
// browser and returns a Drive access token; the user's name/email is then
// fetched for display.
const electronSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  const clientId = (firebaseConfig as any).desktopOAuthClientId;
  const clientSecret = (firebaseConfig as any).desktopOAuthClientSecret;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Drive backup isn’t set up yet. A one-time setup is needed: create an OAuth ' +
      '“Desktop app” client in Google Cloud Console and add its ID and secret to the app config.'
    );
  }
  let result;
  try {
    result = await window.electronOAuth!.signIn({ clientId, clientSecret, scopes: DRIVE_SCOPES });
  } catch (err: any) {
    // IPC wraps rejections as "Error invoking remote method 'google-oauth': Error: <msg>"
    const msg = String(err?.message || err).replace(/^Error invoking remote method 'google-oauth':\s*(Error:\s*)?/, '');
    throw new Error(msg);
  }
  cachedAccessToken = result.accessToken;
  tokenExpiresAt = Date.now() + Math.max(result.expiresIn - 60, 60) * 1000;

  let user: any = { displayName: 'Google account', email: null, photoURL: null };
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${result.accessToken}` }
    });
    if (res.ok) {
      const info = await res.json();
      user = { displayName: info.name || info.email, email: info.email, photoURL: info.picture };
    }
  } catch { /* profile details are cosmetic; the backup works without them */ }
  return { user: user as User, accessToken: result.accessToken };
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    if (window.electronOAuth) {
      return await electronSignIn();
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    tokenExpiresAt = Date.now() + 55 * 60 * 1000; // Google OAuth tokens last ~1 hour
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return hasValidToken() ? cachedAccessToken : null;
};

// The OAuth access token lives only in memory and expires after ~1 hour, so it is
// gone after a page reload. For user-initiated actions we can transparently
// re-request it via the sign-in popup; automatic backups must not pop up, so they
// pass interactive=false and fail with a clear "reconnect" message instead.
const ensureAccessToken = async (interactive: boolean): Promise<string> => {
  if (hasValidToken()) return cachedAccessToken!;
  if (!interactive) {
    throw new Error('Your Google session expired. Open the Students tab and click “Back up now” to reconnect.');
  }
  const res = await googleSignIn();
  if (!res?.accessToken) {
    throw new Error('Could not obtain Google authorization.');
  }
  return res.accessToken;
};

// Turns a failed Drive API response into an Error carrying Google's real message,
// with hints for the most common project-configuration causes.
const driveError = async (res: Response, action: string): Promise<Error> => {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || JSON.stringify(body);
  } catch {
    try { detail = await res.text(); } catch { /* ignore */ }
  }
  if (res.status === 401) {
    clearToken();
    detail = detail || 'Authorization expired. Click “Back up now” to reconnect your Google account.';
  } else if (res.status === 403 && /disabled|has not been used|SERVICE_DISABLED|accessNotConfigured/i.test(detail)) {
    detail += ' — The Google Drive API is likely not enabled for this Firebase project (Google Cloud Console → APIs & Services → enable “Google Drive API”), or the OAuth consent screen is incomplete.';
  }
  return new Error(`${action} failed (${res.status}): ${detail || 'Unknown error'}`);
};

export const logout = async () => {
  await auth.signOut();
  clearToken();
};

const BACKUP_FILE_NAME = 'homeschool_planner_backup.json';

const findBackupFileId = async (token: string): Promise<string | null> => {
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILE_NAME}' and trashed=false&orderBy=modifiedTime desc`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!searchRes.ok) {
    throw await driveError(searchRes, 'Searching Google Drive');
  }
  const searchData = await searchRes.json();
  return searchData.files?.[0]?.id ?? null;
};

export const backupToGoogleDrive = async (data: any, interactive = false) => {
  const token = await ensureAccessToken(interactive);

  const fileId = await findBackupFileId(token);

  const boundary = 'foo_bar_baz';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const contentType = 'application/json';
  const fileData = JSON.stringify(data);

  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: contentType
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + contentType + '\r\n\r\n' +
    fileData +
    closeDelimiter;

  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    
  const method = fileId ? 'PATCH' : 'POST';

  const res = await fetch(endpoint, {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    throw await driveError(res, 'Backing up to Google Drive');
  }

  return await res.json();
};

// Returns the parsed backup payload, or null if no backup file exists yet.
export const restoreFromGoogleDrive = async (interactive = true): Promise<any | null> => {
  const token = await ensureAccessToken(interactive);

  const fileId = await findBackupFileId(token);
  if (!fileId) {
    return null;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw await driveError(res, 'Downloading the backup from Google Drive');
  }

  return await res.json();
};
