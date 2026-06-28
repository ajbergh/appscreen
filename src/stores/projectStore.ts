/**
 * IndexedDB-backed project metadata and persistence store.
 *
 * Project state is split from the in-memory app store because saved projects
 * must serialize live browser objects such as `HTMLImageElement` before writing
 * to IndexedDB, then hydrate them again when a project is loaded. This module
 * also handles legacy vanilla-app fields (`src`, `imageSrc`, `fill`) and format
 * migrations for older 3D positioning data.
 */
import { create } from 'zustand';
import type { Project } from '../types';

const DB_NAME = 'AppStoreScreenshotGenerator';
const DB_VERSION = 2;

const SUPPORTED_LANGS = ['en-gb', 'pt-br', 'zh-tw', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'pl', 'sv', 'da', 'no', 'fi', 'th', 'vi', 'id', 'uk'];

/**
 * Returns the baseline background used when migrating pre-per-screenshot saves.
 */
function getDefaultBackgroundSettings() {
  return {
    type: 'gradient',
    gradient: {
      angle: 135,
      stops: [
        { color: '#667eea', position: 0 },
        { color: '#764ba2', position: 100 },
      ],
    },
    solid: '#1a1a2e',
    image: null,
    imageSrc: null,
    imageFit: 'cover',
    imageSpan: false,
    imageBlur: 0,
    overlayColor: '#000000',
    overlayOpacity: 0,
    noise: false,
    noiseIntensity: 10,
  };
}

/**
 * Returns baseline device placement settings for old-format migration.
 */
function getDefaultScreenshotSettings() {
  return {
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
  };
}

/**
 * Returns baseline text settings for old-format migration.
 */
function getDefaultTextSettings() {
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
 * JSON-clones migration defaults so each migrated screenshot gets independent
 * nested settings objects.
 */
function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Builds the per-screenshot defaults used for legacy top-level project saves.
 */
function buildMigrationDefaults(result: any) {
  const defaultBackground = getDefaultBackgroundSettings();
  const defaultScreenshot = getDefaultScreenshotSettings();
  const defaultText = getDefaultTextSettings();
  const oldBackground = result.background || {};
  const oldScreenshot = result.screenshot || {};
  const oldText = result.text || {};

  return {
    background: {
      ...defaultBackground,
      ...oldBackground,
      gradient: oldBackground.gradient || defaultBackground.gradient,
      solid: oldBackground.solid || defaultBackground.solid,
      image: null,
      imageSrc: oldBackground.imageSrc || oldBackground.image?.src || null,
      imageFit: oldBackground.imageFit === 'fill' ? 'stretch' : (oldBackground.imageFit || defaultBackground.imageFit),
      imageSpan: !!oldBackground.imageSpan,
      imageBlur: oldBackground.imageBlur || 0,
      overlayColor: oldBackground.overlayColor || '#000000',
      overlayOpacity: oldBackground.overlayOpacity || 0,
      noise: !!oldBackground.noise,
      noiseIntensity: oldBackground.noiseIntensity || 10,
    },
    screenshot: {
      ...defaultScreenshot,
      ...oldScreenshot,
      rotation3D: { ...defaultScreenshot.rotation3D, ...(oldScreenshot.rotation3D || {}) },
      shadow: { ...defaultScreenshot.shadow, ...(oldScreenshot.shadow || {}) },
      frame: { ...defaultScreenshot.frame, ...(oldScreenshot.frame || {}) },
    },
    text: {
      ...defaultText,
      ...oldText,
      headlines: oldText.headlines || defaultText.headlines,
      headlineLanguages: oldText.headlineLanguages || defaultText.headlineLanguages,
      subheadlines: oldText.subheadlines || defaultText.subheadlines,
      subheadlineLanguages: oldText.subheadlineLanguages || defaultText.subheadlineLanguages,
      languageSettings: oldText.languageSettings || defaultText.languageSettings,
    },
    elements: [],
    popouts: [],
  };
}

/**
 * Infers a localized screenshot language from a filename suffix.
 *
 * Supports both dash and underscore separators, plus common region variants
 * such as `pt-br` and `zh-tw`. Unknown names default to English for compatibility
 * with the original uploader.
 */
function detectLanguageFromFilename(filename = ''): string {
  const lower = filename.toLowerCase();
  for (const lang of SUPPORTED_LANGS) {
    const escaped = lang.replace('-', '[-_]?');
    const pattern = new RegExp(`[_-]${escaped}(?:[_-][a-z]{2})?\\.`, 'i');
    if (pattern.test(lower)) return lang;
  }
  return 'en';
}

/**
 * Converts a background object into an IndexedDB-safe shape.
 *
 * Live `HTMLImageElement` values cannot be structured-cloned reliably, so only
 * the source string is persisted. Legacy `fill` fit values are normalized to the
 * React renderer's `stretch` value.
 */
function serializeBackground(background: any) {
  if (!background) return background;
  const imageSrc = background.imageSrc || background.image?.src || null;
  return {
    ...background,
    image: undefined,
    imageSrc,
    imageFit: background.imageFit === 'fill' ? 'stretch' : (background.imageFit || 'cover'),
  };
}

/**
 * Serializes screenshots for IndexedDB.
 *
 * The saved shape preserves legacy `src` for original-app compatibility, stores
 * localized image source/name metadata, removes live image objects, and leaves
 * enough element/icon source data to reconstruct renderable images on load.
 */
function serializeScreenshots(screenshots: any[]) {
  return screenshots.map((s) => {
    const serialized: any = { ...s };
    if (s.image && s.image.src) {
      serialized.imageSrc = s.image.src;
      serialized.src = s.image.src;
      serialized.image = undefined;
    } else {
      serialized.src = s.src || s.imageSrc || '';
    }
    if (s.localizedImages) {
      serialized.localizedImages = {};
      Object.keys(s.localizedImages).forEach((lang) => {
        const langData = s.localizedImages[lang];
        if (langData && langData.src) {
          serialized.localizedImages[lang] = { src: langData.src, name: langData.name };
        }
      });
    }
    serialized.background = serializeBackground(s.background);
    if (s.elements) {
      serialized.elements = s.elements.map((el: any) => ({ ...el, image: undefined, src: el.src || (el.type === 'graphic' ? el.image?.src : null) }));
    }
    serialized.overrides = s.overrides || {};
    return serialized;
  });
}

/**
 * Hydrates an image source string into an `HTMLImageElement`.
 *
 * Failures resolve to `null` instead of throwing so one broken image does not
 * prevent an entire project from loading.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Hydrates a persisted background, including legacy `fill` image-fit values.
 */
async function deserializeBackground(background: any) {
  if (!background) return background;
  const normalized = {
    ...background,
    imageFit: background.imageFit === 'fill' ? 'stretch' : (background.imageFit || 'cover'),
  };
  if (normalized.imageSrc && !normalized.image) {
    normalized.image = await loadImage(normalized.imageSrc);
  }
  return normalized;
}

/**
 * Rebuilds a Lucide icon image when older project data only saved icon metadata.
 *
 * Newer icon elements prefer stored SVG/data URLs, but this fetch fallback keeps
 * older saved projects renderable when network access is available.
 */
async function loadLucideIconImage(name: string, color = '#ffffff', strokeWidth = 2): Promise<HTMLImageElement | null> {
  try {
    const resp = await fetch(`https://unpkg.com/lucide-static@latest/icons/${name}.svg`);
    if (!resp.ok) return null;
    const svgText = await resp.text();
    const colorized = svgText
      .replace(/stroke="currentColor"/g, `stroke="${color}"`)
      .replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`);
    return await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(colorized)}`);
  } catch {
    return null;
  }
}

/**
 * Migrates pre-formatVersion-2 3D position values to the current transform math.
 *
 * The old renderer used a different offset range. The migration expands stored
 * x/y values so existing projects visually land closer to their original output.
 */
function migrate3DPosition(screenshotSettings: any): void {
  if (!screenshotSettings?.use3D) return;
  const scale = (screenshotSettings.scale || 70) / 100;
  const oldX = screenshotSettings.x ?? 50;
  const oldY = screenshotSettings.y ?? 50;
  const xFactor = 2 / ((1 - scale) * 0.9);
  const yFactor = 3 / ((1 - scale) * 2);
  screenshotSettings.x = Math.max(0, Math.min(100, 50 + (oldX - 50) * xFactor));
  screenshotSettings.y = Math.max(0, Math.min(100, 50 + (oldY - 50) * yFactor));
}

/**
 * Hydrates persisted screenshots back into runtime-ready objects.
 *
 * Recreates root images, localized images, background images, element images,
 * icon fallbacks, default arrays, and optional 3D position migration.
 */
function deserializeScreenshots(screenshots: any[], needs3DMigration = false, migrationDefaults?: any): Promise<any[]> {
  return Promise.all(
    screenshots.map(async (s) => {
      const deserialized: any = { ...s };
      const legacySrc = s.imageSrc || s.src || '';
      if (legacySrc && !s.image) {
        deserialized.image = await loadImage(legacySrc);
        deserialized.imageSrc = legacySrc;
        deserialized.src = legacySrc;
      }
      if (s.localizedImages) {
        deserialized.localizedImages = {};
        for (const lang of Object.keys(s.localizedImages)) {
          const langData = s.localizedImages[lang];
          if (langData?.src) {
            deserialized.localizedImages[lang] = { image: await loadImage(langData.src), src: langData.src, name: langData.name };
          }
        }
      }
      if ((!deserialized.localizedImages || Object.keys(deserialized.localizedImages).length === 0) && legacySrc) {
        const lang = detectLanguageFromFilename(s.name || '');
        deserialized.localizedImages = {
          [lang]: { image: deserialized.image, src: legacySrc, name: s.name || 'screenshot.png' },
        };
      }
      if (!deserialized.image && deserialized.localizedImages) {
        const first = Object.values(deserialized.localizedImages)[0] as any;
        deserialized.image = first?.image || null;
      }
      const backgroundSource = s.background || migrationDefaults?.background;
      deserialized.background = await deserializeBackground(backgroundSource ? clonePlain(backgroundSource) : backgroundSource);
      deserialized.screenshot = s.screenshot ? clonePlain(s.screenshot) : clonePlain(migrationDefaults?.screenshot || getDefaultScreenshotSettings());
      deserialized.text = s.text ? clonePlain(s.text) : clonePlain(migrationDefaults?.text || getDefaultTextSettings());
      if (s.elements) {
        deserialized.elements = await Promise.all(
          s.elements.map(async (el: any) => {
            if ((el.type === 'graphic' || el.type === 'icon') && el.src && !el.image) return { ...el, image: await loadImage(el.src) };
            if (el.type === 'icon' && el.iconName && !el.image) {
              return { ...el, image: await loadLucideIconImage(el.iconName, el.iconColor || '#ffffff', el.iconStrokeWidth || 2) };
            }
            return el;
          })
        );
      }
      if (needs3DMigration) migrate3DPosition(deserialized.screenshot);
      deserialized.popouts = deserialized.popouts || clonePlain(migrationDefaults?.popouts || []);
      deserialized.elements = deserialized.elements || clonePlain(migrationDefaults?.elements || []);
      deserialized.overrides = deserialized.overrides || {};
      return deserialized;
    })
  );
}
const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';

interface ProjectStore {
  projects: Project[];
  currentProjectId: string;
  db: IDBDatabase | null;

  // Actions
  initDatabase: () => Promise<void>;
  loadProjects: () => Promise<void>;
  saveProjects: () => void;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => void;
  switchProject: (id: string) => Promise<void>;
  saveProjectState: (id: string, state: unknown) => Promise<void>;
  loadProjectState: (id: string) => Promise<unknown>;
  updateScreenshotCount: (id: string, count: number) => void;
}

/**
 * Opens or upgrades the project database.
 *
 * Version 2 uses separate `projects` and `meta` stores and deletes the legacy
 * single `state` store if present. Errors resolve to `null` so the UI can still
 * run without persistence in restricted browser contexts.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (database.objectStoreNames.contains('state')) {
          database.deleteObjectStore('state');
        }
        if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
          database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };

      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Zustand store for project list metadata and IndexedDB project records.
 */
export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [{ id: 'default', name: 'Default Project', screenshotCount: 0 }],
  currentProjectId: 'default',
  db: null,

  initDatabase: async () => {
    const db = await openDatabase();
    set({ db });
  },

  loadProjects: async () => {
    const { db } = get();
    if (!db) return;

    return new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction([META_STORE], 'readonly');
        const store = transaction.objectStore(META_STORE);

        const projectsReq = store.get('projects');
        const currentReq = store.get('currentProject');

        transaction.oncomplete = () => {
          const loadedProjects = Array.isArray(projectsReq.result?.value) && projectsReq.result.value.length
            ? projectsReq.result.value
            : get().projects;
          const storedProjectId = currentReq.result?.value;
          const currentProjectId = loadedProjects.some((project: Project) => project.id === storedProjectId)
            ? storedProjectId
            : loadedProjects[0]?.id || 'default';
          set({ projects: loadedProjects, currentProjectId });
          resolve();
        };

        transaction.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  },

  saveProjects: () => {
    const { db, projects, currentProjectId } = get();
    if (!db) return;

    try {
      const transaction = db.transaction([META_STORE], 'readwrite');
      const store = transaction.objectStore(META_STORE);
      store.put({ key: 'projects', value: projects });
      store.put({ key: 'currentProject', value: currentProjectId });
    } catch (e) {
      console.error('Error saving projects meta:', e);
    }
  },

  createProject: async (name) => {
    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().saveState();

    const id = 'project_' + Date.now();
    const newProject: Project = { id, name, screenshotCount: 0 };
    set((state) => ({
      projects: [...state.projects, newProject],
      currentProjectId: id,
    }));
    get().saveProjects();
    useAppStore.getState().resetState();
  },

  deleteProject: async (id) => {
    const { useAppStore } = await import('./appStore');
    const { db, projects, currentProjectId } = get();
    if (projects.length <= 1) return;
    await useAppStore.getState().saveState();

    const index = projects.findIndex((p) => p.id === id);
    if (index > -1) {
      const newProjects = projects.filter((p) => p.id !== id);
      const nextProjectId = currentProjectId === id ? newProjects[0].id : currentProjectId;
      set({ projects: newProjects, currentProjectId: nextProjectId });
    }

    if (db) {
      try {
        await new Promise<void>((resolve) => {
          const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
          const store = transaction.objectStore(PROJECTS_STORE);
          store.delete(id);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        });
      } catch (e) {
        console.error('Error deleting project:', e);
      }
    }
    get().saveProjects();

    if (currentProjectId === id) {
      const nextProjectId = get().currentProjectId;
      const nextState = await get().loadProjectState(nextProjectId);
      useAppStore.getState().resetState();
      if (nextState) {
        const { needsMigration, ...appState } = nextState as any;
        useAppStore.getState().setState(appState);
        if (needsMigration && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('appscreen:migration-needed'));
        }
      }
    }
  },

  renameProject: (id, name) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name } : p
      ),
    }));
    get().saveProjects();
  },

  switchProject: async (id) => {
    if (id === get().currentProjectId) return;
    if (!get().projects.some((project) => project.id === id)) return;

    const { useAppStore } = await import('./appStore');
    await useAppStore.getState().saveState();
    set({ currentProjectId: id });
    get().saveProjects();

    const newState = await get().loadProjectState(id);
    useAppStore.getState().resetState();
    if (newState) {
      const { needsMigration, ...appState } = newState as any;
      useAppStore.getState().setState(appState);
      if (needsMigration && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('appscreen:migration-needed'));
      }
    }
  },

  saveProjectState: (id, state) => {
    const { db } = get();
    if (!db) return Promise.resolve();

    return new Promise<void>((resolve) => {
      try {
        const { needsMigration: _needsMigration, ...rawState } = state as any;
        const screenshotCount = (rawState.screenshots || []).length;
        const stateToSave = {
          ...rawState,
          id,
          formatVersion: 2,
          screenshots: serializeScreenshots(rawState.screenshots || []),
          defaults: rawState.defaults ? {
            ...rawState.defaults,
            elements: rawState.defaults.elements || [],
            popouts: rawState.defaults.popouts || [],
            background: serializeBackground(rawState.defaults.background),
          } : rawState.defaults,
        };
        const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);
        store.put(stateToSave);
        transaction.oncomplete = () => {
          get().updateScreenshotCount(id, screenshotCount);
          resolve();
        };
        transaction.onerror = () => resolve();
      } catch (e) {
        console.error('Error saving project state:', e);
        resolve();
      }
    });
  },

  loadProjectState: (id) => {
    const { db } = get();
    if (!db) return Promise.resolve(null);

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([PROJECTS_STORE], 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.get(id);

        request.onsuccess = async () => {
          const result = request.result;
          if (!result) { resolve(null); return; }
          const isOldFormat = !result.defaults && (result.background || result.screenshot || result.text);
          const hasScreenshotsWithoutSettings = Array.isArray(result.screenshots)
            && result.screenshots.some((s: any) => !s.background && !s.screenshot && !s.text);
          const needsMigration = !!(isOldFormat || hasScreenshotsWithoutSettings);
          const needs3DMigration = !result.formatVersion || result.formatVersion < 2;
          const migrationDefaults = result.defaults ? {
            ...result.defaults,
            elements: Array.isArray(result.defaults.elements) ? result.defaults.elements : [],
            popouts: Array.isArray(result.defaults.popouts) ? result.defaults.popouts : [],
          } : buildMigrationDefaults(result);
          const screenshots = await deserializeScreenshots(result.screenshots || [], needs3DMigration, needsMigration ? migrationDefaults : undefined);
          let defaults = result.defaults ? {
            ...result.defaults,
            elements: Array.isArray(result.defaults.elements) ? result.defaults.elements : [],
            popouts: Array.isArray(result.defaults.popouts) ? result.defaults.popouts : [],
          } : clonePlain(migrationDefaults);
          if (defaults?.background) defaults = { ...defaults, background: await deserializeBackground(defaults.background) };
          const rawSelectedIndex = typeof result.selectedIndex === 'number' ? result.selectedIndex : 0;
          const selectedIndex = Math.max(0, Math.min(rawSelectedIndex, Math.max(screenshots.length - 1, 0)));
          const { id: _id, formatVersion: _formatVersion, ...loadedState } = {
            ...result,
            screenshots,
            selectedIndex,
            outputDevice: result.outputDevice ?? 'iphone-6.9',
            customWidth: result.customWidth ?? 1320,
            customHeight: result.customHeight ?? 2868,
            currentLanguage: result.currentLanguage ?? 'en',
            projectLanguages: Array.isArray(result.projectLanguages) && result.projectLanguages.length ? result.projectLanguages : ['en'],
            defaults,
            needsMigration,
          };
          resolve(loadedState);
        };

        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  updateScreenshotCount: (id, count) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === id);
    if (!project || project.screenshotCount === count) return;

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, screenshotCount: count } : p
      ),
    }));
    get().saveProjects();
  },
}));
