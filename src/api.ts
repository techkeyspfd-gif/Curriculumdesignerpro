const API_KEY_STORAGE = 'geminiApiKey';
const MODEL_STORAGE = 'geminiModel';

// The Gemini model picked in the Settings tab. Empty means "whatever the server
// defaults to", so the app keeps working if the stored id is ever retired.
export function getStoredModel(): string {
  try { return (localStorage.getItem(MODEL_STORAGE) || '').trim(); } catch { return ''; }
}

export function setStoredModel(model: string) {
  try {
    const trimmed = model.trim();
    if (trimmed) localStorage.setItem(MODEL_STORAGE, trimmed);
    else localStorage.removeItem(MODEL_STORAGE);
  } catch { /* storage unavailable — choice just won't persist */ }
}

// The user's own Gemini API key, saved from the Settings tab. It lives only on
// this device (localStorage) and is sent with each AI request; the server uses
// it when present and falls back to its own .env key otherwise. The packaged
// desktop app ships without a .env, so this is how the .exe gets a key.
export function getStoredApiKey(): string {
  try { return (localStorage.getItem(API_KEY_STORAGE) || '').trim(); } catch { return ''; }
}

export function setStoredApiKey(key: string) {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(API_KEY_STORAGE, trimmed);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch { /* storage unavailable — key just won't persist */ }
}

// Headers every AI request carries: the device's key and model choice, each
// omitted when unset so the server falls back to its own defaults.
function aiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const apiKey = getStoredApiKey();
  if (apiKey) headers['X-Gemini-Key'] = apiKey;
  const model = getStoredModel();
  if (model) headers['X-Gemini-Model'] = model;
  return headers;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: aiHeaders() });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed with status ${res.status}`);
  }
  if (data === null) {
    throw new Error('Received an invalid response from the server');
  }
  return data as T;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...aiHeaders() };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed with status ${res.status}`);
  }
  if (data === null) {
    throw new Error('Received an invalid response from the server');
  }
  return data as T;
}
