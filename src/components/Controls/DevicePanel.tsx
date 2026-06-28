/**
 * Device editor for 2D screenshot placement and 3D mockup controls.
 *
 * The values edited here are consumed by both the Canvas renderer and the
 * Three.js adapter, so slider ranges intentionally match the vanilla app's
 * exported-pixel behavior rather than only the visible preview size.
 */
import { useAppStore } from '../../stores/appStore';

const POSITION_PRESETS = [
  { id: 'centered', label: 'Centered', scale: 70, x: 50, y: 50, rotation: 0 },
  { id: 'bleed-bottom', label: 'Bleed Bottom', scale: 85, x: 50, y: 120, rotation: 0 },
  { id: 'bleed-top', label: 'Bleed Top', scale: 85, x: 50, y: -20, rotation: 0 },
  { id: 'float-center', label: 'Float Center', scale: 60, x: 50, y: 50, rotation: 0 },
  { id: 'tilt-left', label: 'Tilt Left', scale: 65, x: 50, y: 60, rotation: -8 },
  { id: 'tilt-right', label: 'Tilt Right', scale: 65, x: 50, y: 60, rotation: 8 },
  { id: 'perspective', label: 'Perspective', scale: 65, x: 50, y: 50, rotation: 0, perspective: 15 },
  { id: 'float-bottom', label: 'Float Bottom', scale: 55, x: 50, y: 70, rotation: 0 },
];

const FRAME_COLORS: Record<string, { id: string; label: string; swatch: string }[]> = {
  iphone: [
    { id: 'natural', label: 'Natural Titanium', swatch: '#9d927f' },
    { id: 'blue', label: 'Blue Titanium', swatch: '#3d4d5c' },
    { id: 'white', label: 'White Titanium', swatch: '#e3ddd4' },
    { id: 'black', label: 'Black Titanium', swatch: '#3a3632' },
    { id: 'desert', label: 'Desert Titanium', swatch: '#c4a882' },
    { id: 'deep-purple', label: 'Deep Purple', swatch: '#5b4a6e' },
    { id: 'gold', label: 'Gold', swatch: '#e3c8a0' },
    { id: 'red', label: 'Product Red', swatch: '#c1272d' },
  ],
  ipad: [
    { id: 'space-gray', label: 'Space Gray', swatch: '#5f6062' },
    { id: 'silver', label: 'Silver', swatch: '#d8d8d3' },
    { id: 'starlight', label: 'Starlight', swatch: '#e7decf' },
    { id: 'blue', label: 'Blue', swatch: '#9eb3c9' },
    { id: 'purple', label: 'Purple', swatch: '#b6abc9' },
  ],
  samsung: [
    { id: 'gray', label: 'Titanium Gray', swatch: '#8a8a8a' },
    { id: 'black', label: 'Titanium Black', swatch: '#2a2a2a' },
    { id: 'silverblue', label: 'Titanium Silverblue', swatch: '#a8b8c8' },
    { id: 'whitesilver', label: 'Titanium Whitesilver', swatch: '#e8e4df' },
    { id: 'pinkgold', label: 'Titanium Pinkgold', swatch: '#d4a89a' },
    { id: 'jadegreen', label: 'Titanium Jadegreen', swatch: '#9aaa9c' },
    { id: 'jetblack', label: 'Titanium Jetblack', swatch: '#404040' },
  ],
};

/**
 * Renders screenshot/device controls for the selected screenshot.
 */
export function DevicePanel() {
  const currentScreenshot = useAppStore((s) => s.getCurrentScreenshot());
  const setScreenshotSetting = useAppStore((s) => s.setScreenshotSetting);

  const ss = currentScreenshot?.screenshot || {
    scale: 70, y: 60, x: 50, rotation: 0, perspective: 0, cornerRadius: 24,
    use3D: false, device3D: 'iphone' as const, rotation3D: { x: 0, y: 0, z: 0 },
    shadow: { enabled: true, color: '#000000', blur: 40, opacity: 30, x: 0, y: 20 },
    frame: { enabled: false, color: '#1d1d1f', width: 12, opacity: 100 },
  };

  return (
    <div className="tab-content active" id="tab-screenshot">
      {/* 2D/3D Mode Toggle */}
      <div className="control-group">
        <label className="control-label">Mode</label>
        <div className="btn-group" id="device-type-selector">
          <button className={!ss.use3D ? 'active' : ''} onClick={() => setScreenshotSetting('use3D', false)}>2D</button>
          <button className={ss.use3D ? 'active' : ''} onClick={() => setScreenshotSetting('use3D', true)}>3D</button>
        </div>
      </div>

      {/* 3D Device Selector */}
      {ss.use3D && (
        <div className="control-group">
          <label className="control-label">Device Model</label>
          <div className="btn-group" id="device-3d-selector">
            <button className={ss.device3D === 'iphone' ? 'active' : ''} onClick={() => setScreenshotSetting('device3D', 'iphone')}>iPhone</button>
            <button className={ss.device3D === 'ipad' ? 'active' : ''} onClick={() => setScreenshotSetting('device3D', 'ipad')}>iPad</button>
            <button className={ss.device3D === 'samsung' ? 'active' : ''} onClick={() => setScreenshotSetting('device3D', 'samsung')}>Samsung</button>
          </div>
        </div>
      )}

      {/* 3D Rotation Controls */}
      {ss.use3D && (
        <>
          <div className="control-group">
            <label className="control-label">Rotation X (Tilt)</label>
            <div className="control-row">
              <input type="range" min="-45" max="45" value={ss.rotation3D.x}
                onChange={(e) => setScreenshotSetting('rotation3D.x', parseInt(e.target.value))} />
              <span className="control-value">{ss.rotation3D.x}°</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Rotation Y (Turn)</label>
            <div className="control-row">
              <input type="range" min="-45" max="45" value={ss.rotation3D.y}
                onChange={(e) => setScreenshotSetting('rotation3D.y', parseInt(e.target.value))} />
              <span className="control-value">{ss.rotation3D.y}°</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Rotation Z (Roll)</label>
            <div className="control-row">
              <input type="range" min="-45" max="45" value={ss.rotation3D.z}
                onChange={(e) => setScreenshotSetting('rotation3D.z', parseInt(e.target.value))} />
              <span className="control-value">{ss.rotation3D.z}°</span>
            </div>
          </div>
        </>
      )}

      {/* Frame Color Swatches — always visible in 3D mode */}
      {ss.use3D && FRAME_COLORS[ss.device3D] && (
        <div className="control-group">
          <label className="control-label">Frame Color</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            {FRAME_COLORS[ss.device3D].map((fc) => (
              <div
                key={fc.id}
                title={fc.label}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: fc.swatch, cursor: 'pointer',
                  border: ss.frameColor === fc.id ? '2px solid var(--accent)' : '2px solid transparent',
                  boxShadow: ss.frameColor === fc.id ? '0 0 0 1px var(--accent)' : 'none',
                }}
                onClick={() => setScreenshotSetting('frameColor', fc.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Screenshot Scale — shown in both 2D and 3D modes */}
      <div className="control-group">
        <label className="control-label">Screenshot Scale</label>
        <div className="control-row">
          <input type="range" min="30" max="100" value={ss.scale}
            onChange={(e) => setScreenshotSetting('scale', parseInt(e.target.value))} />
          <span className="control-value">{ss.scale}%</span>
        </div>
      </div>

      {/* Vertical Position — shown in both 2D and 3D modes */}
      <div className="control-group">
        <label className="control-label">Vertical Position</label>
        <div className="control-row">
          <input type="range" min="-80" max="180" value={ss.y}
            onChange={(e) => setScreenshotSetting('y', parseInt(e.target.value))} />
          <span className="control-value">{ss.y}%</span>
        </div>
      </div>

      {/* Horizontal Position — shown in both 2D and 3D modes */}
      <div className="control-group">
        <label className="control-label">Horizontal Position</label>
        <div className="control-row">
          <input type="range" min="-80" max="180" value={ss.x}
            onChange={(e) => setScreenshotSetting('x', parseInt(e.target.value))} />
          <span className="control-value">{ss.x}%</span>
        </div>
      </div>

      {/* 2D-only: Rotation, Corner Radius, Position Presets */}
      {!ss.use3D && (
        <>
          <div className="control-group">
            <label className="control-label">Rotation</label>
            <div className="control-row">
              <input type="range" min="-45" max="45" value={ss.rotation}
                onChange={(e) => setScreenshotSetting('rotation', parseInt(e.target.value))} />
              <span className="control-value">{ss.rotation}°</span>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Corner Radius</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={ss.cornerRadius}
                onChange={(e) => setScreenshotSetting('cornerRadius', parseInt(e.target.value))} />
              <span className="control-value">{ss.cornerRadius}px</span>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Position Presets</label>
            <div className="preset-grid">
              {POSITION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-btn"
                  onClick={() => {
                    setScreenshotSetting('scale', preset.scale);
                    setScreenshotSetting('x', preset.x);
                    setScreenshotSetting('y', preset.y);
                    setScreenshotSetting('rotation', preset.rotation);
                    if ('perspective' in preset) setScreenshotSetting('perspective', preset.perspective);
                    else setScreenshotSetting('perspective', 0);
                  }}
                  title={preset.label}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 3D drag hint */}
      {ss.use3D && (
        <div className="tip-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--accent-subtle)', borderRadius: '8px', marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          Interactive Controls — Drag on preview to rotate + Alt+drag to move
        </div>
      )}

      {/* Shadow */}
      <div className="control-group">
        <div className="toggle-row">
          <label className="control-label">Shadow</label>
          <div className={`toggle${ss.shadow.enabled ? ' active' : ''}`}
            onClick={() => setScreenshotSetting('shadow.enabled', !ss.shadow.enabled)}>
            <div className="toggle-handle" />
          </div>
        </div>
        {ss.shadow.enabled && (
          <>
            <div className="control-row">
              <label>Blur</label>
              <input type="range" min="0" max="100" value={ss.shadow.blur}
                onChange={(e) => setScreenshotSetting('shadow.blur', parseInt(e.target.value))} />
              <span className="control-value">{ss.shadow.blur}px</span>
            </div>
            <div className="control-row">
              <label>Opacity</label>
              <input type="range" min="0" max="100" value={ss.shadow.opacity}
                onChange={(e) => setScreenshotSetting('shadow.opacity', parseInt(e.target.value))} />
              <span className="control-value">{ss.shadow.opacity}%</span>
            </div>
            <div className="control-row">
              <label>X Offset</label>
              <input type="range" min="-50" max="50" value={ss.shadow.x}
                onChange={(e) => setScreenshotSetting('shadow.x', parseInt(e.target.value))} />
              <span className="control-value">{ss.shadow.x}px</span>
            </div>
            <div className="control-row">
              <label>Y Offset</label>
              <input type="range" min="-50" max="100" value={ss.shadow.y}
                onChange={(e) => setScreenshotSetting('shadow.y', parseInt(e.target.value))} />
              <span className="control-value">{ss.shadow.y}px</span>
            </div>
            <div className="control-row">
              <label>Color</label>
              <input type="color" value={ss.shadow.color}
                onChange={(e) => setScreenshotSetting('shadow.color', e.target.value)}
                className="color-input-small" />
            </div>
          </>
        )}
      </div>

      {/* Frame (border) */}
      <div className="control-group">
        <div className="toggle-row">
          <label className="control-label">Frame</label>
          <div className={`toggle${ss.frame.enabled ? ' active' : ''}`}
            onClick={() => setScreenshotSetting('frame.enabled', !ss.frame.enabled)}>
            <div className="toggle-handle" />
          </div>
        </div>
        {ss.frame.enabled && (
          <>
            <div className="control-row">
              <label>Width</label>
              <input type="range" min="1" max="50" value={ss.frame.width}
                onChange={(e) => setScreenshotSetting('frame.width', parseInt(e.target.value))} />
              <span className="control-value">{ss.frame.width}px</span>
            </div>
            <div className="control-row">
              <label>Opacity</label>
              <input type="range" min="0" max="100" value={ss.frame.opacity}
                onChange={(e) => setScreenshotSetting('frame.opacity', parseInt(e.target.value))} />
              <span className="control-value">{ss.frame.opacity}%</span>
            </div>
            <div className="control-row">
              <label>Color</label>
              <input type="color" value={ss.frame.color}
                onChange={(e) => setScreenshotSetting('frame.color', e.target.value)}
                className="color-input-small" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
