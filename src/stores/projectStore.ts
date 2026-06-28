import { create } from 'zustand';
import type { Project } from '../types';

const DB_NAME = 'AppStoreScreenshotGenerator';
const DB_VERSION = 2;

const SUPPORTED_LANGS = ['en-gb', 'pt-br', 'zh-tw', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'tr', 'pl', 'sv', 'da', 'no', 'fi', 'th', 'vi', 'id', 'uk'];

function detectLanguageFromFilename(filename = ''): string {
  const lower = filename.toLowerCase();
  for (const lang of SUPPORTED_LANGS) {
    const escaped = lang.replace('-', '[-_]?');
    const pattern = new RegExp(`[_-]${escaped}(?:[_-][a-z]{2})?\\.`, 'i');
    if (pattern.test(lower)) return lang;
  }
  return 'en';
}

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

// Serialize screenshots: convert Image objects to base64 data URLs
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

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

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

// Deserialize screenshots: rebuild Image objects from base64 data URLs
function deserializeScreenshots(screenshots: any[], needs3DMigration = false): Promise<any[]> {
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
      if (s.background?.imageSrc && !s.background?.image) {
        const bgImg = await loadImage(s.background.imageSrc);
        deserialized.background = { ...s.background, image: bgImg, imageFit: s.background.imageFit === 'fill' ? 'stretch' : (s.background.imageFit || 'cover') };
      }
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
      deserialized.popouts = deserialized.popouts || [];
      deserialized.elements = deserialized.elements || [];
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
  saveProjectState: (id: string, state: unknown) => void;
  loadProjectState: (id: string) => Promise<unknown>;
  updateScreenshotCount: (count: number) => void;
}

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
          if (projectsReq.result) {
            set({ projects: projectsReq.result.value });
          }
          if (currentReq.result) {
            set({ currentProjectId: currentReq.result.value });
          }
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
    const id = 'project_' + Date.now();
    const newProject: Project = { id, name, screenshotCount: 0 };
    set((state) => ({
      projects: [...state.projects, newProject],
      currentProjectId: id,
    }));
    get().saveProjects();
  },

  deleteProject: async (id) => {
    const { db, projects } = get();
    if (projects.length <= 1) return;

    const index = projects.findIndex((p) => p.id === id);
    if (index > -1) {
      const newProjects = projects.filter((p) => p.id !== id);
      set({ projects: newProjects, currentProjectId: newProjects[0].id });
    }

    if (db) {
      try {
        const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);
        store.delete(id);
      } catch (e) {
        console.error('Error deleting project:', e);
    }
    }
    get().saveProjects();
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
    set({ currentProjectId: id });
    get().saveProjects();
  },

  saveProjectState: (id, state) => {
    const { db } = get();
    if (!db) return;

    try {
      const rawState = state as any;
      const stateToSave = {
        ...rawState,
        id,
        formatVersion: 2,
        screenshots: serializeScreenshots(rawState.screenshots || []),
        defaults: rawState.defaults ? { ...rawState.defaults, background: serializeBackground(rawState.defaults.background) } : rawState.defaults,
      };
      const transaction = db.transaction([PROJECTS_STORE], 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      store.put(stateToSave);
      get().updateScreenshotCount((rawState.screenshots || []).length);
    } catch (e) {
      console.error('Error saving project state:', e);
    }
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
          const needs3DMigration = !result.formatVersion || result.formatVersion < 2;
          const screenshots = await deserializeScreenshots(result.screenshots || [], needs3DMigration);
          let defaults = result.defaults;
          if (defaults?.background?.imageSrc && !defaults.background.image) {
            defaults = {
              ...defaults,
              background: { ...defaults.background, image: await loadImage(defaults.background.imageSrc) },
            };
          }
          const { id: _id, ...loadedState } = {
            selectedIndex: result.selectedIndex || 0,
            outputDevice: result.outputDevice || 'iphone-6.9',
            customWidth: result.customWidth || 1320,
            customHeight: result.customHeight || 2868,
            currentLanguage: result.currentLanguage || 'en',
            projectLanguages: result.projectLanguages || ['en'],
            defaults,
            ...result,
            screenshots,
          };
          resolve(loadedState);
        };

        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  updateScreenshotCount: (count) => {
    const { currentProjectId } = get();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === currentProjectId ? { ...p, screenshotCount: count } : p
      ),
    }));
    get().saveProjects();
  },
}));
