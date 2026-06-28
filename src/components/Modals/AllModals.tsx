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
        <h3>Exporting Screenshots</h3>
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
    // Legacy applyTranslations writes every target value unconditionally (so a
    // field can be cleared), enables the subheadline path, and syncs element
    // display text via getElementText().
    if (target === 'headline') {
      const newHeadlines = { ...screenshot.text.headlines };
      Object.entries(translations).forEach(([lang, text]) => {
        newHeadlines[lang] = text;
      });
      updateScreenshot(selectedIndex, { text: { ...screenshot.text, headlines: newHeadlines } });
    } else if (target === 'subheadline') {
      const newSubheadlines = { ...screenshot.text.subheadlines };
      Object.entries(translations).forEach(([lang, text]) => {
        newSubheadlines[lang] = text;
      });
      updateScreenshot(selectedIndex, { text: { ...screenshot.text, subheadlineEnabled: true, subheadlines: newSubheadlines } });
    } else if (selectedElement) {
      const newTexts = { ...(selectedElement.texts || {}) };
      Object.entries(translations).forEach(([lang, text]) => {
        newTexts[lang] = text;
      });
      // Mirror legacy getElementText(el): current display language, then en,
      // then first non-empty value, then existing text.
      const displayText = newTexts[currentLanguage]
        || newTexts.en
        || Object.values(newTexts).find((v) => v)
        || selectedElement.text
        || '';
      const newElements = (screenshot.elements || []).map((el: any) =>
        el.id === selectedElement.id ? { ...el, text: displayText, texts: newTexts } : el
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

    const targets = modalLanguages.filter(l => l !== sourceLang);
    if (targets.length === 0) {
      setAiStatus('Add more languages to translate to');
      return;
    }

    setAiTranslating(true);
    setAiStatus(`Translating to ${targets.length} language(s) with ${providerConfig.name}...`);

    try {
      // Exact legacy aiTranslateAll prompt (app.js ~5366-5384).
      const targetLangNames = targets.map((lang) => `${LANGUAGE_NAMES[lang] || lang} (${lang})`).join(', ');
      const prompt = `You are a professional translator for App Store screenshot marketing copy. Translate the following text from ${LANGUAGE_NAMES[sourceLang] || sourceLang} to these languages: ${targetLangNames}.

The text is a short marketing headline/tagline for an app that must fit on a screenshot, so keep translations:
- SIMILAR LENGTH to the original - do NOT make it longer, as it must fit on screen
- Concise and punchy
- Marketing-focused and compelling
- Culturally appropriate for each target market
- Natural-sounding in each language

IMPORTANT: The translated text will be displayed on app screenshots with limited space. If the source text is short, the translation MUST also be short. Prioritize brevity over literal accuracy.

Source text (${LANGUAGE_NAMES[sourceLang] || sourceLang}):
"${sourceText}"

Respond ONLY with a valid JSON object mapping language codes to translations. Do not include any other text.
Example format:
{"de": "German translation", "fr": "French translation"}

Translate to these language codes: ${targets.join(', ')}`;
      const result = cleanJsonResponse(await callTextProvider(provider, apiKey, model, prompt));
      let completed = 0;
      targets.forEach((lang) => {
        if (result[lang]) {
          completed++;
          setTranslations(prev => ({ ...prev, [lang]: result[lang] }));
        }
      });
      setAiStatus(completed > 0 ? `✓ Translated to ${completed} language(s)` : 'Translation failed. Check your API key.');
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg === 'Failed to fetch') {
        setAiStatus('Connection failed. Check your API key in Settings.');
      } else if (msg === 'AI_UNAVAILABLE' || msg.includes('401') || msg.includes('403')) {
        setAiStatus('Invalid API key. Update it in Settings (gear icon).');
      } else {
        setAiStatus(`Translation failed: ${msg || e}`);
      }
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
        {aiStatus && <p style={{ marginTop: '8px', fontSize: '12px', color: (aiStatus.includes('fail') || aiStatus.includes('Invalid') || aiStatus.includes('Connection')) ? '#ff453a' : 'var(--text-secondary)', textAlign: 'center' }}>{aiStatus}</p>}

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

  // Legacy textsToTranslate ordering: per screenshot, headline first then
  // subheadline. The numeric position in this array is the response key the AI
  // returns translations under (legacy translations[index]).
  const sourceItems = screenshots.flatMap((screenshot, index) => {
    const items: Array<{ index: number; field: 'headline' | 'subheadline'; text: string }> = [];
    const headline = screenshot.text?.headlines?.[sourceLang]?.trim();
    const subheadline = screenshot.text?.subheadlines?.[sourceLang]?.trim();
    if (headline) items.push({ index, field: 'headline', text: headline });
    if (subheadline) items.push({ index, field: 'subheadline', text: subheadline });
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
    setStatus(`Sending to AI... (${sourceItems.length} texts to ${targetLangs.length} languages using ${providerConfig.name})`);
    try {
      // Exact legacy grouped prompt (app.js ~5758-5780). Response is keyed by the
      // numeric text index [N] shown in the context block.
      const targetLangNames = targetLangs.map((lang) => `${LANGUAGE_NAMES[lang] || lang} (${lang})`).join(', ');

      // Group texts by screenshot for a context-aware prompt, recording the
      // numeric index assigned to each headline/subheadline.
      const screenshotGroups: Record<number, { headline: string | null; subheadline: string | null; indices: { headline?: number; subheadline?: number } }> = {};
      sourceItems.forEach((item, i) => {
        if (!screenshotGroups[item.index]) {
          screenshotGroups[item.index] = { headline: null, subheadline: null, indices: {} };
        }
        screenshotGroups[item.index][item.field] = item.text;
        screenshotGroups[item.index].indices[item.field] = i;
      });

      let contextualTexts = '';
      Object.keys(screenshotGroups).map(Number).sort((a, b) => a - b).forEach((screenshotIdx) => {
        const group = screenshotGroups[screenshotIdx];
        contextualTexts += `\nScreenshot ${screenshotIdx + 1}:\n`;
        if (group.headline !== null) {
          contextualTexts += `  [${group.indices.headline}] Headline: "${group.headline}"\n`;
        }
        if (group.subheadline !== null) {
          contextualTexts += `  [${group.indices.subheadline}] Subheadline: "${group.subheadline}"\n`;
        }
      });

      const prompt = `You are a professional translator for App Store screenshot marketing copy. Translate the following texts from ${LANGUAGE_NAMES[sourceLang] || sourceLang} to these languages: ${targetLangNames}.

CONTEXT: These are marketing texts for app store screenshots. Each screenshot has a headline and/or subheadline that work together as a pair. The subheadline typically elaborates on or supports the headline. When translating, ensure:
- Headlines and subheadlines on the same screenshot remain thematically consistent
- Translations across all screenshots maintain a cohesive marketing voice
- SIMILAR LENGTH to the originals - do NOT make translations longer, as they must fit on screen
- Marketing-focused and compelling language
- Culturally appropriate for each target market
- Natural-sounding in each language

IMPORTANT: The translated text will be displayed on app screenshots with limited space. If the source text is short, the translation MUST also be short. Prioritize brevity over literal accuracy.

Source texts (${LANGUAGE_NAMES[sourceLang] || sourceLang}):
${contextualTexts}

Respond ONLY with a valid JSON object. The structure should be:
{
  "0": {"de": "German translation", "fr": "French translation", ...},
  "1": {"de": "German translation", "fr": "French translation", ...}
}

Where the keys (0, 1, etc.) correspond to the text indices [N] shown above.
Translate to these language codes: ${targetLangs.join(', ')}`;
      const translations = cleanJsonResponse(await callTextProvider(provider, apiKey, model, prompt));
      const byScreenshot = new Map<number, any>();
      let appliedCount = 0;
      sourceItems.forEach((item, index) => {
        const translated = translations[index] || translations[String(index)] || {};
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
      // Legacy uses a blocking success alert; keep the result visible rather
      // than auto-closing on a timer.
      setStatus(`Successfully translated ${appliedCount} text(s)!`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg === 'Failed to fetch') {
        setStatus('Connection failed. Check your API key in Settings.');
      } else if (msg === 'AI_UNAVAILABLE' || msg.includes('401') || msg.includes('403')) {
        setStatus('Invalid API key. Update it in Settings (gear icon).');
      } else {
        setStatus(`Translation failed: ${msg || err}`);
      }
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
        {status && <p style={{ fontSize: '12px', color: (status.includes('failed') || status.includes('Invalid') || status.includes('Connection')) ? '#ff453a' : 'var(--text-secondary)' }}>{status}</p>}
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
  const [progressStatus, setProgressStatus] = useState('');
  const [progressDetail, setProgressDetail] = useState('');

  if (!isOpen) return null;

  /**
   * Collects language-appropriate screenshot images, calls the vision provider,
   * and writes returned title/subtitle pairs onto each screenshot.
   */
  const handleGenerate = async () => {
    // Legacy pre-flight validation (magical-titles.js ~244-274): screenshots
    // first, then API key, both as blocking alerts.
    if (screenshots.length === 0) { setStatus('Please add some screenshots first.'); return; }
    const provider = (localStorage.getItem('aiProvider') || 'anthropic') as keyof typeof LLM_PROVIDERS;
    const providerConfig = LLM_PROVIDERS[provider];
    const apiKey = localStorage.getItem(providerConfig.storageKey) || '';
    if (!apiKey) { setStatus('Please configure your AI API key in Settings first.'); return; }
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
    if (!images.length) { setStatus('No screenshot images found. Please upload some screenshots first.'); return; }
    const langName = LANGUAGE_NAMES[sourceLang] || sourceLang;
    setWorking(true);
    setStatus('');
    // MF-4: phased progress overlay mirroring legacy updateStatus() calls.
    setProgressStatus('Sending screenshots to AI...');
    setProgressDetail(`Using ${providerConfig.name}`);
    try {
      // Exact legacy prompt (magical-titles.js ~318-346).
      const prompt = `You are an expert App Store marketing copywriter. Analyze these ${images.length} app screenshots and create compelling marketing titles.

The screenshots are shown in order (1 through ${images.length}). Study what the app does and identify:
1. The main purpose and value proposition
2. The user problem it solves
3. Key features visible in each screen

CRITICAL: Screenshot 1's headline MUST focus on the main value proposition - what problem does this app solve for users? This is the most important title.

LENGTH REQUIREMENTS - THIS IS VERY IMPORTANT:
- headline: VERY SHORT, maximum 2-4 words. Punchy, memorable, benefit-focused.
- subheadline: SHORT, maximum 4-8 words. Expands on the headline.

UNIQUENESS - VERY IMPORTANT:
- Each screenshot MUST have a UNIQUE headline and subheadline
- Do NOT repeat or reuse similar titles across screenshots
- Each title should highlight a DIFFERENT feature or benefit

Examples of good headlines: "Track Every Expense", "Sleep Better Tonight", "Never Forget Again"
Examples of good subheadlines: "Automatic expense categorization and insights", "Science-backed sleep improvement", "Smart reminders that actually work"

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
    "0": { "headline": "...", "subheadline": "..." },
    "1": { "headline": "...", "subheadline": "..." }
}

Where the keys are 0-indexed screenshot numbers.
Write all titles in ${langName}.`;
      const responseText = await callVisionProvider(provider, apiKey, model, images, prompt);
      setProgressStatus('Processing response...');
      setProgressDetail('Parsing generated titles');
      const titles = cleanJsonResponse(responseText);
      setProgressStatus('Applying titles...');
      setProgressDetail('Updating screenshots');
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
      setWorking(false);
      setProgressStatus('');
      setStatus(`Generated titles for ${Object.keys(titles).length} screenshots in ${langName}!`);
    } catch (err: any) {
      setWorking(false);
      setProgressStatus('');
      // Legacy error branches (magical-titles.js ~445-457).
      if (err?.message === 'AI_UNAVAILABLE') {
        setStatus('AI service unavailable. Please check your API key in Settings.');
      } else if (err instanceof SyntaxError) {
        setStatus('Failed to parse AI response. Please try again.');
      } else {
        setStatus(`Error generating titles: ${err?.message || err}`);
      }
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
        {status && <p style={{ fontSize: '12px', color: (status.includes('Error') || status.includes('Failed') || status.includes('unavailable') || status.includes('Please')) ? '#ff453a' : 'var(--text-secondary)' }}>{status}</p>}
        <div className="modal-buttons">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" disabled={working} onClick={handleGenerate}>{working ? 'Generating...' : 'Generate'}</button>
        </div>
      </div>
      {working && progressStatus && (
        <div className="modal-overlay visible" style={{ zIndex: 10001 }}>
          <div className="modal" style={{ textAlign: 'center', minWidth: '320px' }}>
            <h3 style={{ textAlign: 'center' }}>Generating Magical Titles...</h3>
            <div style={{ margin: '16px auto', width: '32px', height: '32px', border: '3px solid var(--bg-tertiary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>{progressStatus}</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: '4px 0 0' }}>{progressDetail}</p>
          </div>
        </div>
      )}
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
          Upload localized versions of this screenshot for each language.
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
    popular: ['⭐', '❤️', '🔥', '✨', '🎉', '👍', '🚀', '💯', '🎯', '💡', '🌟', '💪', '🎨', '😊', '🥳', '👏', '🙌', '💎'],
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
    objects: ['📱', '💻', '⌨️', '🖥️', '🖨️', '📷', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '💎', '🔑', '🗝️', '🔨', '⚒️', '🛠️', '⛏️', '🔧', '🔩', '⚙️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '🏺'],
    symbols: ['✅', '❌', '⭕', '❗', '❓', '‼️', '⁉️', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '▪️', '▫️', '◾', '◽', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🀄', '🎴'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦄', '🐝', '🦋', '🐛', '🐌', '🐞', '🐢', '🐍', '🦎', '🦖', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍺', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🛺', '🚲', '🛴', '🚏', '🛣️', '🛤️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '⛵', '🛶', '🚤', '🛳️', '⛴️', '🛥️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🧱', '🪨', '🪵', '🛖', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗽', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '♨️', '🎠', '🎡', '🎢', '💈', '🎪'],
    flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇮🇴', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮',  '🇰🇭', '🇨🇲', '🇨🇦', '🇮🇨', '🇨🇻', '🇧🇶', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇽', '🇨🇨', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇰', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺',  '🇳🇫', '🇰🇵', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇸🇧', '🇸🇴', '🇿🇦', '🇬🇸', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇵🇲', '🇻🇨', '🇸🇩', '🇸🇷', '🇸🇿', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼'],
  };

  const bundledEmojiData = (window as any).EMOJI_DATA as Record<string, Array<{ emoji: string; name: string; keywords?: string[] }>> | undefined;
  // Dedupe globally across categories so flattened search results never repeat
  // an emoji (e.g. 🔥/❤️ appearing in both popular and another category). The
  // first category an emoji appears in keeps it.
  const globallySeen = new Set<string>();
  const emojiData = bundledEmojiData || Object.fromEntries(
    Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => {
      return [
        cat,
        emojis
          .filter((emoji) => {
            if (globallySeen.has(emoji)) return false;
            globallySeen.add(emoji);
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
    // Legacy debounces icon search at 200ms (app.js ~8516).
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Resolve the effective theme to color the monochrome Lucide SVGs: the static
  // icons render as black strokes, so we only invert them when the app is in
  // dark mode (explicit data-theme="dark", or auto/OS dark preference).
  const isDarkTheme = (() => {
    if (typeof document === 'undefined') return true;
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  })();

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
                loading="lazy"
                style={{ width: '24px', height: '24px', filter: isDarkTheme ? 'invert(1)' : 'none' }}
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
