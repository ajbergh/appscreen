/**
 * Right-side inspector for screenshot, background, text, element, and popout
 * controls.
 *
 * This file owns only tab selection and panel composition. Individual control
 * panels read and write editor state directly through the app store so the
 * sidebar can stay a thin navigation layer.
 */
import { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { BackgroundPanel } from '../Controls/BackgroundPanel';
import { DevicePanel } from '../Controls/DevicePanel';
import { TextPanel } from '../Controls/TextPanel';
import { ElementsPanel } from '../Controls/ElementsPanel';
import { PopoutsPanel } from '../Controls/PopoutsPanel';

const TABS = [
  { id: 'background', label: 'Background', icon: 'image' },
  { id: 'screenshot', label: 'Device', icon: 'device' },
  { id: 'text', label: 'Text', icon: 'text' },
  { id: 'elements', label: 'Elements', icon: 'grid' },
  { id: 'popouts', label: 'Popouts', icon: 'popout' },
];

/**
 * Renders the tab strip and the active control panel. The selected tab is stored
 * both in Zustand for live UI state and in localStorage so refreshes return to
 * the same inspector panel.
 */
export function RightSidebar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  // Restore active tab from localStorage on mount.
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && TABS.find(t => t.id === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  /**
   * Persists the active inspector tab and updates the visible panel.
   */
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', tab);
  };

  return (
    <div className="sidebar sidebar-right">
      <div className="sidebar-header">
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab${activeTab === tab.id ? ' active' : ''}`}
              data-tab={tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              <TabIcon type={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-content">
        {activeTab === 'background' && <BackgroundPanel />}
        {activeTab === 'screenshot' && <DevicePanel />}
        {activeTab === 'text' && <TextPanel />}
        {activeTab === 'elements' && <ElementsPanel />}
        {activeTab === 'popouts' && <PopoutsPanel />}
      </div>
    </div>
  );
}

/**
 * Small inline icon set used by the inspector tabs. These are kept local because
 * the tab list is fixed and the SVGs avoid an additional icon dependency here.
 */
function TabIcon({ type }: { type: string }) {
  switch (type) {
    case 'image':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    case 'device':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12" y2="18" />
        </svg>
      );
    case 'text':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
      );
    case 'grid':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M17.5 14v7M14 17.5h7" />
        </svg>
      );
    case 'popout':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <rect x="10" y="2" width="12" height="10" rx="2" />
        </svg>
      );
    default:
      return null;
  }
}
