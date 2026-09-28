import React, { useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, Save, Trash2, Loader2, CheckCircle2, XCircle, ExternalLink, PlugZap, Info, Cpu, RefreshCw } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, getStoredModel, setStoredModel, postJson, getJson } from '../api';
import { Panel, SectionHeader, HelpCallout } from './ui';
import { helpSteps } from '../guideContent';

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string };
type GeminiModel = { id: string; label: string };
type ModelList = { models: GeminiModel[]; defaultModel: string };

export function Settings() {
  const [key, setKey] = useState(() => getStoredApiKey());
  const [showKey, setShowKey] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [hasEnvKey, setHasEnvKey] = useState<boolean | null>(null);

  const [model, setModel] = useState(() => getStoredModel());
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [modelsState, setModelsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modelsError, setModelsError] = useState('');

  const storedKey = getStoredApiKey();
  const dirty = key.trim() !== storedKey;

  useEffect(() => {
    fetch('/api/key-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => setHasEnvKey(d ? !!d.hasEnvKey : null))
      .catch(() => setHasEnvKey(null));
  }, []);

  // Ask Google which models this key can actually use. Re-runs after a key is
  // saved, since a different key can expose a different set.
  const loadModels = async () => {
    setModelsState('loading');
    setModelsError('');
    try {
      const data = await getJson<ModelList>('/api/models');
      setModels(data.models || []);
      setDefaultModel(data.defaultModel || '');
      setModelsState('ready');
    } catch (e: any) {
      setModelsError(e.message || 'Could not load the model list.');
      setModelsState('error');
    }
  };

  useEffect(() => { loadModels(); }, [storedKey]);

  const chooseModel = (id: string) => {
    setModel(id);
    setStoredModel(id);
  };

  const save = () => {
    setStoredApiKey(key);
    setSavedTick(true);
    setTest({ status: 'idle' });
    setTimeout(() => setSavedTick(false), 2500);
  };

  const remove = () => {
    setStoredApiKey('');
    setKey('');
    setTest({ status: 'idle' });
  };

  const testKey = async () => {
    const candidate = key.trim();
    if (!candidate) return;
    setTest({ status: 'testing' });
    try {
      await postJson<{ ok: boolean }>('/api/validate-key', { key: candidate });
      setTest({ status: 'ok', message: 'Key works — Google accepted a test request.' });
    } catch (e: any) {
      setTest({ status: 'fail', message: e.message || 'The key was rejected.' });
    }
  };

  const activeSource = storedKey
    ? 'Using the key saved on this device.'
    : hasEnvKey
      ? 'Using the server’s built-in key (from .env.local). You can leave this page as-is.'
      : hasEnvKey === false
        ? 'No key found anywhere — AI features will not work until you add one below.'
        : 'Checking key status…';

  const sourceTone = storedKey || hasEnvKey ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900';

  return (
    <div className="w-full space-y-6">
      <Panel>
        <SectionHeader
          icon={KeyRound}
          title="Settings — Gemini API Key"
          subtitle="The key that powers every AI feature (lessons, plans, test prep, analysis)"
          tint="amber"
        />
        <div className="mb-5"><HelpCallout id="settings" steps={helpSteps('settings')} /></div>

        {/* current status */}
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${sourceTone}`}>
          <Info className="w-5 h-5 shrink-0 mt-0.5 opacity-70" />
          <p><span className="font-semibold">Status:</span> {activeSource}</p>
        </div>

        {/* how to get a key */}
        <div className="mb-6 rounded-2xl bg-gray-50 border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-2">Where do I get a key? (free)</h3>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 marker:text-indigo-400 marker:font-semibold">
            <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:text-indigo-700 inline-flex items-center gap-1">Google AI Studio <ExternalLink className="w-3 h-3" /></a> and sign in with any Google account.</li>
            <li>Click <span className="font-semibold">“Create API key”</span> and copy the long string it gives you (it starts with <span className="font-mono text-xs bg-gray-100 rounded px-1">AIza</span>).</li>
            <li>Paste it below, click <span className="font-semibold">Test connection</span>, then <span className="font-semibold">Save</span>.</li>
          </ol>
          <p className="text-xs text-gray-400 mt-3">The free tier is plenty for daily homeschool use. Your key is stored only on this computer and is sent only to Google's Gemini API.</p>
        </div>

        {/* key input */}
        <label className="text-sm font-semibold text-gray-700">Your API key</label>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => { setKey(e.target.value); setTest({ status: 'idle' }); }}
              placeholder="Paste your key here, e.g. AIzaSy…"
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={testKey}
            disabled={!key.trim() || test.status === 'testing'}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 transition-colors font-semibold shadow-sm text-sm disabled:opacity-50"
          >
            {test.status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            {test.status === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          <button
            onClick={save}
            disabled={!dirty && !savedTick}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm text-sm disabled:opacity-50"
          >
            {savedTick ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedTick ? 'Saved' : 'Save'}
          </button>
          {storedKey && (
            <button
              onClick={remove}
              className="flex items-center gap-2 px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold text-sm"
            >
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          )}
        </div>

        {/* test result */}
        {test.status === 'ok' && (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> {test.message}{dirty ? ' Don’t forget to click Save.' : ''}
          </p>
        )}
        {test.status === 'fail' && (
          <p className="mt-3 flex items-start gap-2 text-sm font-medium text-red-700">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {test.message}
          </p>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          icon={Cpu}
          title="AI Model"
          subtitle="Which Gemini model generates your lessons, plans and analysis"
          tint="indigo"
        />

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
          <Info className="w-5 h-5 shrink-0 mt-0.5 opacity-50" />
          <p>
            This list comes straight from Google using your key, so it only shows models you can actually use.
            If lessons fail with a “high demand” or “model not found” error, switching to a different model here usually fixes it.
          </p>
        </div>

        <label htmlFor="model-select" className="text-sm font-semibold text-gray-700">Model</label>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <select
            id="model-select"
            value={model}
            onChange={(e) => chooseModel(e.target.value)}
            disabled={modelsState !== 'ready'}
            className="flex-1 min-w-[260px] px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium disabled:opacity-60"
          >
            <option value="">
              {defaultModel ? `Recommended default (${defaultModel})` : 'Recommended default'}
            </option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.label} — {m.id}</option>
            ))}
          </select>
          <button
            onClick={loadModels}
            disabled={modelsState === 'loading'}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-50 transition-colors font-semibold shadow-sm text-sm disabled:opacity-50"
            title="Re-check which models your key can use"
          >
            <RefreshCw className={`w-4 h-4 ${modelsState === 'loading' ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {modelsState === 'loading' && (
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Asking Google which models your key can use…
          </p>
        )}
        {modelsState === 'error' && (
          <p className="mt-3 flex items-start gap-2 text-sm font-medium text-red-700">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {modelsError}
          </p>
        )}
        {modelsState === 'ready' && (
          <p className="mt-3 text-sm text-gray-500">
            {model
              ? <>Saved. Every AI feature now uses <span className="font-semibold text-gray-700">{model}</span>.</>
              : <>Using the recommended default. Your choice saves automatically.</>}
          </p>
        )}
      </Panel>
    </div>
  );
}
