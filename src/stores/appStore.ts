/**
 * In-memory application state for the React screenshot generator.
 *
 * The store mirrors the legacy vanilla `state` shape closely enough for parity
 * and migration, while exposing explicit actions for React controls. It keeps
 * live `HTMLImageElement` objects in memory; `projectStore` is responsible for
 * converting those objects to serializable source strings before IndexedDB
 * writes.
 */
import { create } from 'zustand';
import type {
  AppState,
  Screenshot,
  BackgroundSettings,
  ScreenshotSettings,
  TextSettings,
  DefaultSettings,
  GradientStop,
} from '../types';
import { useProjectStore } from './projectStore';

// ===== Helper functions =====

const DEFAULT_3D_FRAME_COLORS: Record<string, string> = {
  iphone: 'natural',
  ipad: 'space-gray',
  samsung: 'gray',
};

/**
 * Produces a complete background settings object from partial or legacy data.
 *
 * Legacy projects may contain `imageFit: "fill"` or live `image` objects. The
 * normalized state stores `stretch` for fill behavior and preserves image source
 * strings while leaving live image hydration to project loading code.
 */
function normalizeBackgroundSettings(background: Partial<BackgroundSettings> | undefined): BackgroundSettings {
  const bg = background || {};
  const rawImageFit = (bg as any).imageFit;
  const imageFit = rawImageFit === 'fill' ? 'stretch' : (rawImageFit || 'cover');
  return {
    type: bg.type || 'gradient',
    gradient: {
      angle: bg.gradient?.angle ?? 135,
      stops: Array.isArray(bg.gradient?.stops) && bg.gradient.stops.length
        ? bg.gradient.stops.map((stop: GradientStop) => ({ ...stop }))
        : [
            { color: '#667eea', position: 0 },
            { color: '#764ba2', position: 100 },
          ],
    },
    solid: bg.solid || '#1a1a2e',
    image: bg.image || null,
    imageSrc: bg.imageSrc || bg.image?.src || null,
    imageFit,
    imageSpan: !!bg.imageSpan,
    imageBlur: bg.imageBlur || 0,
    overlayColor: bg.overlayColor || '#000000',
    overlayOpacity: bg.overlayOpacity || 0,
    noise: !!bg.noise,
    noiseIntensity: bg.noiseIntensity || 10,
  };
}

/**
 * Returns the default text style and localization settings for new screenshots.
 */
function getDefaultTextSettings(): TextSettings {
  return {
    headlineEnabled: true,
    headlines: { en: '' },
    headlineLanguages: ['en'],
    currentHeadlineLang: 'en',
    headlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
    headlineSize: 100,
    headlineWeight: '600',
    headlineItalic: false,
    headlineUnderline: false,
    headlineStrikethrough: false,
    headlineColor: '#ffffff',
    perLanguageLayout: false,
    languageSettings: {
      en: {
        headlineSize: 100,
        subheadlineSize: 50,
        position: 'top',
        offsetY: 12,
        lineHeight: 110,
      },
    },
    currentLayoutLang: 'en',
    position: 'top',
    offsetY: 12,
    lineHeight: 110,
    subheadlineEnabled: false,
    subheadlines: { en: '' },
    subheadlineLanguages: ['en'],
    currentSubheadlineLang: 'en',
    subheadlineFont: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
    subheadlineSize: 50,
    subheadlineWeight: '400',
    subheadlineItalic: false,
    subheadlineUnderline: false,
    subheadlineStrikethrough: false,
    subheadlineColor: '#ffffff',
    subheadlineOpacity: 70,
  };
}

/**
 * Returns all style defaults copied into newly uploaded or blank screenshots.
 */
function getDefaultSettings(): DefaultSettings {
  return {
    background: normalizeBackgroundSettings(undefined),
    screenshot: {
      scale: 70,
      y: 60,
      x: 50,
      rotation: 0,
      perspective: 0,
      cornerRadius: 24,
      use3D: false,
      device3D: 'iphone',
      rotation3D: { x: 0, y: 0, z: 0 },
      shadow: {
        enabled: true,
        color: '#000000',
        blur: 40,
        opacity: 30,
        x: 0,
        y: 20,
      },
      frame: {
        enabled: false,
        color: '#1d1d1f',
        width: 12,
        opacity: 100,
      },
    },
    text: getDefaultTextSettings(),
    elements: [],
    popouts: [],
  };
}

/**
 * Returns a concrete layout settings object from text-level defaults.
 */
function getBaseLanguageLayout(text: Partial<TextSettings>): TextSettings['languageSettings'][string] {
  return {
    headlineSize: text.headlineSize ?? 100,
    subheadlineSize: text.subheadlineSize ?? 50,
    position: text.position || 'top',
    offsetY: typeof text.offsetY === 'number' ? text.offsetY : 12,
    lineHeight: text.lineHeight ?? 110,
  };
}

/**
 * Adds a language to headline/subheadline maps and layout settings without
 * overwriting existing translations.
 */
function ensureTextLanguage(text: Partial<TextSettings> | undefined, lang: string, sourceLang = 'en'): TextSettings {
  const normalized = normalizeTextSettings(text);
  const sourceLayout = normalized.languageSettings[sourceLang]
    || normalized.languageSettings[normalized.currentLayoutLang]
    || normalized.languageSettings[normalized.currentHeadlineLang]
    || normalized.languageSettings.en
    || getBaseLanguageLayout(normalized);

  if (!normalized.headlineLanguages.includes(lang)) {
    normalized.headlineLanguages = [...normalized.headlineLanguages, lang];
  }
  if (!normalized.subheadlineLanguages.includes(lang)) {
    normalized.subheadlineLanguages = [...normalized.subheadlineLanguages, lang];
  }
  if (!(lang in normalized.headlines)) normalized.headlines[lang] = '';
  if (!(lang in normalized.subheadlines)) normalized.subheadlines[lang] = '';
  if (!normalized.languageSettings[lang]) {
    normalized.languageSettings[lang] = { ...sourceLayout };
  }
  return normalized;
}

/**
 * Merges partial or older text data with current defaults.
 *
 * This protects the UI and renderer from missing localization maps, selected
 * language ids, or per-language layout containers when loading older projects.
 */
function normalizeTextSettings(text: Partial<TextSettings> | undefined): TextSettings {
  const defaults = getDefaultTextSettings();
  if (!text) return defaults;
  const merged = { ...defaults, ...text };
  merged.headlines = merged.headlines || { en: '' };
  merged.headlineLanguages = merged.headlineLanguages || ['en'];
  merged.currentHeadlineLang = merged.currentHeadlineLang || merged.headlineLanguages[0] || 'en';
  merged.currentLayoutLang = merged.currentLayoutLang || merged.currentHeadlineLang || 'en';
  merged.subheadlines = merged.subheadlines || { en: '' };
  merged.subheadlineLanguages = merged.subheadlineLanguages || ['en'];
  merged.currentSubheadlineLang = merged.currentSubheadlineLang || merged.subheadlineLanguages[0] || 'en';
  if (!merged.languageSettings) merged.languageSettings = {};
  const languages = new Set([
    'en',
    ...merged.headlineLanguages,
    ...merged.subheadlineLanguages,
    ...Object.keys(merged.headlines),
    ...Object.keys(merged.subheadlines),
  ]);
  const sourceLayout = merged.languageSettings[merged.currentLayoutLang]
    || merged.languageSettings[merged.currentHeadlineLang]
    || merged.languageSettings.en
    || getBaseLanguageLayout(merged);
  languages.forEach((lang) => {
    if (!merged.headlineLanguages.includes(lang)) merged.headlineLanguages.push(lang);
    if (!merged.subheadlineLanguages.includes(lang)) merged.subheadlineLanguages.push(lang);
    if (!(lang in merged.headlines)) merged.headlines[lang] = '';
    if (!(lang in merged.subheadlines)) merged.subheadlines[lang] = '';
    if (!merged.languageSettings[lang]) merged.languageSettings[lang] = { ...sourceLayout };
  });
  return merged;
}

/**
 * Reads a dot-delimited nested property from an object.
 *
 * Kept for parity with the original setting-control model; currently useful for
 * future controls that need to inspect nested settings by path.
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Writes a dot-delimited nested setting path, creating missing containers.
 */
function setNestedValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Shallow-clones localized image metadata while preserving hydrated image refs.
 */
function cloneLocalizedImages(localizedImages: Screenshot['localizedImages'] = {}) {
  return Object.fromEntries(
    Object.entries(localizedImages).map(([lang, data]) => [lang, { ...data }])
  );
}

/**
 * Clones element defaults and assigns fresh ids for the new screenshot context.
 */
function cloneElements(elements: Screenshot['elements'] = []) {
  return elements.map((el) => ({ ...el, id: crypto.randomUUID(), image: el.image || null, texts: { ...(el.texts || {}) }, iconShadow: el.iconShadow ? { ...el.iconShadow } : undefined }));
}

/**
 * Clones popout defaults and assigns fresh ids for the new screenshot context.
 */
function clonePopouts(popouts: Screenshot['popouts'] = []) {
  return popouts.map((p) => ({ ...p, id: crypto.randomUUID(), shadow: { ...p.shadow }, border: { ...p.border } }));
}

/**
 * Normalizes persisted overlay elements without changing existing ids.
 *
 * Project loading needs stable ids for selection and React keys, while new
 * duplicates/default copies use `cloneElements` to create fresh ids.
 */
function normalizeElements(elements: Screenshot['elements'] = []) {
  return elements.map((el) => ({
    ...el,
    id: el.id || crypto.randomUUID(),
    image: el.image || null,
    texts: { ...(el.texts || {}) },
    iconShadow: el.iconShadow ? { ...el.iconShadow } : undefined,
  }));
}

/**
 * Normalizes persisted popouts without changing existing ids.
 *
 * Older projects can omit `shadow` or `border`; those objects are backfilled so
 * the popout inspector can read nested values without defensive checks.
 */
function normalizePopouts(popouts: Screenshot['popouts'] = []) {
  const shadowDefaults = {
    enabled: true,
    color: '#000000',
    blur: 30,
    opacity: 40,
    x: 0,
    y: 12,
  };
  const borderDefaults = {
    enabled: false,
    color: '#ffffff',
    width: 4,
    opacity: 100,
  };

  return popouts.map((p) => ({
    ...p,
    id: p.id || crypto.randomUUID(),
    shadow: { ...shadowDefaults, ...((p as any).shadow || {}) },
    border: { ...borderDefaults, ...((p as any).border || {}) },
  }));
}

/**
 * Backfills screenshot settings loaded from older project records.
 */
function normalizeScreenshotSettings(settings: Partial<ScreenshotSettings> | undefined): ScreenshotSettings {
  const defaults = getDefaultSettings().screenshot;
  const incoming = settings || {};
  const normalized = {
    ...defaults,
    ...incoming,
    rotation3D: { ...defaults.rotation3D, ...(incoming.rotation3D || {}) },
    shadow: { ...defaults.shadow, ...(incoming.shadow || {}) },
    frame: { ...defaults.frame, ...(incoming.frame || {}) },
  };
  if (normalized.use3D && !normalized.frameColor) {
    normalized.frameColor = DEFAULT_3D_FRAME_COLORS[normalized.device3D] || DEFAULT_3D_FRAME_COLORS.iphone;
  }
  return normalized;
}

/**
 * Backfills a screenshot record loaded from IndexedDB or a backup import.
 */
function normalizeScreenshotRecord(screenshot: Partial<Screenshot>): Screenshot {
  return {
    image: screenshot.image || null,
    name: screenshot.name || 'Untitled Screenshot',
    deviceType: screenshot.deviceType,
    localizedImages: cloneLocalizedImages(screenshot.localizedImages),
    background: normalizeBackgroundSettings(screenshot.background),
    screenshot: normalizeScreenshotSettings(screenshot.screenshot),
    text: normalizeTextSettings(screenshot.text),
    elements: normalizeElements(screenshot.elements),
    popouts: normalizePopouts(screenshot.popouts),
    overrides: { ...(screenshot.overrides || {}) },
  };
}

/**
 * Backfills default style settings loaded from older project records.
 */
function normalizeDefaultSettings(defaults: Partial<DefaultSettings> | undefined): DefaultSettings {
  const base = getDefaultSettings();
  return {
    background: normalizeBackgroundSettings(defaults?.background || base.background),
    screenshot: normalizeScreenshotSettings(defaults?.screenshot || base.screenshot),
    text: normalizeTextSettings(defaults?.text || base.text),
    elements: normalizeElements(defaults?.elements),
    popouts: normalizePopouts(defaults?.popouts),
  };
}

/**
 * Appends "(Copy)" before a filename extension for duplicated screenshots.
 */
function copyName(name: string): string {
  const match = name.match(/^(.*?)(\.[^.]+)?$/);
  const base = match?.[1] || name;
  const ext = match?.[2] || '';
  return `${base} (Copy)${ext}`;
}

// ===== Store Interface =====

interface AppStore extends AppState {
  // Screenshot actions
  addScreenshot: (screenshot: Screenshot) => void;
  updateScreenshot: (index: number, updates: Partial<Screenshot>) => void;
  deleteScreenshot: (index: number) => void;
  selectScreenshot: (index: number) => void;
  setSelectedElementId: (id: string | null) => void;
  duplicateScreenshot: (index: number) => void;
  reorderScreenshots: (fromIndex: number, toIndex: number) => void;

  // Background actions
  setBackground: (key: string, value: unknown) => void;
  setBackgroundSettings: (settings: Partial<BackgroundSettings>) => void;

  // Screenshot settings actions
  setScreenshotSetting: (key: string, value: unknown) => void;

  // Text actions
  setTextSetting: (key: string, value: unknown) => void;

  // Global settings
  setOutputDevice: (device: string) => void;
  setCustomDimensions: (width: number, height: number) => void;
  setCurrentLanguage: (lang: string) => void;
  addProjectLanguage: (lang: string) => void;
  setActiveTab: (tab: string) => void;

  // Getters
  getCurrentScreenshot: () => Screenshot | null;
  getBackground: () => BackgroundSettings;
  getScreenshotSettings: () => ScreenshotSettings;
  getTextSettings: () => TextSettings;

  // Reset
  resetState: () => void;
  setState: (state: Partial<AppState>) => void;

  // Style transfer
  transferStyle: (fromIndex: number, toIndex: number) => void;
  applyStyleToAll: (fromIndex: number) => void;

  // Set current screenshot as default
  setCurrentScreenshotAsDefault: () => void;

  // Persistence
  saveState: () => Promise<void>;
}

/**
 * Zustand store used by every editor panel and render surface.
 *
 * Actions mutate immutable slices only; persistence is explicit through
 * `saveState()` so `App.tsx` can debounce writes and project switching can
 * hydrate state without writing intermediate values.
 */
export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  screenshots: [],
  selectedIndex: 0,
  selectedElementId: null,
  transferTarget: null,
  outputDevice: 'iphone-6.9',
  currentLanguage: 'en',
  projectLanguages: ['en'],
  customWidth: 1290,
  customHeight: 2796,
  defaults: getDefaultSettings(),
  activeTab: 'background',

  // Screenshot actions
  addScreenshot: (screenshot) =>
    set((state) => ({
      screenshots: [...state.screenshots, screenshot],
      selectedIndex: state.screenshots.length === 0 ? 0 : state.selectedIndex,
      selectedElementId: null,
    })),

  updateScreenshot: (index, updates) =>
    set((state) => ({
      screenshots: state.screenshots.map((s, i) =>
        i === index ? { ...s, ...updates } : s
      ),
    })),

  deleteScreenshot: (index) =>
    set((state) => {
      const newScreenshots = state.screenshots.filter((_, i) => i !== index);
      const newSelectedIndex = Math.min(state.selectedIndex, newScreenshots.length - 1);
      return {
        screenshots: newScreenshots,
        selectedIndex: Math.max(0, newSelectedIndex),
        selectedElementId: null,
      };
    }),

  selectScreenshot: (index) => set({ selectedIndex: index, selectedElementId: null }),

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  duplicateScreenshot: (index) =>
    set((state) => {
      const original = state.screenshots[index];
      if (!original) return state;
      const clone: Screenshot = {
        image: original.image,
        name: copyName(original.name),
        deviceType: original.deviceType,
        localizedImages: cloneLocalizedImages(original.localizedImages),
        background: normalizeBackgroundSettings(original.background),
        screenshot: JSON.parse(JSON.stringify(original.screenshot)),
        text: normalizeTextSettings(JSON.parse(JSON.stringify(original.text))),
        elements: cloneElements(original.elements),
        popouts: clonePopouts(original.popouts),
        overrides: { ...(original.overrides || {}) },
      };
      const newScreenshots = [...state.screenshots];
      newScreenshots.splice(index + 1, 0, clone);
      return {
        screenshots: newScreenshots,
        selectedIndex: index + 1,
        selectedElementId: null,
      };
    }),

  reorderScreenshots: (fromIndex, toIndex) =>
    set((state) => {
      const newScreenshots = [...state.screenshots];
      const [removed] = newScreenshots.splice(fromIndex, 1);
      newScreenshots.splice(toIndex, 0, removed);
      let selectedIndex = state.selectedIndex;
      if (state.selectedIndex === fromIndex) {
        selectedIndex = toIndex;
      } else if (fromIndex < state.selectedIndex && toIndex >= state.selectedIndex) {
        selectedIndex = state.selectedIndex - 1;
      } else if (fromIndex > state.selectedIndex && toIndex <= state.selectedIndex) {
        selectedIndex = state.selectedIndex + 1;
      }
      return {
        screenshots: newScreenshots,
        selectedIndex,
        selectedElementId: null,
      };
    }),

  // Keys that sync across spanned backgrounds
  // Background actions
  setBackground: (key, value) =>
    set((state) => {
      const screenshot = state.screenshots[state.selectedIndex];
      if (!screenshot) return state;
      const newBackground = { ...screenshot.background };
      setNestedValue(newBackground as unknown as Record<string, unknown>, key, value);
      const normalized = normalizeBackgroundSettings(newBackground);

      // Sync to other screenshots if imageSpan is enabled and this is a span-synced key.
      const SPANNED_KEYS = new Set(['image', 'imageSrc', 'imageFit', 'imageBlur', 'overlayColor', 'overlayOpacity', 'noise', 'noiseIntensity']);
      const rootKey = key.split('.')[0];
      const shouldSync = normalized.imageSpan && SPANNED_KEYS.has(rootKey);
      const toggledSpan = rootKey === 'imageSpan';
      const selectedImageSrc = normalized.imageSrc || normalized.image?.src || null;

      return {
        screenshots: state.screenshots.map((s, i) => {
          if (i === state.selectedIndex) return { ...s, background: normalized };
          const sameSpannedImage = selectedImageSrc
            && (s.background?.imageSrc || s.background?.image?.src || null) === selectedImageSrc;
          if (toggledSpan && value === true && normalized.image) {
            return {
              ...s,
              background: normalizeBackgroundSettings({
                ...s.background,
                type: 'image',
                image: normalized.image,
                imageSrc: normalized.imageSrc,
                imageFit: normalized.imageFit,
                imageBlur: normalized.imageBlur,
                overlayColor: normalized.overlayColor,
                overlayOpacity: normalized.overlayOpacity,
                noise: normalized.noise,
                noiseIntensity: normalized.noiseIntensity,
                imageSpan: !!value,
              }),
            };
          }
          if (toggledSpan && value === false && sameSpannedImage) {
            return {
              ...s,
              background: normalizeBackgroundSettings({ ...s.background, imageSpan: false }),
            };
          }
          if (shouldSync && s.background?.imageSpan) {
            const syncedBg = { ...s.background };
            setNestedValue(syncedBg as unknown as Record<string, unknown>, key, value);
            return { ...s, background: normalizeBackgroundSettings(syncedBg) };
          }
          return s;
        }),
      };
    }),

  setBackgroundSettings: (settings) =>
    set((state) => {
      const screenshot = state.screenshots[state.selectedIndex];
      if (!screenshot) return state;
      const merged = normalizeBackgroundSettings({ ...screenshot.background, ...settings });

      // If enabling imageSpan with an image, propagate image to all screenshots.
      const enabledSpan = settings.imageSpan && !screenshot.background?.imageSpan && merged.image;
      const disabledSpan = settings.imageSpan === false && screenshot.background?.imageSpan;
      const selectedImageSrc = merged.imageSrc || merged.image?.src || null;

      return {
        screenshots: state.screenshots.map((s, i) => {
          if (i === state.selectedIndex) return { ...s, background: merged };
          if (enabledSpan) {
            return {
              ...s,
              background: normalizeBackgroundSettings({
                ...s.background,
                type: 'image',
                image: merged.image,
                imageSrc: merged.imageSrc,
                imageFit: merged.imageFit,
                imageBlur: merged.imageBlur,
                overlayColor: merged.overlayColor,
                overlayOpacity: merged.overlayOpacity,
                noise: merged.noise,
                noiseIntensity: merged.noiseIntensity,
                imageSpan: true,
              }),
            };
          }
          if (disabledSpan && selectedImageSrc && (s.background?.imageSrc || s.background?.image?.src || null) === selectedImageSrc) {
            return { ...s, background: normalizeBackgroundSettings({ ...s.background, imageSpan: false }) };
          }
          return s;
        }),
      };
    }),

  // Screenshot settings actions
  setScreenshotSetting: (key, value) =>
    set((state) => {
      const screenshot = state.screenshots[state.selectedIndex];
      if (!screenshot) return state;
      const newSettings = { ...screenshot.screenshot };
      setNestedValue(newSettings as unknown as Record<string, unknown>, key, value);
      if (key === 'use3D' && value === true && !newSettings.frameColor) {
        newSettings.frameColor = DEFAULT_3D_FRAME_COLORS[newSettings.device3D] || DEFAULT_3D_FRAME_COLORS.iphone;
      }
      if (key === 'device3D') {
        const device = String(value);
        newSettings.frameColor = DEFAULT_3D_FRAME_COLORS[device] || DEFAULT_3D_FRAME_COLORS.iphone;
      }
      return {
        screenshots: state.screenshots.map((s, i) =>
          i === state.selectedIndex ? { ...s, screenshot: newSettings } : s
        ),
      };
    }),

  // Text actions
  setTextSetting: (key, value) =>
    set((state) => {
      const screenshot = state.screenshots[state.selectedIndex];
      if (!screenshot) return state;
      const newText = { ...screenshot.text, [key]: value };
      return {
        screenshots: state.screenshots.map((s, i) =>
          i === state.selectedIndex ? { ...s, text: normalizeTextSettings(newText) } : s
        ),
      };
    }),

  // Global settings
  setOutputDevice: (device) => set({ outputDevice: device }),
  setCustomDimensions: (width, height) => set({ customWidth: width, customHeight: height }),
  setCurrentLanguage: (lang) => {
    set((state) => ({
      currentLanguage: lang,
      screenshots: state.screenshots.map((screenshot) => ({
        ...screenshot,
        text: normalizeTextSettings({
          ...ensureTextLanguage(screenshot.text, lang, state.currentLanguage),
          currentHeadlineLang: lang,
          currentSubheadlineLang: lang,
          currentLayoutLang: lang,
        }),
      })),
      defaults: {
        ...state.defaults,
        text: normalizeTextSettings({
          ...ensureTextLanguage(state.defaults.text, lang, state.currentLanguage),
          currentHeadlineLang: lang,
          currentSubheadlineLang: lang,
          currentLayoutLang: lang,
        }),
      },
    }));
    get().saveState();
  },
  addProjectLanguage: (lang) =>
    set((state) => {
      if (state.projectLanguages.includes(lang)) return state;
      const sourceLang = state.currentLanguage || 'en';
      return {
        projectLanguages: [...state.projectLanguages, lang],
        screenshots: state.screenshots.map((screenshot) => ({
          ...screenshot,
          text: ensureTextLanguage(screenshot.text, lang, sourceLang),
        })),
        defaults: {
          ...state.defaults,
          text: ensureTextLanguage(state.defaults.text, lang, sourceLang),
        },
      };
    }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Getters
  getCurrentScreenshot: () => {
    const state = get();
    if (state.screenshots.length === 0) return null;
    return state.screenshots[state.selectedIndex] || null;
  },

  getBackground: () => {
    const state = get();
    const screenshot = state.screenshots[state.selectedIndex];
    if (screenshot) {
      return normalizeBackgroundSettings(screenshot.background);
    }
    return normalizeBackgroundSettings(state.defaults.background);
  },

  getScreenshotSettings: () => {
    const state = get();
    const screenshot = state.screenshots[state.selectedIndex];
    return screenshot ? screenshot.screenshot : state.defaults.screenshot;
  },

  getTextSettings: () => {
    const state = get();
    const screenshot = state.screenshots[state.selectedIndex];
    if (screenshot) {
      return normalizeTextSettings(screenshot.text);
    }
    return normalizeTextSettings(state.defaults.text);
  },

  // Reset
  resetState: () =>
    set({
      screenshots: [],
      selectedIndex: 0,
      selectedElementId: null,
      transferTarget: null,
      outputDevice: 'iphone-6.9',
      currentLanguage: 'en',
      projectLanguages: ['en'],
      customWidth: 1290,
      customHeight: 2796,
      defaults: getDefaultSettings(),
      activeTab: 'background',
    }),

  setState: (newState) =>
    set((state) => {
      const screenshots = newState.screenshots
        ? newState.screenshots.map((screenshot) => normalizeScreenshotRecord(screenshot))
        : state.screenshots;
      const rawSelectedIndex = typeof newState.selectedIndex === 'number' ? newState.selectedIndex : state.selectedIndex;
      const selectedIndex = Math.max(0, Math.min(rawSelectedIndex, Math.max(screenshots.length - 1, 0)));

      return {
        screenshots,
        selectedIndex,
        selectedElementId: null,
        transferTarget: typeof newState.transferTarget === 'number' ? newState.transferTarget : null,
        outputDevice: newState.outputDevice || state.outputDevice,
        currentLanguage: newState.currentLanguage || state.currentLanguage,
        projectLanguages: Array.isArray(newState.projectLanguages) && newState.projectLanguages.length
          ? newState.projectLanguages
          : state.projectLanguages,
        customWidth: typeof newState.customWidth === 'number' ? newState.customWidth : state.customWidth,
        customHeight: typeof newState.customHeight === 'number' ? newState.customHeight : state.customHeight,
        defaults: normalizeDefaultSettings(newState.defaults || state.defaults),
        activeTab: newState.activeTab || state.activeTab,
      };
    }),

  // Style transfer
  transferStyle: (fromIndex, toIndex) =>
    set((state) => {
      const source = state.screenshots[fromIndex];
      if (!source) return state;
      return {
        screenshots: state.screenshots.map((s, i) => {
          if (i !== toIndex) return s;
          const targetText = normalizeTextSettings(s.text);
          const styledText = normalizeTextSettings(source.text);
          return {
            ...s,
            background: normalizeBackgroundSettings(source.background),
            screenshot: JSON.parse(JSON.stringify(source.screenshot)),
            text: normalizeTextSettings({
              ...styledText,
              headlines: { ...targetText.headlines },
              subheadlines: { ...targetText.subheadlines },
              headlineLanguages: [...targetText.headlineLanguages],
              subheadlineLanguages: [...targetText.subheadlineLanguages],
              currentHeadlineLang: targetText.currentHeadlineLang,
              currentSubheadlineLang: targetText.currentSubheadlineLang,
            }),
            elements: cloneElements(source.elements),
          };
        }),
      };
    }),

  applyStyleToAll: (fromIndex) =>
    set((state) => {
      const source = state.screenshots[fromIndex];
      if (!source) return state;
      return {
        screenshots: state.screenshots.map((s, i) => {
          if (i === fromIndex) return s;
          const targetText = normalizeTextSettings(s.text);
          const styledText = normalizeTextSettings(source.text);
          return {
            ...s,
            background: normalizeBackgroundSettings(source.background),
            screenshot: JSON.parse(JSON.stringify(source.screenshot)),
            text: normalizeTextSettings({
              ...styledText,
              headlines: { ...targetText.headlines },
              subheadlines: { ...targetText.subheadlines },
              headlineLanguages: [...targetText.headlineLanguages],
              subheadlineLanguages: [...targetText.subheadlineLanguages],
              currentHeadlineLang: targetText.currentHeadlineLang,
              currentSubheadlineLang: targetText.currentSubheadlineLang,
            }),
            elements: cloneElements(source.elements),
          };
        }),
      };
    }),

  setCurrentScreenshotAsDefault: () =>
    set((state) => {
      const screenshot = state.screenshots[state.selectedIndex];
      if (!screenshot) return state;
      return {
        defaults: {
          background: normalizeBackgroundSettings(screenshot.background),
          screenshot: { ...screenshot.screenshot },
          text: normalizeTextSettings(screenshot.text),
          elements: cloneElements(screenshot.elements),
          popouts: clonePopouts(screenshot.popouts),
        },
      };
    }),

  // Persistence
  saveState: async () => {
    const state = get();
    const projectStore = useProjectStore.getState();
    await projectStore.saveProjectState(projectStore.currentProjectId, {
      screenshots: state.screenshots,
      selectedIndex: state.selectedIndex,
      outputDevice: state.outputDevice,
      customWidth: state.customWidth,
      customHeight: state.customHeight,
      currentLanguage: state.currentLanguage,
      projectLanguages: state.projectLanguages,
      defaults: state.defaults,
    });
  },
}));
