import { useState, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { FontPicker } from '../UI/FontPicker';
import { EmojiPicker, IconPicker, TranslateModal } from '../Modals/AllModals';
import type { ElementSettings } from '../../types';

const LAYERS = [
  { value: 'behind-screenshot', label: 'Behind' },
  { value: 'above-screenshot', label: 'Middle' },
  { value: 'above-text', label: 'Front' },
];

export function ElementsPanel() {
  const currentScreenshot = useAppStore((s) => s.getCurrentScreenshot());
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const screenshots = useAppStore((s) => s.screenshots);
  const currentLanguage = useAppStore((s) => s.currentLanguage);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [translateModalOpen, setTranslateModalOpen] = useState(false);
  const graphicInputRef = useRef<HTMLInputElement>(null);

  const elements = currentScreenshot?.elements || [];
  const selectedElement = elements.find((el) => el.id === selectedElementId) || null;

  const getIconDataUrl = async (iconName: string, color = '#ffffff', strokeWidth = 2) => {
    let svgText = localStorage.getItem(`lucide-svg:${iconName}`) || '';
    if (!svgText) {
      try {
        const resp = await fetch(`https://unpkg.com/lucide-static@latest/icons/${iconName}.svg`);
        if (resp.ok) {
          svgText = await resp.text();
          localStorage.setItem(`lucide-svg:${iconName}`, svgText);
        }
      } catch { /* fall through to local fallback */ }
    }
    if (!svgText) {
      const label = iconName.split('-').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
      svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><text x="12" y="15" text-anchor="middle" font-size="7" fill="currentColor" stroke="none" font-family="Arial, sans-serif">${label}</text></svg>`;
    }
    const colorized = svgText
      .replace(/stroke="currentColor"/g, `stroke="${color}"`)
      .replace(/fill="currentColor"/g, `fill="${color}"`)
      .replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colorized)}`;
  };

  const reloadIconImage = async (el: ElementSettings, newElements: ElementSettings[]) => {
    if (el.type !== 'icon' || !el.iconName) return;
    try {
      const src = await getIconDataUrl(el.iconName, el.iconColor || '#ffffff', el.iconStrokeWidth || 2);
      const img = new Image();
      img.onload = () => {
        const updated = newElements.map((e) => e.id === el.id ? { ...e, image: img, src } : e);
        updateScreenshot(selectedIndex, { elements: updated });
      };
      img.src = src;
    } catch { /* ignore */ }
  };

  const updateElement = (id: string, updates: Partial<ElementSettings>) => {
    const updatedEl = { ...elements.find((el) => el.id === id)!, ...updates };
    const newElements = elements.map((el) => el.id === id ? updatedEl : el);
    updateScreenshot(selectedIndex, { elements: newElements });
    // Re-fetch icon SVG if color or stroke width changed
    if (updatedEl.type === 'icon' && ('iconColor' in updates || 'iconStrokeWidth' in updates)) {
      reloadIconImage(updatedEl, newElements);
    }
  };

  const addGraphicElement = () => { graphicInputRef.current?.click(); };

  const handleGraphicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const el: ElementSettings = {
          id: crypto.randomUUID(), type: 'graphic',
          x: 50, y: 50, width: 20, rotation: 0, opacity: 100,
          layer: 'above-text', image: img, src: ev.target?.result as string,
          name: file.name, text: '', texts: {},
          font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
          fontSize: 60, fontWeight: '600', fontColor: '#ffffff', italic: false,
          frame: 'none', frameColor: '#ffffff', frameScale: 100,
        };
        updateScreenshot(selectedIndex, { elements: [...elements, el] });
        setSelectedElementId(el.id);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (graphicInputRef.current) graphicInputRef.current.value = '';
  };

  const addTextElement = () => {
    const el: ElementSettings = {
      id: crypto.randomUUID(), type: 'text',
      x: 50, y: 50, width: 40, rotation: 0, opacity: 100,
      layer: 'above-text', image: null, src: null, name: 'Text',
      text: 'Your Text', texts: { en: 'Your Text' },
      font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
      fontSize: 60, fontWeight: '600', fontColor: '#ffffff', italic: false,
      frame: 'none', frameColor: '#ffffff', frameScale: 100,
    };
    updateScreenshot(selectedIndex, { elements: [...elements, el] });
    setSelectedElementId(el.id);
  };

  const addEmojiElement = (emoji: string, name = 'Emoji') => {
    const el: ElementSettings = {
      id: crypto.randomUUID(), type: 'emoji',
      x: 50, y: 50, width: 15, rotation: 0, opacity: 100,
      layer: 'above-text', emoji, name, image: null, src: null,
      text: '', texts: {},
      font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
      fontSize: 60, fontWeight: '600', fontColor: '#ffffff', italic: false,
      frame: 'none', frameColor: '#ffffff', frameScale: 100,
    };
    updateScreenshot(selectedIndex, { elements: [...elements, el] });
    setSelectedElementId(el.id);
  };

  const addIconElement = (iconName: string) => {
    const el: ElementSettings = {
      id: crypto.randomUUID(), type: 'icon',
      x: 50, y: 50, width: 15, rotation: 0, opacity: 100,
      layer: 'above-text', iconName, iconColor: '#ffffff', iconStrokeWidth: 2,
      iconShadow: { enabled: false, color: '#000000', blur: 20, opacity: 40, x: 0, y: 10 },
      image: null, src: null, name: iconName,
      text: '', texts: {},
      font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'",
      fontSize: 60, fontWeight: '600', fontColor: '#ffffff', italic: false,
      frame: 'none', frameColor: '#ffffff', frameScale: 100,
    };
    updateScreenshot(selectedIndex, { elements: [...elements, el] });
    setSelectedElementId(el.id);
    getIconDataUrl(iconName, el.iconColor, el.iconStrokeWidth)
      .then(src => {
        const img = new Image();
        img.onload = () => {
          const updatedElements = [...(currentScreenshot?.elements || [])];
          const idx = updatedElements.findIndex(e => e.id === el.id);
          if (idx >= 0) { updatedElements[idx] = { ...updatedElements[idx], image: img, src }; updateScreenshot(selectedIndex, { elements: updatedElements }); }
        };
        img.src = src;
      }).catch(() => {});
  };

  const deleteElement = (id: string) => {
    updateScreenshot(selectedIndex, { elements: elements.filter((e) => e.id !== id) });
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const moveElement = (id: string, direction: 'up' | 'down') => {
    const idx = elements.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const newElements = [...elements];
    if (direction === 'up' && idx < newElements.length - 1) {
      [newElements[idx], newElements[idx + 1]] = [newElements[idx + 1], newElements[idx]];
    } else if (direction === 'down' && idx > 0) {
      [newElements[idx], newElements[idx - 1]] = [newElements[idx - 1], newElements[idx]];
    }
    updateScreenshot(selectedIndex, { elements: newElements });
  };

  const getElementText = (el: ElementSettings) => {
    if (el.texts) return el.texts[currentLanguage] || el.texts['en'] || Object.values(el.texts).find(v => v) || el.text || '';
    return el.text || '';
  };

  return (
    <div className="tab-content active" id="tab-elements">
      <input ref={graphicInputRef} type="file" accept="image/*" hidden onChange={handleGraphicUpload} />
      <div className="control-group">
        <label className="control-label">Add Element</label>
        <div className="btn-group">
          <button onClick={addGraphicElement} className="add-btn-small">📷 Graphic</button>
          <button onClick={addTextElement} className="add-btn-small">📝 Text</button>
          <button onClick={() => setEmojiPickerOpen(true)} className="add-btn-small">😀 Emoji</button>
          <button onClick={() => setIconPickerOpen(true)} className="add-btn-small">⭐ Icon</button>
        </div>
      </div>

      <div id="elements-list">
        {elements.length === 0 ? (
          <div id="elements-empty" className="empty-message">No elements yet. Add a graphic, text, emoji, or icon element.</div>
        ) : (
          elements.map((el) => (
            <div key={el.id} className={`element-item${el.id === selectedElementId ? ' selected' : ''}`} onClick={() => setSelectedElementId(el.id)}>
              <div className="element-item-thumb">
                {el.type === 'graphic' && el.image ? <img src={el.image.src} alt={el.name} /> :
                 el.type === 'emoji' ? <span className="emoji-thumb">{el.emoji}</span> :
                 el.type === 'icon' && el.image ? <img src={el.image.src} alt={el.name} style={{ padding: '4px', filter: 'var(--icon-thumb-filter, none)' }} /> : <span>📝</span>}
              </div>
              <div className="element-item-info">
                <div className="element-item-name">{el.type === 'text' ? (getElementText(el) || 'Text') : el.type === 'emoji' ? `${el.emoji} ${el.name}` : el.name}</div>
                <div className="element-item-layer">{LAYERS.find(l => l.value === el.layer)?.label || el.layer}</div>
              </div>
              <div className="element-item-actions">
                <button className="element-item-btn" onClick={(e) => { e.stopPropagation(); moveElement(el.id, 'up'); }}>↑</button>
                <button className="element-item-btn" onClick={(e) => { e.stopPropagation(); moveElement(el.id, 'down'); }}>↓</button>
                <button className="element-item-btn danger" onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedElement && (
        <div id="element-properties" style={{ marginTop: '16px' }}>
          <div className="control-group">
            <label className="control-label">
              {selectedElement.type === 'text' ? 'Text Element' : selectedElement.type === 'emoji' ? `${selectedElement.emoji} Emoji` : selectedElement.type === 'icon' ? `Icon: ${selectedElement.name}` : selectedElement.name || 'Graphic'}
            </label>
          </div>
          <div className="control-group">
            <label className="control-label">X Position</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: parseInt(e.target.value) })} />
              <span className="control-value">{selectedElement.x}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Y Position</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: parseInt(e.target.value) })} />
              <span className="control-value">{selectedElement.y}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Width</label>
            <div className="control-row">
              <input type="range" min="1" max="100" value={selectedElement.width} onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} />
              <span className="control-value">{selectedElement.width}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Rotation</label>
            <div className="control-row">
              <input type="range" min="-180" max="180" value={selectedElement.rotation} onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })} />
              <span className="control-value">{selectedElement.rotation}°</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Opacity</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={selectedElement.opacity} onChange={(e) => updateElement(selectedElement.id, { opacity: parseInt(e.target.value) })} />
              <span className="control-value">{selectedElement.opacity}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Layer</label>
            <select value={selectedElement.layer} onChange={(e) => updateElement(selectedElement.id, { layer: e.target.value as 'behind-screenshot' | 'above-screenshot' | 'above-text' })}>
              {LAYERS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          {selectedElement.type === 'text' && (
            <>
              <div className="control-group">
                <label className="control-label">Text</label>
                <input type="text" value={getElementText(selectedElement)} onChange={(e) => updateElement(selectedElement.id, { text: e.target.value, texts: { ...selectedElement.texts, [currentLanguage]: e.target.value } })} className="text-input" />
              </div>
              <div className="control-group">
                <label className="control-label">Font</label>
                <FontPicker value={selectedElement.font} onChange={(v) => updateElement(selectedElement.id, { font: v })} />
              </div>
              <div className="control-group">
                <label className="control-label">Font Size</label>
                <div className="control-row">
                  <input type="range" min="10" max="200" value={selectedElement.fontSize} onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })} />
                  <span className="control-value">{selectedElement.fontSize}px</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Font Color</label>
                <input type="color" value={selectedElement.fontColor} onChange={(e) => updateElement(selectedElement.id, { fontColor: e.target.value })} className="color-input-small" />
              </div>
              <div className="control-group">
                <label className="control-label">Font Weight</label>
                <select value={selectedElement.fontWeight} onChange={(e) => updateElement(selectedElement.id, { fontWeight: e.target.value })}>
                  <option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option>
                  <option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra Bold</option><option value="900">Black</option>
                </select>
              </div>
              <div className="control-group">
                <label className="control-label">Style</label>
                <div className="btn-group small">
                  <button className={selectedElement.italic ? 'active' : ''} onClick={() => updateElement(selectedElement.id, { italic: !selectedElement.italic })}><em>I</em></button>
                </div>
              </div>
              <div className="control-group">
                <button className="add-btn-small" onClick={() => setTranslateModalOpen(true)}>✨ Translate Text Element</button>
              </div>
              <div className="control-group">
                <label className="control-label">Frame</label>
                <select value={selectedElement.frame || 'none'} onChange={(e) => updateElement(selectedElement.id, { frame: e.target.value })}>
                  <option value="none">None</option>
                  <option value="laurel-simple">Laurel Simple</option>
                  <option value="laurel-simple-star">Laurel Simple + Star</option>
                  <option value="laurel-detailed">Laurel Detailed</option>
                  <option value="laurel-detailed-star">Laurel Detailed + Star</option>
                  <option value="badge-circle">Badge Circle</option>
                  <option value="badge-ribbon">Badge Ribbon</option>
                </select>
              </div>
              {selectedElement.frame && selectedElement.frame !== 'none' && (
                <>
                  <div className="control-group">
                    <label className="control-label">Frame Color</label>
                    <input type="color" value={selectedElement.frameColor} onChange={(e) => updateElement(selectedElement.id, { frameColor: e.target.value })} className="color-input-small" />
                  </div>
                  <div className="control-group">
                    <label className="control-label">Frame Scale</label>
                    <div className="control-row">
                      <input type="range" min="50" max="200" value={selectedElement.frameScale} onChange={(e) => updateElement(selectedElement.id, { frameScale: parseInt(e.target.value) })} />
                      <span className="control-value">{selectedElement.frameScale}%</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {selectedElement.type === 'icon' && (
            <>
              <div className="control-group">
                <label className="control-label">Icon Color</label>
                <input type="color" value={selectedElement.iconColor || '#ffffff'} onChange={(e) => updateElement(selectedElement.id, { iconColor: e.target.value })} className="color-input-small" />
              </div>
              <div className="control-group">
                <label className="control-label">Stroke Width</label>
                <div className="control-row">
                  <input type="range" min="1" max="5" step="0.5" value={selectedElement.iconStrokeWidth || 2} onChange={(e) => updateElement(selectedElement.id, { iconStrokeWidth: parseFloat(e.target.value) })} />
                  <span className="control-value">{selectedElement.iconStrokeWidth || 2}</span>
                </div>
              </div>
              <div className="control-group">
                <div className="toggle-row">
                  <label className="control-label">Shadow</label>
                  <div className={`toggle${selectedElement.iconShadow?.enabled ? ' active' : ''}`}
                    onClick={() => updateElement(selectedElement.id, { iconShadow: { ...(selectedElement.iconShadow || { color: '#000000', blur: 20, opacity: 40, x: 0, y: 10 }), enabled: !selectedElement.iconShadow?.enabled } })}>
                    <div className="toggle-handle" />
                  </div>
                </div>
              </div>
              {selectedElement.iconShadow?.enabled && (
                <>
                  <div className="control-group">
                    <label className="control-label">Shadow Blur</label>
                    <div className="control-row">
                      <input type="range" min="0" max="50" value={selectedElement.iconShadow.blur} onChange={(e) => updateElement(selectedElement.id, { iconShadow: { ...selectedElement.iconShadow!, blur: parseInt(e.target.value) } })} />
                      <span className="control-value">{selectedElement.iconShadow.blur}px</span>
                    </div>
                  </div>
                  <div className="control-group">
                    <label className="control-label">Shadow Opacity</label>
                    <div className="control-row">
                      <input type="range" min="0" max="100" value={selectedElement.iconShadow.opacity} onChange={(e) => updateElement(selectedElement.id, { iconShadow: { ...selectedElement.iconShadow!, opacity: parseInt(e.target.value) } })} />
                      <span className="control-value">{selectedElement.iconShadow.opacity}%</span>
                    </div>
                  </div>
                  <div className="control-group">
                    <label className="control-label">Shadow X</label>
                    <div className="control-row">
                      <input type="range" min="-50" max="50" value={selectedElement.iconShadow.x} onChange={(e) => updateElement(selectedElement.id, { iconShadow: { ...selectedElement.iconShadow!, x: parseInt(e.target.value) } })} />
                      <span className="control-value">{selectedElement.iconShadow.x}px</span>
                    </div>
                  </div>
                  <div className="control-group">
                    <label className="control-label">Shadow Y</label>
                    <div className="control-row">
                      <input type="range" min="-50" max="50" value={selectedElement.iconShadow.y} onChange={(e) => updateElement(selectedElement.id, { iconShadow: { ...selectedElement.iconShadow!, y: parseInt(e.target.value) } })} />
                      <span className="control-value">{selectedElement.iconShadow.y}px</span>
                    </div>
                  </div>
                  <div className="control-group">
                    <label className="control-label">Shadow Color</label>
                    <input type="color" value={selectedElement.iconShadow.color} onChange={(e) => updateElement(selectedElement.id, { iconShadow: { ...selectedElement.iconShadow!, color: e.target.value } })} className="color-input-small" />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <EmojiPicker
        isOpen={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onSelect={(emoji, name) => { addEmojiElement(emoji, name); setEmojiPickerOpen(false); }}
      />
      <IconPicker
        isOpen={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(iconName) => { addIconElement(iconName); setIconPickerOpen(false); }}
      />
      <TranslateModal
        isOpen={translateModalOpen}
        onClose={() => setTranslateModalOpen(false)}
        target="element"
        elementId={selectedElementId || undefined}
        screenshots={screenshots}
        selectedIndex={selectedIndex}
        currentLanguage={currentLanguage}
      />
    </div>
  );
}
