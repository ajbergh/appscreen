/**
 * Background editor for the right sidebar.
 *
 * Owns gradient/solid/image controls for the selected screenshot, including
 * draggable gradient stops, panoramic image-span detection, image blur/overlay,
 * and noise settings. All writes go through the app store so the canvas preview,
 * exports, and autosave see the same normalized background state.
 */
import { useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { getCanvasDimensions } from '../../canvas/renderer';

const GRADIENT_PRESETS = [
  { name: 'Midnight Abyss', gradient: 'linear-gradient(160deg, #0a0a0f 0%, #1a1033 50%, #0d1b2a 100%)', angle: 160, stops: [{ color: '#0a0a0f', position: 0 }, { color: '#1a1033', position: 50 }, { color: '#0d1b2a', position: 100 }] },
  { name: 'Obsidian Plum', gradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', angle: 135, stops: [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 50 }, { color: '#24243e', position: 100 }] },
  { name: 'Carbon Slate', gradient: 'linear-gradient(180deg, #1c1c1e 0%, #2c2c2e 100%)', angle: 180, stops: [{ color: '#1c1c1e', position: 0 }, { color: '#2c2c2e', position: 100 }] },
  { name: 'Steel Blue', gradient: 'linear-gradient(135deg, #29323c 0%, #485563 100%)', angle: 135, stops: [{ color: '#29323c', position: 0 }, { color: '#485563', position: 100 }] },
  { name: 'Neon Horizon', gradient: 'linear-gradient(125deg, #0d0221 0%, #711c91 50%, #0abdc6 100%)', angle: 125, stops: [{ color: '#0d0221', position: 0 }, { color: '#711c91', position: 50 }, { color: '#0abdc6', position: 100 }] },
  { name: 'Electric Surge', gradient: 'linear-gradient(135deg, #1a0533 0%, #5b21b6 50%, #06b6d4 100%)', angle: 135, stops: [{ color: '#1a0533', position: 0 }, { color: '#5b21b6', position: 50 }, { color: '#06b6d4', position: 100 }] },
  { name: 'Synthwave Dusk', gradient: 'linear-gradient(150deg, #2d1b69 0%, #ff2d78 50%, #ff901f 100%)', angle: 150, stops: [{ color: '#2d1b69', position: 0 }, { color: '#ff2d78', position: 50 }, { color: '#ff901f', position: 100 }] },
  { name: 'Indigo Rush', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }] },
  { name: 'Northern Lights', gradient: 'linear-gradient(135deg, #172347 0%, #015268 40%, #0ef3c5 100%)', angle: 135, stops: [{ color: '#172347', position: 0 }, { color: '#015268', position: 40 }, { color: '#0ef3c5', position: 100 }] },
  { name: 'Deep Forest', gradient: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', angle: 160, stops: [{ color: '#0f2027', position: 0 }, { color: '#203a43', position: 50 }, { color: '#2c5364', position: 100 }] },
  { name: 'Emerald Canopy', gradient: 'linear-gradient(145deg, #134e4a 0%, #065f46 50%, #14532d 100%)', angle: 145, stops: [{ color: '#134e4a', position: 0 }, { color: '#065f46', position: 50 }, { color: '#14532d', position: 100 }] },
  { name: 'Ocean Pulse', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', angle: 135, stops: [{ color: '#4facfe', position: 0 }, { color: '#00f2fe', position: 100 }] },
  { name: 'Desert Dusk', gradient: 'linear-gradient(170deg, #c84c28 0%, #d89c60 50%, #bb8a36 100%)', angle: 170, stops: [{ color: '#c84c28', position: 0 }, { color: '#d89c60', position: 50 }, { color: '#bb8a36', position: 100 }] },
  { name: 'Ember Glow', gradient: 'linear-gradient(140deg, #7c2d12 0%, #c2410c 50%, #fb923c 100%)', angle: 140, stops: [{ color: '#7c2d12', position: 0 }, { color: '#c2410c', position: 50 }, { color: '#fb923c', position: 100 }] },
  { name: 'Mocha Silk', gradient: 'linear-gradient(160deg, #292018 0%, #6b4226 60%, #a07850 100%)', angle: 160, stops: [{ color: '#292018', position: 0 }, { color: '#6b4226', position: 60 }, { color: '#a07850', position: 100 }] },
  { name: 'Golden Hour', gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', angle: 135, stops: [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 100 }] },
  { name: 'Pacific Sunset', gradient: 'linear-gradient(145deg, #f953c6 0%, #b91d73 50%, #4a1942 100%)', angle: 145, stops: [{ color: '#f953c6', position: 0 }, { color: '#b91d73', position: 50 }, { color: '#4a1942', position: 100 }] },
  { name: 'Volcanic Dawn', gradient: 'linear-gradient(130deg, #f12711 0%, #f5af19 100%)', angle: 130, stops: [{ color: '#f12711', position: 0 }, { color: '#f5af19', position: 100 }] },
  { name: 'Deep Ocean', gradient: 'linear-gradient(180deg, #011627 0%, #003459 50%, #007ea7 100%)', angle: 180, stops: [{ color: '#011627', position: 0 }, { color: '#003459', position: 50 }, { color: '#007ea7', position: 100 }] },
  { name: 'Reef Lagoon', gradient: 'linear-gradient(135deg, #1a6b7c 0%, #40b3c8 50%, #7de8dc 100%)', angle: 135, stops: [{ color: '#1a6b7c', position: 0 }, { color: '#40b3c8', position: 50 }, { color: '#7de8dc', position: 100 }] },
  { name: 'Gold Noir', gradient: 'linear-gradient(135deg, #020b13 0%, #1a1200 50%, #c9a227 100%)', angle: 135, stops: [{ color: '#020b13', position: 0 }, { color: '#1a1200', position: 50 }, { color: '#c9a227', position: 100 }] },
  { name: 'Velvet Noir', gradient: 'linear-gradient(150deg, #1a0000 0%, #400128 50%, #6b0f1a 100%)', angle: 150, stops: [{ color: '#1a0000', position: 0 }, { color: '#400128', position: 50 }, { color: '#6b0f1a', position: 100 }] },
  { name: 'Morning Mist', gradient: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)', angle: 135, stops: [{ color: '#e0eafc', position: 0 }, { color: '#cfdef3', position: 100 }] },
  { name: 'Sage Whisper', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', angle: 135, stops: [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 100 }] },
  { name: 'Royal Navy', gradient: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', angle: 135, stops: [{ color: '#1e3c72', position: 0 }, { color: '#2a5298', position: 100 }] },
];

/**
 * Renders controls for the selected screenshot's background settings.
 */
export function BackgroundPanel() {
  const currentScreenshot = useAppStore((s) => s.getCurrentScreenshot());
  const setBackground = useAppStore((s) => s.setBackground);
  const setBackgroundSettings = useAppStore((s) => s.setBackgroundSettings);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const outputDevice = useAppStore((s) => s.outputDevice);
  const customWidth = useAppStore((s) => s.customWidth);
  const customHeight = useAppStore((s) => s.customHeight);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [dragStopIndex, setDragStopIndex] = useState<number | null>(null);
  const saveState = useAppStore((s) => s.saveState);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const stopEditorRef = useRef<HTMLDivElement>(null);

  const bg = currentScreenshot?.background || {
    type: 'gradient',
    gradient: { angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }] },
    solid: '#1a1a2e',
    image: null, imageSrc: null, imageFit: 'cover' as const, imageSpan: false,
    imageBlur: 0, overlayColor: '#000000', overlayOpacity: 0,
    noise: false, noiseIntensity: 10,
  };

  /**
   * Converts a pointer position on the gradient rail into a 0-100 stop position.
   *
   * Stops are sorted after every drag update so the Canvas gradient receives a
   * valid ascending stop list.
   */
  const updateStopPositionFromPointer = (e: React.PointerEvent, index: number) => {
    const rect = stopEditorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const newStops = [...bg.gradient.stops];
    newStops[index] = { ...newStops[index], position: Math.round(position) };
    setBackground('gradient.stops', newStops.sort((a, b) => a.position - b.position));
  };

  return (
    <div className="tab-content active" id="tab-background">
      <div className="control-group">
        <label className="control-label">Background Type</label>
        <div className="btn-group" id="bg-type-selector">
          <button
            className={bg.type === 'gradient' ? 'active' : ''}
            onClick={() => setBackground('type', 'gradient')}
          >
            Gradient
          </button>
          <button
            className={bg.type === 'solid' ? 'active' : ''}
            onClick={() => setBackground('type', 'solid')}
          >
            Solid
          </button>
          <button
            className={bg.type === 'image' ? 'active' : ''}
            onClick={() => setBackground('type', 'image')}
          >
            Image
          </button>
        </div>
      </div>

      {/* Gradient Options */}
      {bg.type === 'gradient' && (
        <div id="gradient-options">
          <div className="control-group">
            <label className="control-label">Angle</label>
            <div className="control-row">
              <input
                type="range"
                min="0"
                max="360"
                value={bg.gradient.angle}
                onChange={(e) => setBackground('gradient.angle', parseInt(e.target.value))}
              />
              <span className="control-value">{bg.gradient.angle}°</span>
            </div>
          </div>

          {/* Gradient Presets */}
          <div className="control-group">
            <div className="preset-dropdown" style={{ position: 'relative' }}>
              <button className="preset-dropdown-trigger" onClick={() => setPresetsOpen(!presetsOpen)}>
                <span>Gradient Presets</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {presetsOpen && (
                <div className="preset-dropdown-content" style={{ display: 'block' }}>
                  <div className="preset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {GRADIENT_PRESETS.map((preset) => (
                      <div
                        key={preset.name}
                        className="preset-swatch"
                        title={preset.name}
                        style={{ aspectRatio: '1', borderRadius: '4px', background: preset.gradient, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={() => {
                          setBackground('gradient.angle', preset.angle);
                          setBackground('gradient.stops', preset.stops);
                          setPresetsOpen(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Color Stops</label>
            <div
              ref={stopEditorRef}
              style={{ position: 'relative', height: '34px', borderRadius: '8px', background: `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.stops.map((stop) => `${stop.color} ${stop.position}%`).join(', ')})`, border: '1px solid var(--border-color)', marginBottom: '10px', touchAction: 'none' }}
              onPointerMove={(e) => { if (dragStopIndex !== null) updateStopPositionFromPointer(e, dragStopIndex); }}
              onPointerUp={() => setDragStopIndex(null)}
              onPointerCancel={() => setDragStopIndex(null)}
            >
              {bg.gradient.stops.map((stop, i) => (
                <button
                  key={`${stop.color}-${i}`}
                  type="button"
                  title={`${stop.position}%`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDragStopIndex(i);
                    updateStopPositionFromPointer(e, i);
                  }}
                  style={{ position: 'absolute', left: `${stop.position}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '18px', height: '18px', borderRadius: '50%', border: '2px solid white', background: stop.color, boxShadow: '0 1px 4px rgba(0,0,0,.35)', cursor: 'ew-resize', padding: 0 }}
                />
              ))}
            </div>
            <div id="gradient-stops">
              {bg.gradient.stops.map((stop, i) => (
                <div key={i} className="gradient-stop">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => {
                      const newStops = [...bg.gradient.stops];
                      newStops[i] = { ...newStops[i], color: e.target.value };
                      setBackground('gradient.stops', newStops);
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={stop.position}
                    onChange={(e) => {
                      const newStops = [...bg.gradient.stops];
                      newStops[i] = { ...newStops[i], position: parseInt(e.target.value) || 0 };
                      setBackground('gradient.stops', newStops);
                    }}
                  />
                  <span>%</span>
                  {bg.gradient.stops.length > 2 && (
                    <button
                      className="screenshot-delete"
                      onClick={() => {
                        const newStops = bg.gradient.stops.filter((_, idx) => idx !== i);
                        setBackground('gradient.stops', newStops);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="add-btn-small"
              onClick={() => {
                const lastStop = bg.gradient.stops[bg.gradient.stops.length - 1];
                const newStops = [...bg.gradient.stops, { color: lastStop.color, position: Math.min(lastStop.position + 20, 100) }];
                setBackground('gradient.stops', newStops);
              }}
            >
              + Add Stop
            </button>
          </div>
        </div>
      )}

      {/* Solid Color Options */}
      {bg.type === 'solid' && (
        <div id="solid-options">
          <div className="control-group">
            <label className="control-label">Color</label>
            <div className="control-row">
              <input
                type="color"
                value={bg.solid}
                onChange={(e) => setBackground('solid', e.target.value)}
                className="color-input"
              />
              <input
                type="text"
                value={bg.solid}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    setBackground('solid', e.target.value);
                  }
                }}
                className="hex-input"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Options */}
      {bg.type === 'image' && (
        <div id="image-options">
          <div className="control-group">
            <label className="control-label">Image</label>
            <input ref={bgImageInputRef} type="file" accept="image/*" id="bg-image-input" hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const imgEl = new Image();
                  imgEl.onload = () => {
                    const src = ev.target?.result as string;
                    const store = useAppStore.getState();
                    const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);
                    const screenRatio = dims.width / dims.height;
                    const imageRatio = imgEl.width / imgEl.height;
                    // Auto-detect wide panoramic image: span if ratio > 1.6x screen ratio and multiple screenshots
                    const isWide = imageRatio > Math.max(screenRatio * 1.6, 1) && store.screenshots.length > 1;
                    const shouldSpan = bg.imageSpan || isWide;

                    if (shouldSpan) {
                      // Apply same image to all screenshots with imageSpan=true
                      const newBg = { ...bg, type: 'image' as const, image: imgEl, imageSrc: src, imageSpan: true };
                      store.screenshots.forEach((_, i) => {
                        store.updateScreenshot(i, { background: { ...newBg } });
                      });
                    } else {
                      updateScreenshot(selectedIndex, {
                        background: { ...bg, type: 'image', image: imgEl, imageSrc: src, imageSpan: false }
                      });
                    }
                    saveState();
                  };
                  imgEl.src = ev.target?.result as string;
                };
                reader.readAsDataURL(file);
              }}
            />
            <button className="add-btn-small" onClick={() => bgImageInputRef.current?.click()}>
              Upload Image
            </button>
            {bg.imageSrc && (
              <img src={bg.imageSrc} alt="Background" id="bg-image-preview" style={{ maxWidth: '100%', marginTop: '8px', borderRadius: '8px' }} />
            )}
          </div>

          <div className="control-group">
            <label className="control-label">Fit</label>
            <select
              value={bg.imageFit}
              onChange={(e) => setBackground('imageFit', e.target.value)}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="stretch">Stretch</option>
            </select>
          </div>

          <div className="control-group">
            <div className="toggle-row">
              <label className="control-label">Span Across Screenshots</label>
              <div
                className={`toggle${bg.imageSpan ? ' active' : ''}`}
                onClick={() => setBackground('imageSpan', !bg.imageSpan)}
              >
                <div className="toggle-handle" />
              </div>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Blur</label>
            <div className="control-row">
              <input
                type="range"
                min="0"
                max="50"
                value={bg.imageBlur}
                onChange={(e) => setBackground('imageBlur', parseInt(e.target.value))}
              />
              <span className="control-value">{bg.imageBlur}px</span>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Overlay Color</label>
            <div className="control-row">
              <input type="color" value={bg.overlayColor} onChange={(e) => setBackground('overlayColor', e.target.value)} className="color-input-small" />
              <input type="text" value={bg.overlayColor} onChange={(e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setBackground('overlayColor', e.target.value); }} className="hex-input" style={{ width: '80px' }} />
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Overlay Opacity</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={bg.overlayOpacity} onChange={(e) => setBackground('overlayOpacity', parseInt(e.target.value))} />
              <span className="control-value">{bg.overlayOpacity}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Noise */}
      <div className="control-group">
        <div className="toggle-row">
          <label className="control-label">Noise</label>
          <div
            className={`toggle${bg.noise ? ' active' : ''}`}
            onClick={() => setBackground('noise', !bg.noise)}
          >
            <div className="toggle-handle" />
          </div>
        </div>
        {bg.noise && (
          <div className="control-row">
            <input
              type="range"
              min="0"
              max="100"
              value={bg.noiseIntensity}
              onChange={(e) => setBackground('noiseIntensity', parseInt(e.target.value))}
            />
            <span className="control-value">{bg.noiseIntensity}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
