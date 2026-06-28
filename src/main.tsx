/**
 * React entry point for the active screenshot generator.
 *
 * This file performs only browser-global startup work that must happen before
 * React renders: loading CSS and applying the persisted/OS theme onto the root
 * document element. Application state, IndexedDB project loading, and autosave
 * are owned by `App.tsx`.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

/**
 * Applies the saved theme before the first paint.
 *
 * `themePreference` accepts `light`, `dark`, or `auto`. Auto mode removes the
 * manual `data-theme` override so the CSS `prefers-color-scheme` media query
 * stays the source of truth.
 */
function initTheme() {
  const saved = localStorage.getItem('themePreference') || 'auto';
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved;
  } else {
    delete document.documentElement.dataset.theme;
  }
}
initTheme();

// Keep `auto` theme in sync with OS changes without touching explicit choices.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem('themePreference') || 'auto') === 'auto') {
    delete document.documentElement.dataset.theme;
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
