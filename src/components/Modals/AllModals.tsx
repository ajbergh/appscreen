/**
 * Extended workflow modals used by the screenshot editor.
 *
 * This module contains AI-assisted translation/title flows, export progress,
 * language-specific image management, emoji selection, and icon selection. The
 * AI helpers call provider APIs directly from the browser using locally stored
 * user keys, matching the current client-only architecture.
 */
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { LLM_PROVIDERS } from './Modals';

const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English', 'en-gb': 'English (UK)', 'de': 'German', 'fr': 'French', 'es': 'Spanish',
  'it': 'Italian', 'pt': 'Portuguese', 'pt-br': 'Portuguese (Brazil)', 'nl': 'Dutch', 'ru': 'Russian',
  'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 'zh-tw': 'Chinese (Taiwan)', 'ar': 'Arabic',
  'hi': 'Hindi', 'tr': 'Turkish', 'pl': 'Polish', 'sv': 'Swedish', 'da': 'Danish',
  'no': 'Norwegian', 'fi': 'Finnish', 'th': 'Thai', 'vi': 'Vietnamese', 'id': 'Indonesian', 'uk': 'Ukrainian',
};

const LANGUAGE_FLAGS: Record<string, string> = {
  'en': '🇺🇸', 'en-gb': '🇬🇧', 'de': '🇩🇪', 'fr': '🇫🇷', 'es': '🇪🇸',
  'it': '🇮🇹', 'pt': '🇵🇹', 'pt-br': '🇧🇷', 'nl': '🇳🇱', 'ru': '🇷🇺',
  'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳', 'zh-tw': '🇹🇼', 'ar': '🇸🇦',
  'hi': '🇮🇳', 'tr': '🇹🇷', 'pl': '🇵🇱', 'sv': '🇸🇪', 'da': '🇩🇰',
  'no': '🇳🇴', 'fi': '🇫🇮', 'th': '🇹🇭', 'vi': '🇻🇳', 'id': '🇮🇩', 'uk': '🇺🇦',
};

/**
 * Closes a workflow modal on Escape while it is visible.
 */
function useEscapeKey(onClose: () => void, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);
}

/**
 * Sends a text-only prompt to the configured AI provider and returns the raw
 * response text. Authentication/model failures are normalized to AI_UNAVAILABLE
 * so callers can show consistent user-facing status.
 */
async function callTextProvider(provider: keyof typeof LLM_PROVIDERS, apiKey: string, model: string, prompt: string): Promise<string> {
  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => '');
      throw new Error(resp.status === 401 || resp.status === 403 ? 'AI_UNAVAILABLE' : `API request failed: ${resp.status}${errorBody ? ` - ${errorBody}` : ''}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || '';
  }
  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_completion_tokens: 16384, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => '');
      throw new Error(resp.status === 401 || resp.status === 403 ? 'AI_UNAVAILABLE' : `API request failed: ${resp.status}${errorBody ? ` - ${errorBody}` : ''}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) throw new Error(resp.status === 401 || resp.status === 403 || resp.status === 400 ? 'AI_UNAVAILABLE' : `API request failed: ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Extracts and parses the first JSON object from an AI response, tolerating
 * fenced code blocks because several models include them even when asked not to.
 */
function cleanJsonResponse(responseText: string): any {
  const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

// ===== Export Progress Modal =====
/**
 * Displays non-interactive progress while ZIP export renders canvases.
 */
export function ExportProgressModal({ isOpen, progress, status, detail }: {
  isOpen: boolean; progress: number; status: string; detail: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: 'center' }}>
        <h3>{status === 'Complete!' ? 'Complete!' : 'Exporting Screenshots'}</h3>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', margin: '20px 0 12px' }}>
          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '4px', width: `${progress}%`, transition: 'width 0.2s ease-out' }} />
        </div>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}>{status}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{detail}</p>
      </div>
    </div>
  );
}

// ===== Translate Modal =====
/**
 * Edits or AI-generates translations for one headline, subheadline, or overlay
 * text element on the selected screenshot.
 */
export function TranslateModal({ isOpen, onClose, target, elementId, screenshots, selectedIndex, currentLanguage }: {
  isOpen: boolean; onClose: () => void; target: 'headline' | 'subheadline' | 'element';
  elementId?: string;
  screenshots: any[]; selectedIndex: number; currentLanguage: string;
}) {
  useEscapeKey(onClose, isOpen);
  const [sourceLang, setSourceLang] = useState(currentLanguage);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [aiTranslating, setAiTranslating] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const saveState = useAppStore((s) => s.saveState);

  const screenshot = screenshots[selectedIndex];
  const selectedElement = target === 'element'
    ? screenshot?.elements?.find((el: any) => el.id === elementId)
    : null;
  const modalLanguages: string[] = target === 'headline'
    ? (screenshot?.text?.headlineLanguages?.length ? screenshot.text.headlineLanguages : projectLanguages)
    : target === 'subheadline'
      ? (screenshot?.text?.subheadlineLanguages?.length ? screenshot.text.subheadlineLanguages : projectLanguages)
      : projectLanguages;
  const targetLabel = target === 'element' ? 'Element Text' : target.charAt(0).toUpperCase() + target.slice(1);

  useEffect(() => {
    if (!isOpen) return;
    setSourceLang(modalLanguages[0] || currentLanguage || 'en');
  }, [isOpen, target, selectedIndex]);

  useEffect(() => {
    if (!isOpen || !screenshot) return;
    const currentText = target === 'headline'
      ? (screenshot.text.headlines?.[sourceLang] || '')
      : target === 'subheadline'
        ? (screenshot.text.subheadlines?.[sourceLang] || '')
        : (selectedElement?.texts?.[sourceLang] || selectedElement?.text || '');
    setTranslations({ [sourceLang]: currentText });
  }, [isOpen, sourceLang, target, screenshot, selectedElement]);

  if (!isOpen || !screenshot) return null;

  /**
   * Applies entered translations back to the selected screenshot or element and
   * persists the project.
   */
  const handleApply = () => {
    if (target === 'headline') {
      const newHeadlines = { ...screenshot.text.headlines };
      Object.entries(translations).forEach(([lang, text]) => {
        if (text) newHeadlines[lang] = text;
      });
      updateScreenshot(selectedIndex, { text: { ...screenshot.text, headlines: newHeadlines } });
    } else if (target === 'subheadline') {
      const newSubheadlines = { ...screenshot.text.subheadlines };
      Object.entries(translations).forEach(([lang, text]) => {
        if (text) newSubheadlines[lang] = text;
      });
      updateScreenshot(selectedIndex, { text: { ...screenshot.text, subheadlineEnabled: true, subheadlines: newSubheadlines } });
    } else if (selectedElement) {
      const newTexts = { ...(selectedElement.texts || {}) };
      Object.entries(translations).forEach(([lang, text]) => {
        if (text) newTexts[lang] = text;
      });
      const newElements = (screenshot.elements || []).map((el: any) =>
        el.id === selectedElement.id ? { ...el, text: newTexts[currentLanguage] || newTexts.en || el.text, texts: newTexts } : el
      );
      updateScreenshot(selectedIndex, { elements: newElements });
    }
    saveState();
    onClose();
  };

  /**
   * Requests translations for every target project language from the configured
   * AI provider and stages successful results in modal state for review.
   */
  const handleAiTranslate = async () => {
    const sourceText = translations[sourceLang];
    if (!sourceText) { setAiStatus('Please enter source text first'); return; }

    const provider = (localStorage.getItem('aiProvider') || 'anthropic') as keyof typeof LLM_PROVIDERS;
    const providerConfig = LLM_PROVIDERS[provider];
    if (!providerConfig) { setAiStatus('Unknown AI provider'); return; }

    const apiKey = localStorage.getItem(providerConfig.storageKey) || '';
    if (!apiKey) { setAiStatus('Please set your API key in Settings'); return; }

    const model = localStorage.getItem(providerConfig.modelStorageKey) || providerConfig.defaultModel;

    setAiTranslating(true);
    setAiStatus('Translating...');

    const targets = modalLanguages.filter(l => l !== sourceLang);
    if (targets.length === 0) {
      setAiTranslating(false);
      setAiStatus('Add more languages to translate to');
      return;
    }

    try {
      const targetLangNames = targets.map((lang) => `${LANGUAGE_NAMES[lang] || lang} (${lang})`).join(', ');
      const prompt = `You are a professional translator for App Store screenshot marketing copy. Translate this ${targetLabel} from ${LANGUAGE_NAMES[sourceLang] || sourceLang} to these languages: ${targetLangNames}.

Rules:
- Keep every translation concise, punchy, marketing-focused, and culturally natural.
- Keep roughly the same length as the source because it must fit on app screenshots.
- Preserve product names, placeholders, emoji, punctuation intent, and line breaks.
- Return only JSON. Do not include markdown or commentary.

Source:
${JSON.stringify(sourceText)}

Return ONLY a valid JSON object mapping language codes to translations, like:
{"de":"...","fr":"..."}`;
      const result = cleanJsonResponse(await callTextProvider(provider, apiKey, model, prompt));
      let completed = 0;
      targets.forEach((lang) => {
        if (result[lang]) {
          completed++;
          setTranslations(prev => ({ ...prev, [lang]: result[lang] }));
        }
      });
      setAiStatus(completed > 0 ? `Successfully translated to ${completed} languages!` : 'Translation failed. Check your API key.');
    } catch (e: any) {
      setAiStatus(e?.message === 'AI_UNAVAILABLE' ? 'Invalid API key. Update it in Settings.' : `Translation failed: ${e?.message || e}`);
    } finally {
      setAiTranslating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>Translate {targetLabel}</h3>

        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Source Language</label>
          <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}>
            {modalLanguages.map(l => <option key={l} value={l}>{LANGUAGE_FLAGS[l] || '🌐'} {LANGUAGE_NAMES[l] || l.toUpperCase()}</option>)}
          </select>
          <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', fontSize: '14px', color: 'var(--text-secondary)', minHeight: '40px', wordBreak: 'break-word' }}>
            {translations[sourceLang] || '(empty)'}
          </div>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
          {modalLanguages.filter(l => l !== sourceLang).map(lang => (
            <div key={lang} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500 }}>
                <span style={{ fontSize: '18px' }}>{LANGUAGE_FLAGS[lang] || '🌐'}</span>
                {LANGUAGE_NAMES[lang] || lang.toUpperCase()}
              </div>
              <textarea
                value={translations[lang] || ''}
                onChange={(e) => setTranslations(prev => ({ ...prev, [lang]: e.target.value }))}
                placeholder={`Translation for ${LANGUAGE_NAMES[lang] || lang}...`}
                rows={2}
                style={{ width: '100%', minHeight: '60px', resize: 'vertical', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleAiTranslate}
          disabled={aiTranslating}
          style={{ width: '100%', marginTop: '12px', padding: '12px 16px', background: aiTranslating ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: aiTranslating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: aiTranslating ? 0.6 : 1 }}
        >
          {aiTranslating ? '⟳' : '✨'} {aiTranslating ? 'Translating...' : 'Auto-translate with AI'}
        </button>
        {aiStatus && <p style={{ marginTop: '8px', fontSize: '12px', color: aiStatus.includes('fail') ? '#ff453a' : 'var(--text-secondary)', textAlign: 'center' }}>{aiStatus}</p>}

        <div className="modal-buttons" style={{ marginTop: '16px' }}>
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleApply}>Apply Translations</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Translates every populated headline and subheadline in the project from one
 * source language to the remaining project languages.
 */
export function TranslateAllModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  const screenshots = useAppStore((s) => s.screenshots);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const saveState = useAppStore((s) => s.saveState);
  const [sourceLang, setSourceLang] = useState(projectLanguages[0] || 'en');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  if (!isOpen) return null;

  const sourceItems = screenshots.flatMap((screenshot, index) => {
    const items: Array<{ id: string; index: number; field: 'headline' | 'subheadline'; text: string }> = [];
    const headline = screenshot.text?.headlines?.[sourceLang]?.trim();
    const subheadline = screenshot.text?.subheadlines?.[sourceLang]?.trim();
    if (headline) items.push({ id: `${index}:headline`, index, field: 'headline', text: headline });
    if (subheadline) items.push({ id: `${index}:subheadline`, index, field: 'subheadline', text: subheadline });
    return items;
  });
  const targetLangs = projectLanguages.filter((lang) => lang !== sourceLang);

  /**
   * Batches project text into one provider request, then distributes returned
   * translations back to each screenshot's localized text maps.
   */
  const handleTranslate = async () => {
    const provider = (localStorage.getItem('aiProvider') || 'anthropic') as keyof typeof LLM_PROVIDERS;
    const providerConfig = LLM_PROVIDERS[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey) || '';
    if (!apiKey) { setStatus('Add your API key in Settings first.'); return; }
    if (sourceItems.length === 0 || targetLangs.length === 0) { setStatus('No source text or target languages found.'); return; }
    const model = localStorage.getItem(providerConfig.modelStorageKey) || providerConfig.defaultModel;
    setWorking(true);
    setStatus(`Translating ${sourceItems.length} text(s)...`);
    try {
      const targetLangNames = targetLangs.map((lang) => `${LANGUAGE_NAMES[lang] || lang} (${lang})`).join(', ');
      const groupedItems = sourceItems.map((item) => {
        const screenshotNumber = item.index + 1;
        const fieldLabel = item.field === 'headline' ? 'headline' : 'subheadline';
        return `${item.id} (Screenshot ${screenshotNumber} ${fieldLabel}): ${JSON.stringify(item.text)}`;
      }).join('\n');
      const prompt = `You are a professional translator for App Store screenshot marketing copy. Translate the following texts from ${LANGUAGE_NAMES[sourceLang] || sourceLang} to these languages: ${targetLangNames}.

Rules:
- Keep translations concise, punchy, marketing-focused, and culturally natural.
- Keep each translation close to the source length because it must fit on app screenshots.
- Preserve product names, placeholders, emoji, punctuation intent, and line breaks.
- Return only JSON. Do not include markdown or commentary.

Return ONLY valid JSON in this exact shape:
{"0:headline":{"de":"...","fr":"..."}}

Source texts (${LANGUAGE_NAMES[sourceLang] || sourceLang}):
${groupedItems}`;
      const translations = cleanJsonResponse(await callTextProvider(provider, apiKey, model, prompt));
      const byScreenshot = new Map<number, any>();
      let appliedCount = 0;
      sourceItems.forEach((item) => {
        const translated = translations[item.id] || {};
        if (!byScreenshot.has(item.index)) byScreenshot.set(item.index, { ...screenshots[item.index].text });
        const text = byScreenshot.get(item.index);
        const key = item.field === 'headline' ? 'headlines' : 'subheadlines';
        text[key] = { ...(text[key] || {}) };
        targetLangs.forEach((lang) => {
          if (translated[lang]) {
            text[key][lang] = translated[lang];
            appliedCount++;
          }
        });
        if (item.field === 'subheadline') text.subheadlineEnabled = true;
      });
      byScreenshot.forEach((text, index) => updateScreenshot(index, { text }));
      saveState();
      setStatus(`Successfully translated ${appliedCount} text(s)!`);
      window.setTimeout(onClose, 700);
    } catch (err: any) {
      setStatus(err?.message === 'AI_UNAVAILABLE' ? 'Invalid or unavailable API key/model.' : `Translation failed: ${err?.message || err}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>Translate All Text</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Translate all headlines and subheadlines from one source language to every other project language.</p>
        <div className="control-group">
          <label className="control-label">Source Language</label>
          <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
            {projectLanguages.map((lang) => <option key={lang} value={lang}>{LANGUAGE_FLAGS[lang] || '🌐'} {LANGUAGE_NAMES[lang] || lang.toUpperCase()}</option>)}
          </select>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
          <div>Provider: {LLM_PROVIDERS[(localStorage.getItem('aiProvider') || 'anthropic') as keyof typeof LLM_PROVIDERS]?.name || 'AI'}</div>
          <div>Texts to translate: {sourceItems.length}</div>
          <div>Target languages: {targetLangs.length}</div>
        </div>
        {status && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{status}</p>}
        <div className="modal-buttons">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" disabled={working || sourceItems.length === 0 || targetLangs.length === 0 || projectLanguages.length < 2} onClick={handleTranslate}>{working ? 'Translating...' : 'Translate'}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Splits a base64 data URL into MIME type and payload for multimodal provider
 * APIs.
 */
function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return match ? { mimeType: match[1], base64: match[2] } : null;
}

/**
 * Sends screenshot images plus a text prompt to the configured multimodal AI
 * provider and returns the raw response text.
 */
async function callVisionProvider(provider: keyof typeof LLM_PROVIDERS, apiKey: string, model: string, images: Array<{ mimeType: string; base64: string }>, prompt: string): Promise<string> {
  if (provider === 'anthropic') {
    const content: any[] = images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.base64 } }));
    content.push({ type: 'text', text: prompt });
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content }] }),
    });
    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => '');
      throw new Error(resp.status === 401 || resp.status === 403 ? 'AI_UNAVAILABLE' : `API request failed: ${resp.status}${errorBody ? ` - ${errorBody}` : ''}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || '';
  }
  if (provider === 'openai') {
    const content: any[] = images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } }));
    content.push({ type: 'text', text: prompt });
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, max_completion_tokens: 4096, messages: [{ role: 'user', content }] }),
    });
    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => '');
      throw new Error(resp.status === 401 || resp.status === 403 ? 'AI_UNAVAILABLE' : `API request failed: ${resp.status}${errorBody ? ` - ${errorBody}` : ''}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }
  const parts: any[] = images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }));
  parts.push({ text: prompt });
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!resp.ok) throw new Error(resp.status === 401 || resp.status === 403 || resp.status === 400 ? 'AI_UNAVAILABLE' : `API request failed: ${resp.status}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Generates headline and subheadline copy by asking the configured vision model
 * to analyze the current screenshot images in sequence.
 */
export function MagicalTitlesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEscapeKey(onClose, isOpen);
  const screenshots = useAppStore((s) => s.screenshots);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const saveState = useAppStore((s) => s.saveState);
  const [sourceLang, setSourceLang] = useState(projectLanguages[0] || 'en');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  if (!isOpen) return null;

  /**
   * Collects language-appropriate screenshot images, calls the vision provider,
   * and writes returned title/subtitle pairs onto each screenshot.
   */
  const handleGenerate = async () => {
    const provider = (localStorage.getItem('aiProvider') || 'anthropic') as keyof typeof LLM_PROVIDERS;
    const providerConfig = LLM_PROVIDERS[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey) || '';
    if (!apiKey) { setStatus('Add your API key in Settings first.'); return; }
    if (screenshots.length === 0) { setStatus('Add screenshots before generating titles.'); return; }
    const model = localStorage.getItem(providerConfig.modelStorageKey) || providerConfig.defaultModel;
    const images = screenshots
      .map((screenshot) => {
        if (screenshot.localizedImages?.[sourceLang]?.src) return screenshot.localizedImages[sourceLang].src;
        for (const lang of projectLanguages) {
          if (screenshot.localizedImages?.[lang]?.src) return screenshot.localizedImages[lang].src;
        }
        return screenshot.image?.src || '';
      })
      .map(parseDataUrl)
      .filter(Boolean) as Array<{ mimeType: string; base64: string }>;
    if (!images.length) { setStatus('No screenshot images found.'); return; }
    setWorking(true);
    setStatus(`Analyzing ${images.length} screenshots...`);
    try {
      const langName = LANGUAGE_NAMES[sourceLang] || sourceLang;
      const prompt = `You are an expert App Store marketing copywriter. Analyze these ${images.length} app screenshots in order and create unique App Store screenshot titles in ${langName}.

Rules:
- Screenshot 1 should communicate the main value proposition.
- Each later screenshot should focus on the most visible feature or benefit in that image.
- Headlines must be very short, ideally 2-4 words.
- Subheadlines must be short, ideally 4-8 words.
- Avoid repeating the same idea across screenshots.
- Use natural, conversion-focused ${langName} marketing copy.
- If a subheadline is not useful for a screenshot, return an empty string for it.
- Return only JSON. Do not include markdown or commentary.

Return ONLY valid JSON:
{"0":{"headline":"...","subheadline":"..."}}
`;
      const titles = cleanJsonResponse(await callVisionProvider(provider, apiKey, model, images, prompt));
      screenshots.forEach((screenshot, index) => {
        const title = titles[String(index)];
        if (!title) return;
        const headline = typeof title.headline === 'string' ? title.headline.trim() : '';
        const subheadline = typeof title.subheadline === 'string' ? title.subheadline.trim() : '';
        updateScreenshot(index, {
          text: {
            ...screenshot.text,
            headlineEnabled: headline ? true : screenshot.text.headlineEnabled,
            subheadlineEnabled: subheadline ? true : screenshot.text.subheadlineEnabled,
            headlines: headline ? { ...(screenshot.text.headlines || {}), [sourceLang]: headline } : (screenshot.text.headlines || {}),
            subheadlines: subheadline ? { ...(screenshot.text.subheadlines || {}), [sourceLang]: subheadline } : (screenshot.text.subheadlines || {}),
          },
        });
      });
      saveState();
      setStatus('Titles applied.');
      onClose();
    } catch (err: any) {
      setStatus(err?.message === 'AI_UNAVAILABLE' ? 'Invalid or unavailable API key/model.' : `Generation failed: ${err?.message || err}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '430px', textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>Magical Titles</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Generate unique headline and subheadline copy for every screenshot using the selected AI provider.</p>
        <div className="control-group">
          <label className="control-label">Source Image Language</label>
          <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
            {projectLanguages.map((lang) => <option key={lang} value={lang}>{LANGUAGE_FLAGS[lang] || '🌐'} {LANGUAGE_NAMES[lang] || lang.toUpperCase()}</option>)}
          </select>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
          Screenshots: {screenshots.length}
        </div>
        {status && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{status}</p>}
        <div className="modal-buttons">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" disabled={working} onClick={handleGenerate}>{working ? 'Generating...' : 'Generate'}</button>
        </div>
      </div>
    </div>
  );
}

// ===== Screenshot Translations Modal =====
/**
 * Manages per-language source images for the selected screenshot.
 */
export function ScreenshotTranslationsModal({ isOpen, onClose, screenshots, selectedIndex }: {
  isOpen: boolean; onClose: () => void; screenshots: any[]; selectedIndex: number;
}) {
  useEscapeKey(onClose, isOpen);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const saveState = useAppStore((s) => s.saveState);
  const [uploadLang, setUploadLang] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const screenshot = screenshots[selectedIndex];

  if (!isOpen || !screenshot) return null;

  /**
   * Checks whether the screenshot has an image for a language, treating the base
   * screenshot image as the English fallback.
   */
  const hasImageForLang = (lang: string) => {
    return !!(screenshot.localizedImages?.[lang]?.image || (lang === 'en' && screenshot.image));
  };

  /**
   * Uploads or replaces a language-specific screenshot image.
   */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadLang) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const newLocalized = { ...screenshot.localizedImages };
        newLocalized[uploadLang] = { image: img, src: ev.target?.result as string, name: file.name };
        updateScreenshot(selectedIndex, { localizedImages: newLocalized });
        saveState();
        setUploadLang(null);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Removes a non-English localized screenshot image.
   */
  const handleRemoveImage = (lang: string) => {
    const newLocalized = { ...screenshot.localizedImages };
    delete newLocalized[lang];
    updateScreenshot(selectedIndex, { localizedImages: newLocalized });
    saveState();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'left' }}>
        <h3 style={{ textAlign: 'center' }}>Screenshot Translations</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
          Manage language-specific images for this screenshot.
        </p>

        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleUpload} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0', maxHeight: '350px', overflowY: 'auto' }}>
          {projectLanguages.map(lang => (
            <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: hasImageForLang(lang) ? '1px solid rgba(48, 209, 88, 0.3)' : '1px solid var(--border-color)' }}>
              <div style={{ width: '40px', height: '56px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: hasImageForLang(lang) ? 'none' : '2px dashed var(--border-color)' }}>
                {hasImageForLang(lang) ? (
                  <img src={screenshot.localizedImages?.[lang]?.src || screenshot.image?.src} alt={lang} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Empty</span>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{LANGUAGE_FLAGS[lang] || '🌐'}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{LANGUAGE_NAMES[lang] || lang.toUpperCase()}</span>
              </div>
              <button onClick={() => setUploadLang(lang)} style={{ padding: '8px 14px', border: 'none', background: 'var(--accent)', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                {hasImageForLang(lang) ? 'Replace' : 'Upload'}
              </button>
              {hasImageForLang(lang) && lang !== 'en' && (
                <button onClick={() => handleRemoveImage(lang)} style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="modal-buttons">
          <button className="modal-btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ===== Emoji Picker =====
/**
 * Provides searchable emoji selection for decorative overlay elements. When the
 * bundled emoji data script is unavailable, it falls back to local category
 * arrays defined in this component.
 */
export function EmojiPicker({ isOpen, onClose, onSelect }: {
  isOpen: boolean; onClose: () => void; onSelect: (emoji: string, name?: string) => void;
}) {
  useEscapeKey(onClose, isOpen);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('popular');

  const EMOJI_CATEGORIES: Record<string, string[]> = {
    popular: ['⭐', '❤️', '🔥', '✨', '🎉', '👍', '🚀', '💯', '🎯', '💡', '🌟', '💪', '🎨', '🔥', '❤️', '😊', '🥳', '👏', '🙌', '💎'],
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
    objects: ['📱', '💻', '⌨️', '🖥️', '🖨️', '📷', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '💎', '🔑', '🗝️', '🔨', '⚒️', '🛠️', '⛏️', '🔧', '🔩', '⚙️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '🏺'],
    symbols: ['✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '◾', '◽', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🀄', '🎴'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦄', '🐝', '🦋', '🐛', '🐌', '🐞', '🐢', '🐍', '🦎', '🦖', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍺', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🚏', '🛣️', '🛤️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🛥️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🧱', '🪨', '🪵', '🛖', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '♨️', '🎠', '🎡', '🎢', '💈', '🎪'],
    flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮',  '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺',  '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇸🇧', '🇸🇴', '🇿🇦', '🇬🇸', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼'],
  };

  const bundledEmojiData = (window as any).EMOJI_DATA as Record<string, Array<{ emoji: string; name: string; keywords?: string[] }>> | undefined;
  const emojiData = bundledEmojiData || Object.fromEntries(
    Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => {
      const seen = new Set<string>();
      return [
        cat,
        emojis
          .filter((emoji) => {
            if (seen.has(emoji)) return false;
            seen.add(emoji);
            return true;
          })
          .map((emoji) => ({ emoji, name: `${cat} emoji`, keywords: [cat] })),
      ];
    })
  );
  const filteredEmojis = search
    ? Object.values(emojiData).flat().filter((item) => {
        const query = search.toLowerCase();
        return item.emoji.includes(search)
          || item.name.toLowerCase().includes(query)
          || (item.keywords || []).some((keyword) => keyword.toLowerCase().includes(query));
      })
    : (emojiData[category] || []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <h3>Emoji Picker</h3>
        <input
          type="text"
          placeholder="Search emojis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', marginBottom: '12px' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {Object.keys(emojiData).map(cat => (
            <button key={cat} onClick={() => { setCategory(cat); setSearch(''); }} style={{ padding: '6px 12px', background: category === cat ? 'var(--accent)' : 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', color: category === cat ? 'white' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', overflowY: 'auto', flex: 1 }}>
          {filteredEmojis.map((item, i) => (
            <button key={`${item.emoji}-${i}`} title={item.name} onClick={() => { onSelect(item.emoji, item.name); onClose(); }} style={{ padding: '8px', fontSize: '20px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }}>
              {item.emoji}
            </button>
          ))}
        </div>
        <div className="modal-buttons" style={{ marginTop: '12px' }}>
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ===== Icon Picker =====
/**
 * Provides searchable Lucide icon selection for overlay elements. Icon name
 * lists prefer bundled globals and fall back to a curated popular list.
 */
export function IconPicker({ isOpen, onClose, onSelect }: {
  isOpen: boolean; onClose: () => void; onSelect: (iconName: string) => void;
}) {
  useEscapeKey(onClose, isOpen);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<'popular' | 'all'>('popular');
  const [icons, setIcons] = useState<string[]>([]);
  const [allIcons, setAllIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const POPULAR_ICONS = ['star', 'heart', 'zap', 'sun', 'moon', 'cloud', 'flame', 'droplet', 'eye', 'shield', 'crown', 'gem', 'trophy', 'gift', 'rocket', 'sparkles', 'check', 'x', 'plus', 'minus', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right', 'home', 'user', 'settings', 'search', 'bell', 'mail', 'phone', 'camera', 'image', 'video', 'music', 'play', 'pause', 'stop', 'skip-forward', 'skip-back', 'volume-2', 'wifi', 'bluetooth', 'battery', 'lock', 'unlock', 'key', 'map-pin', 'navigation', 'compass', 'globe', 'map', 'calendar', 'clock', 'watch', 'timer', 'alarm', 'download', 'upload', 'share', 'link', 'external-link', 'copy', 'clipboard', 'edit', 'trash', 'folder', 'file', 'file-text', 'book', 'bookmark', 'flag', 'tag', 'hash', 'at-sign', 'percent', 'divide', 'equal', 'info', 'alert-circle', 'alert-triangle', 'help-circle', 'check-circle', 'x-circle', 'plus-circle', 'minus-circle'];

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const popular = Array.isArray((window as any).LUCIDE_POPULAR) ? (window as any).LUCIDE_POPULAR as string[] : POPULAR_ICONS;
      const all = Array.isArray((window as any).LUCIDE_ALL) ? (window as any).LUCIDE_ALL as string[] : popular;
      setAllIcons(all);
      setIcons(category === 'popular' ? popular : all);
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, category]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredIcons = debouncedSearch
    ? (allIcons.length ? allIcons : icons).filter(i => i.toLowerCase().includes(debouncedSearch))
    : icons;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <h3>Icon Picker</h3>
        <input
          type="text"
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', marginBottom: '12px' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {(['popular', 'all'] as const).map((cat) => (
            <button key={cat} onClick={() => { setCategory(cat); setSearch(''); }} style={{ padding: '6px 12px', background: category === cat ? 'var(--accent)' : 'var(--bg-tertiary)', border: 'none', borderRadius: '6px', color: category === cat ? 'white' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
              {cat === 'popular' ? 'Popular' : 'All'}
            </button>
          ))}
        </div>
        {loading && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Loading icons...</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', overflowY: 'auto', flex: 1 }}>
          {filteredIcons.map((iconName) => (
            <button
              key={iconName}
              onClick={() => { onSelect(iconName); onClose(); }}
              title={iconName}
              style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}
            >
              <img
                src={`https://unpkg.com/lucide-static@latest/icons/${iconName}.svg`}
                alt={iconName}
                style={{ width: '24px', height: '24px', filter: 'invert(1)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{iconName}</span>
            </button>
          ))}
        </div>
        <div className="modal-buttons" style={{ marginTop: '12px' }}>
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
