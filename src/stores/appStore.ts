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
    image: null,
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
  saveState: () => void;
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
      selectedIndex: state.screenshots.length,
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
      };
    }),

  selectScreenshot: (index) => set({ selectedIndex: index }),

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
      };
    }),

  reorderScreenshots: (fromIndex, toIndex) =>
    set((state) => {
      const newScreenshots = [...state.screenshots];
      const [removed] = newScreenshots.splice(fromIndex, 1);
      newScreenshots.splice(toIndex, 0, removed);
      return {
        screenshots: newScreenshots,
        selectedIndex: toIndex,
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

      // Sync to other screenshots if imageSpan is enabled and this is a span-synced key
      const SPANNED_KEYS = new Set(['image', 'imageSrc', 'imageFit', 'imageBlur', 'overlayColor', 'overlayOpacity', 'noise', 'noiseIntensity']);
      const rootKey = key.split('.')[0];
      const shouldSync = normalized.imageSpan && SPANNED_KEYS.has(rootKey);
      const toggledSpan = rootKey === 'imageSpan';

      return {
        screenshots: state.screenshots.map((s, i) => {
          if (i === state.selectedIndex) return { ...s, background: normalized };
          if (toggledSpan && normalized.image) {
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

      // If enabling imageSpan with an image, propagate image to all screenshots
      const enabledSpan = settings.imageSpan && !screenshot.background?.imageSpan && merged.image;

      return {
        screenshots: state.screenshots.map((s, i) => {
          if (i === state.selectedIndex) return { ...s, background: merged };
          if (enabledSpan) {
            return { ...s, background: normalizeBackgroundSettings({ ...s.background, ...settings, imageSpan: true }) };
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
  setCurrentLanguage: (lang) => set({ currentLanguage: lang }),
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
      transferTarget: null,
      outputDevice: 'iphone-6.9',
      currentLanguage: 'en',
      projectLanguages: ['en'],
      customWidth: 1290,
      customHeight: 2796,
      defaults: getDefaultSettings(),
      activeTab: 'background',
    }),

  setState: (newState) => set(newState),

  // Style transfer
  transferStyle: (fromIndex, toIndex) =>
    set((state) => {
      const source = state.screenshots[fromIndex];
      if (!source) return state;
      return {
        screenshots: state.screenshots.map((s, i) =>
          i === toIndex ? {
            ...s,
            background: normalizeBackgroundSettings(source.background),
            screenshot: { ...source.screenshot },
            text: normalizeTextSettings(source.text),
          } : s
        ),
      };
    }),

  applyStyleToAll: (fromIndex) =>
    set((state) => {
      const source = state.screenshots[fromIndex];
      if (!source) return state;
      return {
        screenshots: state.screenshots.map((s, i) =>
          i === fromIndex ? s : {
            ...s,
            background: normalizeBackgroundSettings(source.background),
            screenshot: { ...source.screenshot },
            text: normalizeTextSettings(source.text),
          }
        ),
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
  saveState: () => {
    const state = get();
    const projectStore = useProjectStore.getState();
    projectStore.saveProjectState(projectStore.currentProjectId, {
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
