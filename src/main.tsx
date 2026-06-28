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
 * `themePreference` accepts `light`, `dark`, or `auto`. The original vanilla app
 * set `data-theme` before wiring the UI, so React does the same here to avoid a
 * visible flash when the user's preference differs from the default dark theme.
 */
function initTheme() {
  const saved = localStorage.getItem('themePreference') || 'dark';
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved;
  } else {
    document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
initTheme();

// Keep `auto` theme in sync with OS changes without touching explicit choices.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem('themePreference') || 'dark') === 'auto') {
    document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
