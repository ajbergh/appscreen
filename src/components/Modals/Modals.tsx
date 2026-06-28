/**
 * Core application modals for about text, settings, and language management.
 *
 * These dialogs persist small user preferences directly to localStorage and
 * update shared editor state through Zustand. Larger workflow modals, including
 * AI translation and pickers, live in `AllModals.tsx`.
 */
import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';

/**
 * Closes a modal on Escape while it is mounted and visible.
 */
function useEscapeKey(onClose: () => void, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);
}

// ===== About Modal =====
/**
 * Shows product, license, and asset-credit information.
 */
export function AboutModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-icon modal-icon-info" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
        </div>
        <h3>App Store Screenshot Generator</h3>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px', textAlign: 'center' }}>
          <p>A free vibe coded tool for creating beautiful App Store screenshots with customizable backgrounds, text overlays, and device frames.</p>
          <p style={{ marginTop: '8px' }}>
            Created by <a href="https://yuzuhub.com/en" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Stefan from yuzuhub.com</a>
          </p>
          <p style={{ marginTop: '8px' }}>
            This project is free and open source under the MIT License.
          </p>
          <p style={{ marginTop: '8px' }}>
            <a href="https://yuzu-hub.github.io/appscreen/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Live Version</a> ·{' '}
            <a href="https://github.com/YUZU-Hub/appscreen" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>GitHub Repo</a>
          </p>
        </div>
        <div className="modal-buttons">
          <button className="modal-btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// LLM provider config used by browser-side translation and title generation flows.
const LLM_PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    storageKey: 'claudeApiKey',
    modelStorageKey: 'anthropicModel',
    keyPrefix: 'sk-ant-',
    models: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 ($)' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 ($$)' },
      { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5 ($$$)' },
    ],
    defaultModel: 'claude-sonnet-4-5-20250929',
  },
  openai: {
    name: 'OpenAI (GPT)',
    storageKey: 'openaiApiKey',
    modelStorageKey: 'openaiModel',
    keyPrefix: 'sk-',
    models: [
      { id: 'gpt-5.1-2025-11-13', name: 'GPT-5.1 ($$$)' },
      { id: 'gpt-5-mini-2025-08-07', name: 'GPT-5 Mini ($$)' },
      { id: 'gpt-5-nano-2025-08-07', name: 'GPT-5 Nano ($)' },
    ],
    defaultModel: 'gpt-5-mini-2025-08-07',
  },
  google: {
    name: 'Google (Gemini)',
    storageKey: 'googleApiKey',
    modelStorageKey: 'googleModel',
    keyPrefix: 'AIza',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview) ($$)' },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview) ($$$)' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite ($)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ($$)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro ($$$)' },
    ],
    defaultModel: 'gemini-2.5-flash',
  },
} as const;

export { LLM_PROVIDERS };

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'en-gb', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'pt-br', name: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'zh-tw', name: 'Chinese (Taiwan)', flag: '🇹🇼' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
];

const LANGUAGE_LABELS = Object.fromEntries(LANGUAGE_OPTIONS.map((lang) => [lang.code, lang]));

const PROVIDER_UI: Record<keyof typeof LLM_PROVIDERS, { shortName: string; icon: string; description: string; helpUrl: string; helpLabel: string }> = {
  anthropic: {
    shortName: 'Claude',
    icon: '✦',
    description: 'Best for polished marketing copy and nuanced translation review.',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpLabel: 'Get your API key from Anthropic Console',
  },
  openai: {
    shortName: 'OpenAI',
    icon: '◎',
    description: 'Strong general-purpose translation and structured JSON output.',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpLabel: 'Get your API key from OpenAI Platform',
  },
  google: {
    shortName: 'Google',
    icon: '◆',
    description: 'Gemini models for translation and multimodal title generation.',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpLabel: 'Get your API key from Google AI Studio',
  },
};

// ===== Settings Modal =====
/**
 * Lets users choose theme and AI provider settings. API keys and model choices
 * are stored locally in the browser and read by the AI workflow modals.
 */
export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  const [theme, setTheme] = useState(localStorage.getItem('themePreference') || 'auto');
  const [aiProvider, setAiProvider] = useState<keyof typeof LLM_PROVIDERS>(
    (localStorage.getItem('aiProvider') as keyof typeof LLM_PROVIDERS) || 'anthropic'
  );
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(() => ({
    anthropic: localStorage.getItem('claudeApiKey') || '',
    openai: localStorage.getItem('openaiApiKey') || '',
    google: localStorage.getItem('googleApiKey') || '',
  }));
  const [models, setModels] = useState<Record<string, string>>(() => ({
    anthropic: localStorage.getItem('anthropicModel') || LLM_PROVIDERS.anthropic.defaultModel,
    openai: localStorage.getItem('openaiModel') || LLM_PROVIDERS.openai.defaultModel,
    google: localStorage.getItem('googleModel') || LLM_PROVIDERS.google.defaultModel,
  }));
  const [keyStatus, setKeyStatus] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    const status: Record<string, string> = {};
    (Object.keys(LLM_PROVIDERS) as Array<keyof typeof LLM_PROVIDERS>).forEach((provider) => {
      const config = LLM_PROVIDERS[provider];
      status[provider] = localStorage.getItem(config.storageKey) ? '✓ API key is saved' : '';
    });
    setKeyStatus(status);
  }, [isOpen]);

  if (!isOpen) return null;

  /**
   * Applies a theme preference to the document immediately, mirroring legacy
   * `applyTheme`: 'auto' clears `data-theme` so the OS media query drives the
   * palette; 'light'/'dark' set the attribute explicitly. Persistence happens
   * separately on Save.
   */
  const applyThemeLive = (preference: string) => {
    if (preference === 'light' || preference === 'dark') {
      document.documentElement.dataset.theme = preference;
    } else {
      delete document.documentElement.dataset.theme;
    }
  };

  /**
   * Persists theme, selected provider, provider API keys, and model IDs. The key
   * validation here is prefix-based only; provider APIs still perform final
   * validation when a translation/generation request runs.
   */
  const handleSave = () => {
    // Save theme.
    localStorage.setItem('themePreference', theme);
    applyThemeLive(theme);

    // Save provider.
    localStorage.setItem('aiProvider', aiProvider);

    // Save all API keys and models.
    const newStatus: Record<string, string> = {};
    let valid = true;
    (Object.keys(LLM_PROVIDERS) as Array<keyof typeof LLM_PROVIDERS>).forEach((provider) => {
      const config = LLM_PROVIDERS[provider];
      const key = apiKeys[provider]?.trim() || '';
      if (key) {
        if (key.startsWith(config.keyPrefix)) {
          localStorage.setItem(config.storageKey, key);
          newStatus[provider] = '✓ API key is saved';
        } else {
          newStatus[provider] = `Should start with ${config.keyPrefix}...`;
          if (provider === aiProvider) valid = false;
        }
      } else {
        localStorage.removeItem(config.storageKey);
        newStatus[provider] = '';
      }
      localStorage.setItem(config.modelStorageKey, models[provider]);
    });
    setKeyStatus(newStatus);
    if (valid) onClose();
  };

  const curProvider = LLM_PROVIDERS[aiProvider];
  const providerUi = PROVIDER_UI[aiProvider];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '95%' }}>
        <div className="modal-header">
          <h3 className="modal-title">Settings</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* AI Provider */}
        <div className="control-group">
          <label className="control-label">AI Provider (for translations)</label>
          <div className="btn-group">
            {(Object.keys(LLM_PROVIDERS) as Array<keyof typeof LLM_PROVIDERS>).map((p) => (
              <button key={p} className={aiProvider === p ? 'active' : ''} onClick={() => setAiProvider(p)}>
                {LLM_PROVIDERS[p].name}
              </button>
            ))}
          </div>
        </div>

        {/* Per-provider API key and model */}
        <div className="control-group" style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {providerUi.icon}
            </div>
            <div style={{ flex: 1 }}>
              <label className="control-label" style={{ marginBottom: '4px', display: 'block' }}>
                {curProvider.name} — API Key
              </label>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.4 }}>{providerUi.description}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <input
              type={showKeys[aiProvider] ? 'text' : 'password'}
              value={apiKeys[aiProvider] || ''}
              onChange={(e) => setApiKeys((prev) => ({ ...prev, [aiProvider]: e.target.value }))}
              placeholder={`Starts with ${curProvider.keyPrefix}...`}
              className="modal-input"
              style={{ marginBottom: 0, flex: 1 }}
            />
            <button
              type="button"
              className="settings-show-key"
              title="Show/hide key"
              aria-label="Show/hide key"
              onClick={() => setShowKeys((prev) => ({ ...prev, [aiProvider]: !prev[aiProvider] }))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          {keyStatus[aiProvider] && (
            <div className="settings-key-status" style={{ fontSize: '11px', color: keyStatus[aiProvider].includes('saved') ? '#30d158' : '#ff453a', marginBottom: '8px' }}>
              {keyStatus[aiProvider]}
            </div>
          )}
          <a href={providerUi.helpUrl} target="_blank" rel="noreferrer" className="settings-link" style={{ color: 'var(--accent)', fontSize: '12px', textDecoration: 'none' }}>
            {providerUi.helpLabel}
          </a>
          <label className="control-label" style={{ marginBottom: '6px', display: 'block', marginTop: '8px' }}>Model</label>
          <select
            className="settings-model-select"
            value={models[aiProvider] || curProvider.defaultModel}
            onChange={(e) => setModels((prev) => ({ ...prev, [aiProvider]: e.target.value }))}
            style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
          >
            {curProvider.models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            API key stored locally — never sent anywhere except the AI provider.
          </p>
        </div>

        {/* Appearance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>Appearance</span>
          <div className="btn-group" style={{ flex: '0 0 200px' }}>
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                className={theme === t ? 'active' : ''}
                onClick={() => { setTheme(t); applyThemeLive(t); }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-buttons">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

// ===== Languages Modal =====
/**
 * Manages the project's language list. Add/remove apply live through the store's
 * `addProjectLanguage`/`removeProjectLanguage` actions (matching legacy, where the
 * modal mutates immediately and Done just closes). The store handles cleanup of
 * language-scoped text/defaults and repointing the current language on removal.
 */
export function LanguagesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);

  const availableToAdd = LANGUAGE_OPTIONS.filter((lang) => !projectLanguages.includes(lang.code));

  if (!isOpen) return null;

  /**
   * Adds the chosen language live, mirroring legacy `addProjectLanguage`: the
   * store mutates the project immediately, then we persist. The Done button is
   * purely a close action because all changes apply as they are made.
   */
  const addLanguage = (code: string) => {
    if (!code || projectLanguages.includes(code)) return;
    const store = useAppStore.getState();
    store.addProjectLanguage(code);
    // addProjectLanguage does not persist on its own; save after mutating.
    store.saveState();
  };

  /**
   * Removes a language live, mirroring legacy `removeProjectLanguage`. The store
   * guards on `projectLanguages.length <= 1` and repoints the current language;
   * any language (including English) is removable when more than one remains.
   */
  const removeLanguage = (code: string) => {
    if (projectLanguages.length <= 1) return;
    const store = useAppStore.getState();
    store.removeProjectLanguage(code);
    // removeProjectLanguage does not persist on its own; save after mutating.
    store.saveState();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal languages-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 className="modal-title">Project Languages</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="modal-message">Manage the languages available for text in this project.</p>

        <div className="languages-list" style={{ overflowY: 'auto', flex: 1 }}>
          {projectLanguages.map((code) => {
            const lang = LANGUAGE_LABELS[code] || { code, name: code.toUpperCase(), flag: '🌐' };
            const isCurrent = code === currentLanguage;
            const canRemove = projectLanguages.length > 1;
            return (
              <div key={code} className="language-item">
                <span style={{ fontSize: '18px' }}>{lang.flag}</span>
                <span style={{ flex: 1 }}>{lang.name}</span>
                {isCurrent && <span className="current-badge">Current</span>}
                <button
                  className="remove-btn"
                  disabled={!canRemove}
                  onClick={() => removeLanguage(code)}
                  aria-label={`Remove ${lang.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        <div className="add-language-section">
          <select
            className="control-select"
            value=""
            onChange={(e) => { addLanguage(e.target.value); e.target.value = ''; }}
            disabled={availableToAdd.length === 0}
          >
            <option value="">Add a language...</option>
            {availableToAdd.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
            ))}
          </select>
        </div>

        <div className="modal-buttons">
          <button className="modal-btn primary" onClick={onClose} style={{ background: 'var(--accent)' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
