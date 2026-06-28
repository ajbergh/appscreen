import { useRef, useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { getCanvasDimensions } from '../../canvas/renderer';
import { renderScreenshotToCanvas } from '../../hooks/useCanvas';
import type { Screenshot } from '../../types';
import { AboutModal, SettingsModal, LanguagesModal } from '../Modals/Modals';
import { ExportProgressModal, MagicalTitlesModal, ScreenshotTranslationsModal, TranslateAllModal } from '../Modals/AllModals';

const LANGUAGE_FLAGS: Record<string, string> = {
  'en': '🇺🇸', 'en-gb': '🇬🇧', 'de': '🇩🇪', 'fr': '🇫🇷', 'es': '🇪🇸',
  'it': '🇮🇹', 'pt': '🇵🇹', 'pt-br': '🇧🇷', 'nl': '🇳🇱', 'ru': '🇷🇺',
  'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳', 'zh-tw': '🇹🇼', 'ar': '🇸🇦',
  'hi': '🇮🇳', 'tr': '🇹🇷', 'pl': '🇵🇱', 'sv': '🇸🇪', 'da': '🇩🇰',
  'no': '🇳🇴', 'fi': '🇫🇮', 'th': '🇹🇭', 'vi': '🇻🇳', 'id': '🇮🇩', 'uk': '🇺🇦',
};

export function LeftSidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectModalMode, setProjectModalMode] = useState<'new' | 'rename'>('new');
  const [projectName, setProjectName] = useState('');
  const [duplicateFromId, setDuplicateFromId] = useState('');
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [languagesModalOpen, setLanguagesModalOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [translateAllOpen, setTranslateAllOpen] = useState(false);
  const [magicalTitlesOpen, setMagicalTitlesOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [contextMenuIndex, setContextMenuIndex] = useState<number | null>(null);
  const [transferSource, setTransferSource] = useState<number | null>(null);
  const [exportLangDialogOpen, setExportLangDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState({ isOpen: false, progress: 0, status: '', detail: '' });
  const [translationsModalOpen, setTranslationsModalOpen] = useState(false);

  const screenshots = useAppStore((s) => s.screenshots);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const selectScreenshot = useAppStore((s) => s.selectScreenshot);
  const deleteScreenshot = useAppStore((s) => s.deleteScreenshot);
  const duplicateScreenshot = useAppStore((s) => s.duplicateScreenshot);
  const addScreenshot = useAppStore((s) => s.addScreenshot);
  const outputDevice = useAppStore((s) => s.outputDevice);
  const setOutputDevice = useAppStore((s) => s.setOutputDevice);
  const customWidth = useAppStore((s) => s.customWidth);
  const customHeight = useAppStore((s) => s.customHeight);
  const saveState = useAppStore((s) => s.saveState);

  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const createProject = useProjectStore((s) => s.createProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const switchProject = useProjectStore((s) => s.switchProject);

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const setCurrentLanguage = useAppStore((s) => s.setCurrentLanguage);
  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (projectModalOpen) { setProjectModalOpen(false); return; }
        if (exportLangDialogOpen) { setExportLangDialogOpen(false); return; }
        if (languageMenuOpen) { setLanguageMenuOpen(false); return; }
        if (projectMenuOpen) { setProjectMenuOpen(false); return; }
        if (contextMenuIndex !== null) { setContextMenuIndex(null); return; }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, screenshots, projectModalOpen, exportLangDialogOpen, languageMenuOpen, projectMenuOpen, contextMenuIndex]);

  // Detect language from filename suffix (e.g. screenshot_de.png -> 'de')
  const detectLanguageFromFilename = (filename: string): string | null => {
    const lower = filename.toLowerCase();
    const langs = Object.keys(LANGUAGE_FLAGS).sort((a, b) => b.length - a.length);
    for (const lang of langs) {
      const escaped = lang.replace('-', '[-_]?');
      const pattern = new RegExp(`[_-]${escaped}(?:[_-][a-z]{2})?\\.`, 'i');
      if (pattern.test(lower)) return lang;
    }
    return null;
  };

  // Get base filename without language suffix and extension
  const getBaseFilename = (filename: string): string => {
    const base = filename.replace(/\.[^/.]+$/, '');
    const langs = Object.keys(LANGUAGE_FLAGS).sort((a, b) => b.length - a.length);
    for (const lang of langs) {
      const escaped = lang.replace('-', '[-_]?');
      const pattern = new RegExp(`[_-]${escaped}(?:[_-][a-z]{2})?$`, 'i');
      if (pattern.test(base)) return base.replace(pattern, '');
    }
    return base;
  };

  const findScreenshotByBaseFilename = (filename: string): number => {
    const baseName = getBaseFilename(filename);
    const currentScreenshots = useAppStore.getState().screenshots;
    for (let i = 0; i < currentScreenshots.length; i++) {
      const screenshot = currentScreenshots[i];
      if (getBaseFilename(screenshot.name || '') === baseName) return i;
      for (const localized of Object.values(screenshot.localizedImages || {})) {
        if (localized?.name && getBaseFilename(localized.name) === baseName) return i;
      }
    }
    return -1;
  };

  const showDuplicateUploadDialog = (message: string): Promise<'replace' | 'create' | 'skip'> => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay visible';
      overlay.innerHTML = `
        <div class="modal">
          <h3>Duplicate Translation Image</h3>
          <p class="modal-message" style="margin: 16px 0;">${message}</p>
          <div class="modal-buttons">
            <button class="modal-btn secondary" data-choice="skip">Skip</button>
            <button class="modal-btn secondary" data-choice="create">Create New</button>
            <button class="modal-btn primary" data-choice="replace">Replace</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelectorAll<HTMLButtonElement>('button[data-choice]').forEach((button) => {
        button.addEventListener('click', () => {
          const choice = button.dataset.choice as 'replace' | 'create' | 'skip';
          overlay.remove();
          resolve(choice);
        });
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve('skip');
        }
      });
    });
  };

  const showAppAlert = (message: string): Promise<void> => new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal-message" style="margin: 16px 0;">${message}</p>
        <div class="modal-buttons"><button class="modal-btn primary">OK</button></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); resolve(); };
    overlay.querySelector('button')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  });

  const showAppConfirm = (message: string, confirmText = 'Confirm'): Promise<boolean> => new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal-message" style="margin: 16px 0;">${message}</p>
        <div class="modal-buttons">
          <button class="modal-btn secondary" data-confirm="false">Cancel</button>
          <button class="modal-btn primary" data-confirm="true">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll<HTMLButtonElement>('button[data-confirm]').forEach((button) => {
      button.addEventListener('click', () => {
        const result = button.dataset.confirm === 'true';
        overlay.remove();
        resolve(result);
      });
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const detectedLang = detectLanguageFromFilename(file.name) || currentLanguage || 'en';

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = async () => {
          const src = ev.target?.result as string;
          const existingIdx = findScreenshotByBaseFilename(file.name);

          if (existingIdx >= 0) {
            // Add as localized image to existing screenshot
            const existing = useAppStore.getState().screenshots[existingIdx];
            if (existing.localizedImages?.[detectedLang]?.image) {
              const choice = await showDuplicateUploadDialog(`${file.name} matches screenshot ${existingIdx + 1} and already has ${detectedLang.toUpperCase()} image data.`);
              if (choice === 'skip') return;
              if (choice === 'create') {
                addScreenshot(createDefaultScreenshot(file.name, img, { [detectedLang]: { image: img, src, name: file.name } }));
                saveState();
                return;
              }
            }
            const newLocalized = { ...existing.localizedImages, [detectedLang]: { image: img, src, name: file.name } };
            useAppStore.getState().updateScreenshot(existingIdx, { localizedImages: newLocalized });
            // Add language to project if not present
            const langs = useAppStore.getState().projectLanguages;
            if (!langs.includes(detectedLang)) {
              useAppStore.getState().setState({ projectLanguages: [...langs, detectedLang] });
            }
          } else {
            // Create new screenshot using current defaults
            const localizedImages: Record<string, { image: HTMLImageElement; src: string; name: string }> = {
              [detectedLang]: { image: img, src, name: file.name }
            };
            addScreenshot(createDefaultScreenshot(file.name, img, localizedImages));
            const langs = useAppStore.getState().projectLanguages;
            if (!langs.includes(detectedLang)) {
              useAppStore.getState().setState({ projectLanguages: [...langs, detectedLang] });
            }
          }
          saveState();
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImageDataUrl = async (name: string, src: string) => {
    const detectedLang = detectLanguageFromFilename(name) || currentLanguage || 'en';
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
    const existingIdx = findScreenshotByBaseFilename(name);
    if (existingIdx >= 0) {
      const existing = useAppStore.getState().screenshots[existingIdx];
      if (existing.localizedImages?.[detectedLang]?.image) {
        const choice = await showDuplicateUploadDialog(`${name} matches screenshot ${existingIdx + 1} and already has ${detectedLang.toUpperCase()} image data.`);
        if (choice === 'skip') return;
        if (choice === 'create') {
          addScreenshot(createDefaultScreenshot(name, img, { [detectedLang]: { image: img, src, name } }));
          return;
        }
      }
      useAppStore.getState().updateScreenshot(existingIdx, {
        localizedImages: { ...existing.localizedImages, [detectedLang]: { image: img, src, name } },
      });
    } else {
      addScreenshot(createDefaultScreenshot(name, img, { [detectedLang]: { image: img, src, name } }));
    }
    const langs = useAppStore.getState().projectLanguages;
    if (!langs.includes(detectedLang)) useAppStore.getState().setState({ projectLanguages: [...langs, detectedLang] });
  };

  const handleTauriImport = async () => {
    const tauri = (window as any).__TAURI__;
    if (!tauri) return;
    try {
      const selected = await tauri.dialog.open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      for (const filePath of paths) {
        const bytes = await tauri.fs.readFile(filePath);
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(new Blob([bytes]));
        });
        await processImageDataUrl(filePath.split(/[\\/]/).pop() || 'screenshot.png', dataUrl);
      }
      saveState();
    } catch (err) {
      console.error('Tauri import error:', err);
    }
  };

  const createDefaultScreenshot = (name: string, img: HTMLImageElement | null, localizedImages: Record<string, { image: HTMLImageElement; src: string; name: string }> = {}): Screenshot => {
    const store = useAppStore.getState();
    const { defaults } = store;
    // Inherit imageSpan background from active screenshot if it uses span (matches original)
    const activeBackground = store.getCurrentScreenshot()?.background;
    const bgDefaults = activeBackground?.imageSpan ? activeBackground : defaults.background;
    return {
      image: img, name, deviceType: outputDevice, localizedImages,
      background: { ...bgDefaults, image: bgDefaults.image || null },
      screenshot: { ...defaults.screenshot },
      text: { ...defaults.text, headlines: { en: '' }, subheadlines: { en: '' } },
      elements: (defaults.elements || []).map((el) => ({ ...el, id: crypto.randomUUID(), image: el.image || null, texts: { ...(el.texts || {}) } })),
      popouts: (defaults.popouts || []).map((p) => ({ ...p, id: crypto.randomUUID(), shadow: { ...p.shadow }, border: { ...p.border } })),
      overrides: {},
    };
  };

  const handleAddBlank = () => {
    addScreenshot(createDefaultScreenshot('Blank Screen', null));
    saveState();
  };

  const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCurrent = async () => {
    if (screenshots.length === 0) return;
    const screenshot = screenshots[selectedIndex];
    if (!screenshot) return;
    const canvas = document.createElement('canvas');
    const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);
    await renderScreenshotToCanvas(canvas, screenshot, dims, currentLanguage, selectedIndex, screenshots, projectLanguages);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `screenshot-${selectedIndex + 1}.png`);
    }, 'image/png');
  };

  const handleExportAll = async () => {
    if (screenshots.length === 0) return;
    const zip = new JSZip();
    const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);
    setExportProgress({ isOpen: true, progress: 0, status: 'Exporting...', detail: `Preparing ${currentLanguage.toUpperCase()} screenshots` });
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const canvas = document.createElement('canvas');
      await renderScreenshotToCanvas(canvas, screenshot, dims, currentLanguage, i, screenshots, projectLanguages);
      const dataUrl = canvas.toDataURL('image/png');
      zip.file(`screenshot-${i + 1}.png`, dataUrl.split(',')[1], { base64: true });
      setExportProgress({ isOpen: true, progress: Math.round(((i + 1) / screenshots.length) * 90), status: 'Exporting...', detail: `Screenshot ${i + 1} of ${screenshots.length}` });
      await yieldToBrowser();
    }
    setExportProgress({ isOpen: true, progress: 95, status: 'Generating ZIP...', detail: '' });
    const blob = await zip.generateAsync({ type: 'blob' });
    setExportProgress({ isOpen: true, progress: 100, status: 'Complete', detail: '' });
    downloadBlob(blob, `screenshots_${outputDevice}_${currentLanguage}.zip`);
    setTimeout(() => setExportProgress((p) => ({ ...p, isOpen: false })), 500);
  };

  const handleExportAllAllLanguages = async () => {
    if (screenshots.length === 0) return;

    const zip = new JSZip();
    const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);
    const totalItems = projectLanguages.length * screenshots.length;
    let completedItems = 0;
    setExportProgress({ isOpen: true, progress: 0, status: 'Exporting...', detail: 'Preparing all languages' });

    for (const lang of projectLanguages) {
      const langFolder = zip.folder(lang);
      if (!langFolder) continue;

      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const canvas = document.createElement('canvas');
        await renderScreenshotToCanvas(canvas, screenshot, dims, lang, i, screenshots, projectLanguages);
        const dataUrl = canvas.toDataURL('image/png');
        langFolder.file(`screenshot-${i + 1}.png`, dataUrl.split(',')[1], { base64: true });
        completedItems++;
        setExportProgress({ isOpen: true, progress: Math.round((completedItems / totalItems) * 90), status: 'Exporting...', detail: `${lang.toUpperCase()}: Screenshot ${i + 1} of ${screenshots.length}` });
        await yieldToBrowser();
      }
    }

    setExportProgress({ isOpen: true, progress: 95, status: 'Generating ZIP...', detail: '' });
    const blob = await zip.generateAsync({ type: 'blob' });
    setExportProgress({ isOpen: true, progress: 100, status: 'Complete', detail: '' });
    downloadBlob(blob, `screenshots_${outputDevice}_all-languages.zip`);
    setTimeout(() => setExportProgress((p) => ({ ...p, isOpen: false })), 500);
  };

  const handleNewProject = () => { setProjectModalMode('new'); setProjectName(''); setDuplicateFromId(''); setProjectModalOpen(true); };
  const handleRenameProject = () => { setProjectModalMode('rename'); setProjectName(currentProject?.name || ''); setProjectModalOpen(true); };
  const handleProjectModalConfirm = async () => {
    if (!projectName.trim()) return;
    if (projectModalMode === 'new') {
      if (duplicateFromId) {
        // Duplicate: create project then copy state from source
        await createProject(projectName.trim());
        const newId = useProjectStore.getState().currentProjectId;
        const sourceState = await useProjectStore.getState().loadProjectState(duplicateFromId);
        if (sourceState) {
          await useProjectStore.getState().saveProjectState(newId, sourceState);
          const appState = useAppStore.getState();
          appState.setState(sourceState as any);
        }
      } else {
        await createProject(projectName.trim());
        useAppStore.getState().resetState();
      }
    } else {
      renameProject(currentProjectId, projectName.trim());
    }
    setProjectModalOpen(false);
    setDuplicateFromId('');
  };
  const handleDeleteProject = async () => {
    if (projects.length <= 1) return;
    const confirmed = await showAppConfirm(`Delete project "${currentProject?.name || 'Current Project'}"?`, 'Delete');
    if (!confirmed) return;
    await deleteProject(currentProjectId);
    const nextId = useProjectStore.getState().currentProjectId;
    const nextState = await useProjectStore.getState().loadProjectState(nextId);
    useAppStore.getState().resetState();
    if (nextState) useAppStore.getState().setState(nextState as any);
  };

  const readStore = (db: IDBDatabase, storeName: string) => new Promise<any[]>((resolve) => {
    const tx = db.transaction([storeName], 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  const writeStore = (db: IDBDatabase, storeName: string, records: any[]) => new Promise<void>((resolve) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });

  const handleExportProjectBackup = async () => {
    saveState();
    const db = useProjectStore.getState().db;
    if (!db) return;
    const backup: Record<string, any[]> = {};
    for (const storeName of Array.from(db.objectStoreNames)) {
      backup[storeName] = await readStore(db, storeName);
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `appscreen-backup-${date}.json`);
  };

  const handleImportProjectBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const db = useProjectStore.getState().db;
      if (!db) return;
      for (const storeName of Array.from(db.objectStoreNames)) {
        if (Array.isArray(backup[storeName])) {
          await writeStore(db, storeName, backup[storeName]);
        }
      }
      await useProjectStore.getState().loadProjects();
      const id = useProjectStore.getState().currentProjectId;
      const importedState = await useProjectStore.getState().loadProjectState(id);
      useAppStore.getState().resetState();
      if (importedState) useAppStore.getState().setState(importedState as any);
    } catch (err) {
      console.error('Failed to import backup:', err);
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      const reorderScreenshots = useAppStore.getState().reorderScreenshots;
      reorderScreenshots(dragIndex, toIndex);
      saveState();
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenuIndex(contextMenuIndex === index ? null : index);
  };

  const handleCloseContextMenu = () => {
    setContextMenuIndex(null);
  };

  // Style transfer handlers
  const transferStyle = useAppStore((s) => s.transferStyle);
  const applyStyleToAll = useAppStore((s) => s.applyStyleToAll);
  const setCurrentScreenshotAsDefault = useAppStore((s) => s.setCurrentScreenshotAsDefault);

  const handleStartTransfer = (sourceIndex: number) => {
    setTransferSource(sourceIndex);
    handleCloseContextMenu();
  };

  const handleApplyTransfer = (targetIndex: number) => {
    if (transferSource !== null) {
      transferStyle(transferSource, targetIndex);
      saveState();
    }
    setTransferSource(null);
    handleCloseContextMenu();
  };

  const handleCancelTransfer = () => {
    setTransferSource(null);
  };

  const handleApplyStyleToAll = (sourceIndex: number) => {
    applyStyleToAll(sourceIndex);
    saveState();
    handleCloseContextMenu();
  };

  // Export with language dialog
  const handleExportAllClick = () => {
    if (projectLanguages.length > 1) {
      setExportLangDialogOpen(true);
    } else {
      handleExportAll();
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <div className="sidebar-header">
          <h2>Project</h2>
          <div className="sidebar-header-buttons">
            <div className="language-picker" style={{ position: 'relative' }}>
              <button className="language-btn" onClick={() => setLanguageMenuOpen(!languageMenuOpen)} title="Language">
                <span className="language-btn-flag">{LANGUAGE_FLAGS[currentLanguage] || '🇺🇸'}</span>
              </button>
              {languageMenuOpen && (
                <div className="language-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100 }}>
                  <div className="language-menu-items">
                    {projectLanguages.map((lang) => (
                      <button key={lang} className={`language-menu-item${lang === currentLanguage ? ' selected' : ''}`}
                        onClick={() => { setCurrentLanguage(lang); setLanguageMenuOpen(false); }}>
                        {LANGUAGE_FLAGS[lang] || '🌐'} {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="language-menu-divider" />
                  <button className="language-menu-edit" onClick={() => { setLanguageMenuOpen(false); setTranslateAllOpen(true); }}>
                    Translate All...
                  </button>
                  <button className="language-menu-edit" onClick={() => { setLanguageMenuOpen(false); setLanguagesModalOpen(true); }}>
                    Edit Languages...
                  </button>
                </div>
              )}
            </div>
            <button className="settings-btn" title="Magical Titles" onClick={() => setMagicalTitlesOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6z"/></svg></button>
            <button className="settings-btn" title="About" onClick={() => setAboutModalOpen(true)}><img src="img/info.svg" width="18" height="18" alt="About" /></button>
            <button className="settings-btn" title="Settings" onClick={() => setSettingsModalOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg></button>
          </div>
        </div>

        <div className="project-controls">
          <div className="project-dropdown">
            <button className="project-trigger" onClick={() => setProjectMenuOpen(!projectMenuOpen)}>
              <div className="project-trigger-info">
                <span className="project-trigger-name">{currentProject?.name || 'Default Project'}</span>
                <span className="project-trigger-meta">{screenshots.length} screenshots</span>
              </div>
              <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {projectMenuOpen && (
              <div className="project-menu">
                {projects.map((p) => (
                  <div key={p.id} className={`project-option${p.id === currentProjectId ? ' selected' : ''}`}
                    onClick={async () => {
                      if (p.id !== currentProjectId) {
                        // Save current state, switch, then load new project state
                        saveState();
                        await switchProject(p.id);
                        const newState = await useProjectStore.getState().loadProjectState(p.id);
                        useAppStore.getState().resetState();
                        if (newState) useAppStore.getState().setState(newState as any);
                      }
                      setProjectMenuOpen(false);
                    }}>
                    <span className="project-option-name">{p.name}</span>
                    <span className="project-option-meta">{p.screenshotCount} screenshots</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="project-buttons">
            <button className="project-btn" title="New Project" onClick={handleNewProject}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></button>
            <button className="project-btn" title="Rename Project" onClick={handleRenameProject}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
            <button className="project-btn" title="Export Backup" onClick={handleExportProjectBackup}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>
            <button className="project-btn" title="Import Backup" onClick={() => backupInputRef.current?.click()}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></button>
            <button className="project-btn danger" title="Delete Project" onClick={handleDeleteProject}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
          </div>
        </div>

        <div className="divider"/>
        <h2>Screenshots</h2>
        <input ref={fileInputRef} type="file" id="file-input" multiple accept="image/*" hidden onChange={handleFileUpload}/>
        <input ref={backupInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportProjectBackup}/>
        {/* Transfer mode hint */}
        {transferSource !== null && (
          <div className="transfer-hint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--accent-subtle-strong)', border: '1px solid var(--accent)', borderRadius: '8px', marginBottom: '8px', fontSize: '12px', color: 'var(--accent)' }}>
            <span>Click a screenshot to apply style from #{transferSource + 1}</span>
            <button className="transfer-cancel" onClick={handleCancelTransfer} style={{ padding: '4px 10px', border: 'none', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
          </div>
        )}

        <div className="screenshot-list" id="screenshot-list">
          {screenshots.map((s, i) => (
            <div
              key={i}
              className={`screenshot-item${i === selectedIndex ? ' selected' : ''}${dragIndex === i ? ' dragging' : ''}${dragOverIndex === i ? ' drag-insert-after' : ''}${transferSource !== null && transferSource !== i ? ' transfer-source-option' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                if (transferSource !== null) {
                  handleApplyTransfer(i);
                } else {
                  selectScreenshot(i);
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, i)}
            >
              <div className="drag-handle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', color: 'var(--text-secondary)', opacity: 0.4, cursor: 'grab', flexShrink: 0 }}>
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="14" r="1.5"/></svg>
              </div>
              <div className="screenshot-thumb">
                {(() => {
                  const img = s.localizedImages?.[currentLanguage]?.image
                    || s.localizedImages?.['en']?.image
                    || s.image;
                  return img ? <img src={img.src} alt={s.name}/> : <div className="screenshot-thumb-blank">Blank</div>;
                })()}
              </div>
              <div className="screenshot-info">
                <span className="screenshot-name">{s.name}</span>
                <span className="screenshot-device" style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginTop: '1px' }}>
                  {s.deviceType || outputDevice}
                  {' '}
                  {Object.keys(s.localizedImages || {}).map(lang => (
                    <span key={lang} title={lang} style={{ fontSize: '11px' }}>{LANGUAGE_FLAGS[lang] || '🌐'}</span>
                  ))}
                </span>
              </div>
              <div className="screenshot-actions">
                <button className="screenshot-action-btn" onClick={(e) => { e.stopPropagation(); duplicateScreenshot(i); saveState(); }} title="Duplicate">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                <button className="screenshot-action-btn" onClick={(e) => { e.stopPropagation(); handleContextMenu(e, i); }} title="More">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                </button>
                <button className="screenshot-action-btn danger" onClick={(e) => { e.stopPropagation(); deleteScreenshot(i); saveState(); }} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Context Menu */}
              {contextMenuIndex === i && (
                <div className="screenshot-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px', minWidth: '220px', zIndex: 100, boxShadow: '0 4px 12px var(--shadow-color)', display: 'block' }}>
                  <button className="screenshot-menu-item" onClick={(e) => { e.stopPropagation(); handleStartTransfer(i); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}>
                    📋 Copy Style to Another Screenshot
                  </button>
                  <button className="screenshot-menu-item" onClick={(e) => { e.stopPropagation(); handleApplyStyleToAll(i); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}>
                    📋 Apply Style to All Screenshots
                  </button>
                  <button className="screenshot-menu-item" onClick={(e) => { e.stopPropagation(); setCurrentScreenshotAsDefault(); saveState(); handleCloseContextMenu(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}>
                    ⭐ Set as Default Style
                  </button>
                  {projectLanguages.length > 1 && (
                    <button className="screenshot-menu-item" onClick={(e) => { e.stopPropagation(); selectScreenshot(i); setTranslationsModalOpen(true); handleCloseContextMenu(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}>
                      🌐 Screenshot Translations
                    </button>
                  )}
                  <button className="screenshot-menu-item" onClick={(e) => { e.stopPropagation(); duplicateScreenshot(i); saveState(); handleCloseContextMenu(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}>
                    📄 Duplicate
                  </button>
                  <button className="screenshot-menu-item danger" onClick={(e) => { e.stopPropagation(); deleteScreenshot(i); saveState(); handleCloseContextMenu(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', borderRadius: '6px', textAlign: 'left' }}>
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Click outside to close context menu */}
        {contextMenuIndex !== null && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={handleCloseContextMenu} />
        )}
      </div>

      <div className="sidebar-add-buttons">
        <button className="add-btn" onClick={() => fileInputRef.current?.click()}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>Add Screenshots</button>
        {isTauri && <button className="add-btn" onClick={handleTauriImport}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>Import Files</button>}
        <button className="add-btn add-blank-btn" onClick={handleAddBlank}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>Blank Screen</button>
      </div>

      <div className="sidebar-footer">
        <div className="export-output-section">
          <div className="export-row">
            <div className="output-size-dropdown">
              <select value={outputDevice} onChange={(e) => { setOutputDevice(e.target.value); saveState(); }} className="output-size-select">
                <optgroup label="iPhone">
                  <option value="iphone-6.9">iPhone 6.9" (1320 × 2868)</option>
                  <option value="iphone-6.7">iPhone 6.7" (1290 × 2796)</option>
                  <option value="iphone-6.5">iPhone 6.5" (1284 × 2778)</option>
                  <option value="iphone-5.5">iPhone 5.5" (1242 × 2208)</option>
                </optgroup>
                <optgroup label="iPad">
                  <option value="ipad-12.9">iPad 12.9" (2048 × 2732)</option>
                  <option value="ipad-11">iPad 11" (1668 × 2388)</option>
                </optgroup>
                <optgroup label="Android">
                  <option value="android-phone">Android Phone (1080 × 1920)</option>
                  <option value="android-phone-hd">Android Phone HD (1440 × 2560)</option>
                  <option value="android-tablet-7">Android Tablet 7" (1200 × 1920)</option>
                  <option value="android-tablet-10">Android Tablet 10" (1600 × 2560)</option>
                </optgroup>
                <optgroup label="Web">
                  <option value="web-og">Open Graph (1200 × 630)</option>
                  <option value="web-twitter">Twitter/X Card (1200 × 675)</option>
                  <option value="web-hero">Website Hero (1920 × 1080)</option>
                  <option value="web-feature">Feature Graphic (1024 × 500)</option>
                </optgroup>
                <option value="custom">Custom ({customWidth} × {customHeight})</option>
              </select>
            </div>
            <button className="export-btn secondary" title="Export current" onClick={handleExportCurrent}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>
          </div>
          {/* Custom size inputs */}
          {outputDevice === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>W</label>
              <input type="number" min="100" max="4000" value={customWidth}
                onChange={(e) => { useAppStore.getState().setCustomDimensions(parseInt(e.target.value) || 1290, customHeight); saveState(); }}
                style={{ flex: 1, padding: '4px 6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }} />
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>H</label>
              <input type="number" min="100" max="4000" value={customHeight}
                onChange={(e) => { useAppStore.getState().setCustomDimensions(customWidth, parseInt(e.target.value) || 2796); saveState(); }}
                style={{ flex: 1, padding: '4px 6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }} />
            </div>
          )}
          <button className="export-btn export-all-btn" title="Export all as ZIP" onClick={handleExportAllClick}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Export All</button>
        </div>
      </div>

      {projectModalOpen && (
        <div className="modal-overlay" onClick={() => setProjectModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{projectModalMode === 'new' ? 'New Project' : 'Rename Project'}</h3>
            <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" className="modal-input" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleProjectModalConfirm(); }}/>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Duplicate from existing project (optional)</label>
              <select
                onChange={(e) => setDuplicateFromId(e.target.value)}
                value={duplicateFromId}
                style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px' }}
              >
                <option value="">— New empty project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="modal-buttons">
              <button className="modal-btn secondary" onClick={() => setProjectModalOpen(false)}>Cancel</button>
              <button className="modal-btn primary" onClick={handleProjectModalConfirm}>{projectModalMode === 'new' ? 'Create' : 'Rename'}</button>
            </div>
          </div>
        </div>
      )}

      <AboutModal isOpen={aboutModalOpen} onClose={() => setAboutModalOpen(false)} />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
      <LanguagesModal isOpen={languagesModalOpen} onClose={() => setLanguagesModalOpen(false)} />
      <TranslateAllModal isOpen={translateAllOpen} onClose={() => setTranslateAllOpen(false)} />
      <MagicalTitlesModal isOpen={magicalTitlesOpen} onClose={() => setMagicalTitlesOpen(false)} />
      <ExportProgressModal isOpen={exportProgress.isOpen} progress={exportProgress.progress} status={exportProgress.status} detail={exportProgress.detail} />
      <ScreenshotTranslationsModal isOpen={translationsModalOpen} onClose={() => setTranslationsModalOpen(false)} screenshots={screenshots} selectedIndex={selectedIndex} />

      {/* Export Language Dialog */}
      {exportLangDialogOpen && (
        <div className="modal-overlay" onClick={() => setExportLangDialogOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export Options</h3>
            <div className="export-options" style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0' }}>
              <button className="export-option" onClick={() => { setExportLangDialogOpen(false); handleExportAll(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <span className="export-option-title" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Current Language Only</span>
                <span className="export-option-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Export screenshots in the current language ({currentLanguage})</span>
              </button>
              <button className="export-option" onClick={() => { setExportLangDialogOpen(false); handleExportAllAllLanguages(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <span className="export-option-title" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>All Languages</span>
                <span className="export-option-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Export screenshots in all project languages (separate folders)</span>
              </button>
            </div>
            <div className="modal-buttons">
              <button className="modal-btn secondary" onClick={() => setExportLangDialogOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
