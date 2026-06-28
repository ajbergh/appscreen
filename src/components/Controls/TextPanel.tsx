/**
 * Text overlay editor for headline and subheadline content.
 *
 * Text settings are stored per screenshot with language-keyed values and an
 * optional per-language layout map. This panel edits the selected language's
 * text, typography, style toggles, layout, and per-field translation modal.
 */
import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { FontPicker } from '../UI/FontPicker';
import { TranslateModal } from '../Modals/AllModals';

/**
 * Renders headline/subheadline controls and text-layout controls.
 */
export function TextPanel() {
  const currentScreenshot = useAppStore((s) => s.getCurrentScreenshot());
  const setTextSetting = useAppStore((s) => s.setTextSetting);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const screenshots = useAppStore((s) => s.screenshots);
  const currentLanguage = useAppStore((s) => s.currentLanguage);

  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const [translateTarget, setTranslateTarget] = useState<'headline' | 'subheadline'>('headline');

  const text = currentScreenshot?.text || {
    headlineEnabled: true, headlines: { en: '' }, headlineLanguages: ['en'],
    currentHeadlineLang: 'en', headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
    headlineSize: 100, headlineWeight: '600', headlineItalic: false,
    headlineUnderline: false, headlineStrikethrough: false, headlineColor: '#ffffff',
    perLanguageLayout: false,
    languageSettings: { en: { headlineSize: 100, subheadlineSize: 50, position: 'top', offsetY: 12, lineHeight: 110 } },
    currentLayoutLang: 'en', position: 'top', offsetY: 12, lineHeight: 110,
    subheadlineEnabled: false, subheadlines: { en: '' }, subheadlineLanguages: ['en'],
    currentSubheadlineLang: 'en', subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
    subheadlineSize: 50, subheadlineWeight: '400', subheadlineItalic: false,
    subheadlineUnderline: false, subheadlineStrikethrough: false,
    subheadlineColor: '#ffffff', subheadlineOpacity: 70,
  };

  const headlineLang = text.currentHeadlineLang || 'en';
  const subheadlineLang = text.currentSubheadlineLang || 'en';
  const currentHeadline = text.headlines?.[headlineLang] || '';
  const currentSubheadline = text.subheadlines?.[subheadlineLang] || '';

  const globalLayout = {
    headlineSize: text.headlineSize || 100,
    subheadlineSize: text.subheadlineSize || 50,
    position: text.position || 'top',
    offsetY: typeof text.offsetY === 'number' ? text.offsetY : 12,
    lineHeight: text.lineHeight || 110,
  };

  /**
   * Mirrors the legacy layout-language selection rules.
   */
  const getTextLayoutLanguage = () => {
    if (text.currentLayoutLang) return text.currentLayoutLang;
    if (text.headlineEnabled !== false) return headlineLang;
    if (text.subheadlineEnabled) return subheadlineLang;
    return headlineLang || subheadlineLang || 'en';
  };

  const layoutLang = getTextLayoutLanguage();

  /**
   * Reads or derives a per-language layout object without mutating current state.
   */
  const getLanguageLayout = (lang: string) => (
    text.languageSettings?.[lang]
    || text.languageSettings?.[text.currentLayoutLang]
    || text.languageSettings?.[headlineLang]
    || text.languageSettings?.en
    || globalLayout
  );

  const headlineLayout = text.perLanguageLayout ? getLanguageLayout(headlineLang) : globalLayout;
  const subheadlineLayout = text.perLanguageLayout ? getLanguageLayout(subheadlineLang) : globalLayout;
  const layoutSettings = text.perLanguageLayout ? getLanguageLayout(layoutLang) : globalLayout;

  const writeTextSettings = (updates: Partial<typeof text>) => {
    updateScreenshot(selectedIndex, { text: { ...text, ...updates } });
  };

  /**
   * Writes layout settings either globally or into the legacy-compatible
   * language bucket for the edited control.
   */
  const setLangSetting = (key: string, value: unknown) => {
    if (text.perLanguageLayout) {
      const targetLang = key === 'headlineSize'
        ? headlineLang
        : key === 'subheadlineSize'
          ? subheadlineLang
          : layoutLang;
      const newLangSettings = { ...text.languageSettings };
      newLangSettings[targetLang] = { ...getLanguageLayout(targetLang), [key]: value };
      writeTextSettings({ languageSettings: newLangSettings, currentLayoutLang: targetLang });
    } else {
      setTextSetting(key, value);
    }
  };

  const effectivePosition = layoutSettings.position;
  const effectiveOffsetY = layoutSettings.offsetY;
  const effectiveLineHeight = layoutSettings.lineHeight;
  const effectiveHeadlineSize = headlineLayout.headlineSize;
  const effectiveSubheadlineSize = subheadlineLayout.subheadlineSize;

  return (
    <div className="tab-content active" id="tab-text">
      {/* Headline */}
      <div className="control-group">
        <div className="toggle-row">
          <label className="control-label">Headline</label>
          <div
            className={`toggle${text.headlineEnabled !== false ? ' active' : ''}`}
            onClick={() => setTextSetting('headlineEnabled', !(text.headlineEnabled !== false))}
          >
            <div className="toggle-handle" />
          </div>
        </div>

        {text.headlineEnabled !== false && (
          <>
            <div className="textarea-with-button">
              <textarea
                value={currentHeadline}
                onChange={(e) => {
                  setTextSetting('headlines', { ...text.headlines, [headlineLang]: e.target.value });
                }}
                placeholder="Enter headline..."
                rows={2}
                className="text-input"
              />
              <button
                className="magic-translate-btn"
                title="Translate to all languages"
                onClick={() => { setTranslateTarget('headline'); setTranslateModalOpen(true); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M22 22l-5-10-5 10M14 18h6" />
                </svg>
              </button>
            </div>

            <div className="control-row">
              <label>Font</label>
              <FontPicker value={text.headlineFont} onChange={(v) => setTextSetting('headlineFont', v)} />
            </div>

            <div className="control-row">
              <label>Size</label>
              <input
                type="number" min="12" max="300"
                value={effectiveHeadlineSize}
                onChange={(e) => setLangSetting('headlineSize', parseInt(e.target.value))}
              />
              <span className="control-value">{effectiveHeadlineSize}px</span>
            </div>

            <div className="control-row">
              <label>Weight</label>
              <select value={text.headlineWeight} onChange={(e) => setTextSetting('headlineWeight', e.target.value)}>
                <option value="300">Light</option>
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">Extra Bold</option>
                <option value="900">Black</option>
              </select>
            </div>

            <div className="control-row">
              <label>Color</label>
              <input type="color" value={text.headlineColor}
                onChange={(e) => setTextSetting('headlineColor', e.target.value)} className="color-input-small" />
            </div>

            <div className="btn-group small" id="headline-style">
              <button className={text.headlineItalic ? 'active' : ''} onClick={() => setTextSetting('headlineItalic', !text.headlineItalic)}><em>I</em></button>
              <button className={text.headlineUnderline ? 'active' : ''} onClick={() => setTextSetting('headlineUnderline', !text.headlineUnderline)}><u>U</u></button>
              <button className={text.headlineStrikethrough ? 'active' : ''} onClick={() => setTextSetting('headlineStrikethrough', !text.headlineStrikethrough)}><s>S</s></button>
            </div>
          </>
        )}
      </div>

      {/* Subheadline */}
      <div className="control-group">
        <div className="toggle-row">
          <label className="control-label">Subheadline</label>
          <div
            className={`toggle${text.subheadlineEnabled ? ' active' : ''}`}
            onClick={() => setTextSetting('subheadlineEnabled', !text.subheadlineEnabled)}
          >
            <div className="toggle-handle" />
          </div>
        </div>

        {text.subheadlineEnabled && (
          <>
            <div className="textarea-with-button">
              <textarea
                value={currentSubheadline}
                onChange={(e) => {
                  setTextSetting('subheadlines', { ...text.subheadlines, [subheadlineLang]: e.target.value });
                }}
                placeholder="Enter subheadline..."
                rows={2}
                className="text-input"
              />
              <button
                className="magic-translate-btn"
                title="Translate to all languages"
                onClick={() => { setTranslateTarget('subheadline'); setTranslateModalOpen(true); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3M22 22l-5-10-5 10M14 18h6" />
                </svg>
              </button>
            </div>

            <div className="control-row">
              <label>Font</label>
              <FontPicker value={text.subheadlineFont || text.headlineFont} onChange={(v) => setTextSetting('subheadlineFont', v)} />
            </div>

            <div className="control-row">
              <label>Size</label>
              <input
                type="number" min="12" max="200"
                value={effectiveSubheadlineSize}
                onChange={(e) => setLangSetting('subheadlineSize', parseInt(e.target.value))}
              />
              <span className="control-value">{effectiveSubheadlineSize}px</span>
            </div>

            <div className="control-row">
              <label>Weight</label>
              <select value={text.subheadlineWeight || '400'} onChange={(e) => setTextSetting('subheadlineWeight', e.target.value)}>
                <option value="300">Light</option>
                <option value="400">Regular</option>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">Extra Bold</option>
                <option value="900">Black</option>
              </select>
            </div>

            <div className="control-row">
              <label>Color</label>
              <input type="color" value={text.subheadlineColor}
                onChange={(e) => setTextSetting('subheadlineColor', e.target.value)} className="color-input-small" />
            </div>

            <div className="control-row">
              <label>Opacity</label>
              <input type="range" min="0" max="100" value={text.subheadlineOpacity}
                onChange={(e) => setTextSetting('subheadlineOpacity', parseInt(e.target.value))} />
              <span className="control-value">{text.subheadlineOpacity}%</span>
            </div>

            <div className="btn-group small" id="subheadline-style">
              <button className={text.subheadlineItalic ? 'active' : ''} onClick={() => setTextSetting('subheadlineItalic', !text.subheadlineItalic)}><em>I</em></button>
              <button className={text.subheadlineUnderline ? 'active' : ''} onClick={() => setTextSetting('subheadlineUnderline', !text.subheadlineUnderline)}><u>U</u></button>
              <button className={text.subheadlineStrikethrough ? 'active' : ''} onClick={() => setTextSetting('subheadlineStrikethrough', !text.subheadlineStrikethrough)}><s>S</s></button>
            </div>
          </>
        )}
      </div>

      {/* Per-language layout toggle */}
      <div className="control-group">
        <div className="toggle-row">
          <label className="control-label">Per-language layout</label>
          <div
            className={`toggle${text.perLanguageLayout ? ' active' : ''}`}
            onClick={() => setTextSetting('perLanguageLayout', !text.perLanguageLayout)}
          >
            <div className="toggle-handle" />
          </div>
        </div>
      </div>

      {/* Position */}
      <div className="control-group">
        <label className="control-label">Position</label>
        <div className="btn-group" id="text-position">
          {(['top', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              className={effectivePosition === pos ? 'active' : ''}
              onClick={() => setLangSetting('position', pos)}
            >
              {pos.charAt(0).toUpperCase() + pos.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">Offset Y</label>
        <div className="control-row">
          <input type="range" min="0" max="100" value={effectiveOffsetY}
            onChange={(e) => setLangSetting('offsetY', parseInt(e.target.value))} />
          <span className="control-value">{effectiveOffsetY}%</span>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">Line Height</label>
        <div className="control-row">
          <input type="range" min="80" max="250" value={effectiveLineHeight}
            onChange={(e) => setLangSetting('lineHeight', parseInt(e.target.value))} />
          <span className="control-value">{effectiveLineHeight}%</span>
        </div>
      </div>

      {/* Real Translate Modal */}
      <TranslateModal
        isOpen={translateModalOpen}
        onClose={() => setTranslateModalOpen(false)}
        target={translateTarget}
        screenshots={screenshots}
        selectedIndex={selectedIndex}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}
