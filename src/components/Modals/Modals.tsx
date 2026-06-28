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
        <h3>About App Store Screenshot Generator</h3>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
          <p>A free, open-source tool for creating beautiful App Store screenshots with customizable backgrounds, text overlays, and 3D device mockups.</p>
          <p style={{ marginTop: '8px' }}>
            <strong>Built by <a href="https://yuzuhub.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>YuzuHub</a></strong> — We build smart AI products in Düsseldorf, Germany.
          </p>
          <p style={{ marginTop: '8px' }}>
            <strong>License:</strong> MIT License
          </p>
          <p style={{ marginTop: '8px' }}>
            <strong>Credits:</strong>
          </p>
          <ul style={{ marginLeft: '16px', marginTop: '4px' }}>
            <li>iPhone 15 Pro Max 3D Model by MajdyModels (CC BY 4.0)</li>
            <li>Samsung Galaxy S25 Ultra 3D Model by mistJS (CC BY 4.0)</li>
          </ul>
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
    name: 'Claude (Anthropic)',
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
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview ($$$)' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview ($$)' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite ($)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ($$)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro ($$$)' },
    ],
    defaultModel: 'gemini-2.5-flash',
  },
} as const;

export { LLM_PROVIDERS };

// ===== Settings Modal =====
/**
 * Lets users choose theme and AI provider settings. API keys and model choices
 * are stored locally in the browser and read by the AI workflow modals.
 */
export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  const [theme, setTheme] = useState(localStorage.getItem('themePreference') || 'dark');
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

  if (!isOpen) return null;

  /**
   * Persists theme, selected provider, provider API keys, and model IDs. The key
   * validation here is prefix-based only; provider APIs still perform final
   * validation when a translation/generation request runs.
   */
  const handleSave = () => {
    // Save theme.
    localStorage.setItem('themePreference', theme);
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
    } else {
      document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

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
          newStatus[provider] = '✓ API key saved';
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '95%' }}>
        <h3>Settings</h3>

        {/* Theme */}
        <div className="control-group">
          <label className="control-label">Theme</label>
          <div className="btn-group">
            {(['dark', 'light', 'auto'] as const).map((t) => (
              <button key={t} className={theme === t ? 'active' : ''} onClick={() => setTheme(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* AI Provider */}
        <div className="control-group">
          <label className="control-label">AI Provider (for translations)</label>
          <div className="btn-group">
            {(Object.keys(LLM_PROVIDERS) as Array<keyof typeof LLM_PROVIDERS>).map((p) => (
              <button key={p} className={aiProvider === p ? 'active' : ''} onClick={() => setAiProvider(p)}>
                {p === 'anthropic' ? 'Claude' : p === 'openai' ? 'OpenAI' : 'Google'}
              </button>
            ))}
          </div>
        </div>

        {/* Per-provider API key and model */}
        <div className="control-group" style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px' }}>
          <label className="control-label" style={{ marginBottom: '10px', display: 'block' }}>
            {curProvider.name} — API Key
          </label>
          <input
            type="password"
            value={apiKeys[aiProvider] || ''}
            onChange={(e) => setApiKeys((prev) => ({ ...prev, [aiProvider]: e.target.value }))}
            placeholder={`Starts with ${curProvider.keyPrefix}...`}
            className="modal-input"
            style={{ marginBottom: '8px' }}
          />
          {keyStatus[aiProvider] && (
            <p style={{ fontSize: '11px', color: keyStatus[aiProvider].startsWith('✓') ? '#30d158' : '#ff453a', marginBottom: '8px' }}>
              {keyStatus[aiProvider]}
            </p>
          )}
          <label className="control-label" style={{ marginBottom: '6px', display: 'block', marginTop: '8px' }}>Model</label>
          <select
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

        <div className="modal-buttons">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ===== Languages Modal =====
/**
 * Manages the language list for the current project and removes language-scoped
 * images/text/defaults when a language is deleted.
 */
export function LanguagesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const setCurrentLanguage = useAppStore((s) => s.setCurrentLanguage);
  const screenshots = useAppStore((s) => s.screenshots);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const defaults = useAppStore((s) => s.defaults);

  const [languages, setLanguages] = useState<string[]>(projectLanguages);

  if (!isOpen) return null;

  const allLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'en-gb', name: 'English (UK)', flag: '🇬🇧' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'pt-br', name: 'Portuguese (BR)', flag: '🇧🇷' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'zh-tw', name: 'Chinese (TW)', flag: '🇹🇼' },
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

  /**
   * Toggles a project language in local modal state. English is protected as the
   * baseline fallback language for screenshots and defaults.
   */
  const toggleLanguage = (code: string) => {
    if (code === 'en') return; // English is always present
    setLanguages(prev =>
      prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
    );
  };

  /**
   * Applies the modal language set to the app store and removes stale localized
   * image/text/default records for languages that were unchecked.
   */
  const handleDone = () => {
    const store = useAppStore.getState();
    const removedLangs = projectLanguages.filter(l => !languages.includes(l));

    // Clean up removed languages from all screenshots
    if (removedLangs.length > 0) {
      const newScreenshots = store.screenshots.map((screenshot) => {
        const updated = { ...screenshot };

        // Remove from localized images
        if (updated.localizedImages) {
          updated.localizedImages = { ...updated.localizedImages };
          removedLangs.forEach(lang => delete updated.localizedImages[lang]);
        }

        // Remove from text
        if (updated.text) {
          const text = { ...updated.text };
          removedLangs.forEach(lang => {
            if (lang !== 'en') {
              delete text.headlines?.[lang];
              delete text.subheadlines?.[lang];
              const hIdx = text.headlineLanguages?.indexOf(lang) ?? -1;
              if (hIdx > -1 && text.headlineLanguages) text.headlineLanguages = text.headlineLanguages.filter(l => l !== lang);
              const sIdx = text.subheadlineLanguages?.indexOf(lang) ?? -1;
              if (sIdx > -1 && text.subheadlineLanguages) text.subheadlineLanguages = text.subheadlineLanguages.filter(l => l !== lang);
              if (text.currentHeadlineLang === lang) text.currentHeadlineLang = 'en';
              if (text.currentSubheadlineLang === lang) text.currentSubheadlineLang = 'en';
            }
          });
          updated.text = text;
        }

        return updated;
      });
      const newDefaults = { ...defaults, text: { ...defaults.text } };
      removedLangs.forEach(lang => {
        delete newDefaults.text.headlines?.[lang];
        delete newDefaults.text.subheadlines?.[lang];
        delete newDefaults.text.languageSettings?.[lang];
        if (newDefaults.text.currentHeadlineLang === lang) newDefaults.text.currentHeadlineLang = 'en';
        if (newDefaults.text.currentSubheadlineLang === lang) newDefaults.text.currentSubheadlineLang = 'en';
        if (newDefaults.text.currentLayoutLang === lang) newDefaults.text.currentLayoutLang = 'en';
      });
      store.setState({ projectLanguages: languages, screenshots: newScreenshots, defaults: newDefaults, currentLanguage: languages.includes(currentLanguage) ? currentLanguage : 'en' });
    } else {
      store.setState({ projectLanguages: languages, currentLanguage: languages.includes(currentLanguage) ? currentLanguage : 'en' });
    }

    store.saveState();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <h3>Edit Languages</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Select languages for your project. You can add translations for each screenshot.
        </p>
        <div style={{ overflowY: 'auto', flex: 1, marginBottom: '16px' }}>
          {allLanguages.map((lang) => (
            <div
              key={lang.code}
              className={`language-option${languages.includes(lang.code) ? ' selected' : ''}`}
              onClick={() => toggleLanguage(lang.code)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                background: languages.includes(lang.code) ? 'var(--accent-subtle)' : 'transparent',
              }}
            >
              <span style={{ fontSize: '18px' }}>{lang.flag}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{lang.name}</span>
              {languages.includes(lang.code) && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <div className="modal-buttons">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
