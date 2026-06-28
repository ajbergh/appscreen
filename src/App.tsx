/**
 * Top-level React application shell.
 *
 * `App` is responsible for bootstrapping IndexedDB-backed project state into
 * the Zustand app store, resetting in-memory state between project loads, and
 * installing the debounced autosave loop. It intentionally keeps layout and
 * editing UI delegated to `AppLayout` so persistence concerns stay centralized.
 */
import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './stores/appStore';
import { useProjectStore } from './stores/projectStore';
import { AppLayout } from './components/Layout/AppLayout';

/**
 * Boots persistent project data, installs autosave behavior, and renders the
 * editor layout once storage initialization completes.
 */
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const initDatabase = useProjectStore((s) => s.initDatabase);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const loadProjectState = useProjectStore((s) => s.loadProjectState);
  const setState = useAppStore((s) => s.setState);
  const resetState = useAppStore((s) => s.resetState);
  const saveState = useAppStore((s) => s.saveState);

  // Track every state slice that must be persisted into the current project.
  const screenshots = useAppStore((s) => s.screenshots);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const outputDevice = useAppStore((s) => s.outputDevice);
  const customWidth = useAppStore((s) => s.customWidth);
  const customHeight = useAppStore((s) => s.customHeight);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const defaults = useAppStore((s) => s.defaults);
  const activeTab = useAppStore((s) => s.activeTab);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Initializes storage and loads the current project into the app store.
   *
   * The reset before applying saved state prevents data from a previous project
   * or a failed load from leaking into the current session. Project selection is
   * read from the project store's metadata, then `loadProjectState` hydrates the
   * heavy screenshot/image state.
   */
  useEffect(() => {
    /**
     * Performs the async storage bootstrap used on initial mount.
     */
    const init = async () => {
      try {
        await initDatabase();
        await loadProjects();
        resetState();
        const savedState = await loadProjectState(currentProjectId);
        if (savedState) {
          setState(savedState as any);
        }
      } catch (e) {
        console.error('Failed to initialize app:', e);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  /**
   * Debounced project autosave.
   *
   * The vanilla app persisted as part of `updateCanvas()`. The React refactor
   * instead watches the state that affects saved output and writes after a short
   * delay so rapid slider/text changes do not create excessive IndexedDB writes.
   */
  useEffect(() => {
    if (isLoading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState();
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [screenshots, selectedIndex, outputDevice, customWidth, customHeight, currentLanguage, projectLanguages, defaults, activeTab, isLoading]);

  /**
   * Adds reset buttons to range sliders that are rendered by multiple panels.
   *
   * This mirrors the vanilla enhancement without forcing every control component
   * to duplicate the reset-button markup. The effect is idempotent: rows that
   * already have a `.slider-reset-btn` are skipped.
   */
  useEffect(() => {
    if (isLoading) return;
    document.querySelectorAll<HTMLInputElement>('.control-row input[type="range"]').forEach((slider) => {
      const row = slider.closest('.control-row');
      if (!row || row.querySelector('.slider-reset-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'slider-reset-btn';
      btn.title = 'Reset to default';
      btn.type = 'button';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 1 3 6.75"/><polyline points="3 16 3 10 9 10"/></svg>';
      btn.addEventListener('click', () => {
        slider.value = slider.defaultValue;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      row.appendChild(btn);
    });
  }, [screenshots, selectedIndex, outputDevice, currentLanguage, activeTab, isLoading]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0b', color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}>
        Loading...
      </div>
    );
  }

  return <AppLayout />;
}
