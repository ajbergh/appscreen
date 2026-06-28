/**
 * Popout editor for cropped callouts from the selected screenshot image.
 *
 * Popouts store crop percentages against the source image and placement
 * percentages against the output canvas. This panel manages list ordering,
 * thumbnail previews, crop-rectangle dragging, and shadow/border styling.
 */
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { PopoutSettings } from '../../types';
import { getScreenshotImage } from '../../hooks/useCanvas';

/**
 * Renders a small canvas thumbnail of the popout crop region.
 */
function PopoutThumb({ popout, sourceImage }: { popout: PopoutSettings; sourceImage: HTMLImageElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !sourceImage) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 56;
    canvas.height = 56;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = (popout.cropX / 100) * sourceImage.width;
    const sy = (popout.cropY / 100) * sourceImage.height;
    const sw = (popout.cropWidth / 100) * sourceImage.width;
    const sh = (popout.cropHeight / 100) * sourceImage.height;
    ctx.drawImage(sourceImage, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }, [popout, sourceImage]);

  return <canvas ref={ref} />;
}

/**
 * Renders popout creation, ordering, crop, and style controls.
 */
export function PopoutsPanel() {
  const currentScreenshot = useAppStore((s) => s.getCurrentScreenshot());
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);
  const selectedPopoutId = useAppStore((s) => s.selectedPopoutId);
  const setSelectedPopoutId = useAppStore((s) => s.setSelectedPopoutId);

  const [cropCursor, setCropCursor] = useState('default');
  const cropPreviewRef = useRef<HTMLCanvasElement>(null);
  const cropDragRef = useRef<{
    mode: string;
    startX: number;
    startY: number;
    original: PopoutSettings;
  } | null>(null);

  const popouts = currentScreenshot?.popouts || [];
  const selectedPopout = popouts.find((p) => p.id === selectedPopoutId) || null;
  const sourceImage = currentScreenshot ? getScreenshotImage(currentScreenshot, currentLanguage, projectLanguages) : null;
  const hasImage = !!sourceImage;

  /** Formats percentage/pixel values like the vanilla popout inspector. */
  const formatValue = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  };

  /**
   * Applies partial popout updates to the selected screenshot.
   */
  const updatePopout = (id: string, updates: Partial<PopoutSettings>) => {
    const newPopouts = popouts.map((p) => p.id === id ? { ...p, ...updates } : p);
    updateScreenshot(selectedIndex, { popouts: newPopouts });
  };

  /**
   * Converts a pointer event to the crop-preview canvas coordinate space.
   */
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  /**
   * Computes the letterboxed image-fit layout within the crop preview canvas,
   * mirroring legacy `getCropPreviewLayout`. Crop rectangles are positioned and
   * sized against this drawn rect (drawX/drawY/drawW/drawH), not the full canvas.
   */
  const getCropPreviewLayout = (canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const w = canvas.width;
    const h = canvas.height;
    const imgAspect = img.width / img.height;
    const canvasAspect = w / h;
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgAspect > canvasAspect) {
      drawW = w;
      drawH = w / imgAspect;
      drawX = 0;
      drawY = (h - drawH) / 2;
    } else {
      drawH = h;
      drawW = h * imgAspect;
      drawX = (w - drawW) / 2;
      drawY = 0;
    }
    return { drawX, drawY, drawW, drawH };
  };

  /**
   * Converts crop percentages to preview-canvas pixels for drawing and hit tests,
   * offset and scaled by the letterboxed image layout.
   */
  const getCropRect = (p: PopoutSettings, canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const { drawX, drawY, drawW, drawH } = getCropPreviewLayout(canvas, img);
    return {
      x: drawX + (p.cropX / 100) * drawW,
      y: drawY + (p.cropY / 100) * drawH,
      w: (p.cropWidth / 100) * drawW,
      h: (p.cropHeight / 100) * drawH,
    };
  };

  /**
   * Returns the active crop handle or move mode at a preview-canvas point.
   */
  const hitTestCrop = (p: PopoutSettings, canvas: HTMLCanvasElement, x: number, y: number) => {
    if (!sourceImage) return '';
    const r = getCropRect(p, canvas, sourceImage);
    const hs = 12;
    const handles = [
      ['nw', r.x, r.y], ['n', r.x + r.w / 2, r.y], ['ne', r.x + r.w, r.y],
      ['w', r.x, r.y + r.h / 2], ['e', r.x + r.w, r.y + r.h / 2],
      ['sw', r.x, r.y + r.h], ['s', r.x + r.w / 2, r.y + r.h], ['se', r.x + r.w, r.y + r.h],
    ] as const;
    for (const [mode, hx, hy] of handles) {
      if (Math.abs(x - hx) <= hs && Math.abs(y - hy) <= hs) return mode;
    }
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return 'move';
    return '';
  };

  /**
   * Maps crop handles to the resize cursors used by the original crop editor.
   */
  const getCropCursor = (mode: string) => {
    const cursorMap: Record<string, string> = {
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize',
      move: 'move',
    };
    return cursorMap[mode] || 'default';
  };

  /**
   * Keeps crop percentages inside the source image with a minimum visible size.
   */
  const clampCrop = (crop: Partial<PopoutSettings>) => {
    const min = 5;
    let cropX = crop.cropX ?? 0;
    let cropY = crop.cropY ?? 0;
    let cropWidth = Math.max(min, crop.cropWidth ?? min);
    let cropHeight = Math.max(min, crop.cropHeight ?? min);
    cropX = Math.max(0, Math.min(100 - cropWidth, cropX));
    cropY = Math.max(0, Math.min(100 - cropHeight, cropY));
    cropWidth = Math.max(min, Math.min(100 - cropX, cropWidth));
    cropHeight = Math.max(min, Math.min(100 - cropY, cropHeight));
    return { cropX, cropY, cropWidth, cropHeight };
  };

  /**
   * Starts dragging either the crop rectangle or one of its resize handles.
   */
  const handleCropPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selectedPopout) return;
    const point = getCanvasPoint(e);
    const mode = hitTestCrop(selectedPopout, e.currentTarget, point.x, point.y);
    setCropCursor(getCropCursor(mode));
    if (!mode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDragRef.current = { mode, startX: point.x, startY: point.y, original: selectedPopout };
  };

  /**
   * Converts pointer movement into crop percentage changes and clamps the result
   * before writing it to screenshot state.
   */
  const handleCropPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = cropDragRef.current;
    if (!selectedPopout || !sourceImage) return;
    const canvas = e.currentTarget;
    const point = getCanvasPoint(e);
    if (!drag) {
      setCropCursor(getCropCursor(hitTestCrop(selectedPopout, canvas, point.x, point.y)));
      return;
    }
    const { drawW, drawH } = getCropPreviewLayout(canvas, sourceImage);
    const dx = ((point.x - drag.startX) / drawW) * 100;
    const dy = ((point.y - drag.startY) / drawH) * 100;
    const o = drag.original;
    let crop = { cropX: o.cropX, cropY: o.cropY, cropWidth: o.cropWidth, cropHeight: o.cropHeight };

    if (drag.mode === 'move') {
      crop.cropX = o.cropX + dx;
      crop.cropY = o.cropY + dy;
    } else {
      if (drag.mode.includes('w')) { crop.cropX = o.cropX + dx; crop.cropWidth = o.cropWidth - dx; }
      if (drag.mode.includes('e')) { crop.cropWidth = o.cropWidth + dx; }
      if (drag.mode.includes('n')) { crop.cropY = o.cropY + dy; crop.cropHeight = o.cropHeight - dy; }
      if (drag.mode.includes('s')) { crop.cropHeight = o.cropHeight + dy; }
    }

    // Pin the opposite edge when west/north handles hit the minimum crop size.
    const min = 5;
    if (drag.mode.includes('w')) {
      const right = o.cropX + o.cropWidth;
      crop.cropX = Math.max(0, Math.min(right - min, crop.cropX));
      crop.cropWidth = right - crop.cropX;
    }
    if (drag.mode.includes('n')) {
      const bottom = o.cropY + o.cropHeight;
      crop.cropY = Math.max(0, Math.min(bottom - min, crop.cropY));
      crop.cropHeight = bottom - crop.cropY;
    }
    updatePopout(selectedPopout.id, clampCrop(crop));
  };

  /**
   * Finishes crop dragging and releases pointer capture.
   */
  const handleCropPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (cropDragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      cropDragRef.current = null;
    }
  };

  /** Clears resize cursor feedback after leaving the crop canvas. */
  const handleCropPointerLeave = () => {
    if (!cropDragRef.current) setCropCursor('default');
  };

  /**
   * Adds a default popout crop when the selected screenshot has source imagery.
   */
  const addPopout = () => {
    if (!hasImage) return;
    const p: PopoutSettings = {
      id: crypto.randomUUID(),
      cropX: 25, cropY: 25, cropWidth: 30, cropHeight: 30,
      x: 70, y: 30, width: 30,
      rotation: 0, opacity: 100, cornerRadius: 12,
      shadow: { enabled: true, color: '#000000', blur: 30, opacity: 40, x: 0, y: 15 },
      border: { enabled: true, color: '#ffffff', width: 3, opacity: 100 },
    };
    updateScreenshot(selectedIndex, { popouts: [...popouts, p] });
    setSelectedPopoutId(p.id);
  };

  /**
   * Removes a popout and clears selection if it was active.
   */
  const deletePopout = (id: string) => {
    updateScreenshot(selectedIndex, { popouts: popouts.filter((p) => p.id !== id) });
    if (selectedPopoutId === id) setSelectedPopoutId(null);
  };

  /**
   * Reorders popouts; later entries are rendered above earlier popouts.
   */
  const movePopout = (id: string, direction: 'up' | 'down') => {
    const idx = popouts.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const newPopouts = [...popouts];
    if (direction === 'up' && idx < newPopouts.length - 1) {
      [newPopouts[idx], newPopouts[idx + 1]] = [newPopouts[idx + 1], newPopouts[idx]];
    } else if (direction === 'down' && idx > 0) {
      [newPopouts[idx], newPopouts[idx - 1]] = [newPopouts[idx - 1], newPopouts[idx]];
    }
    updateScreenshot(selectedIndex, { popouts: newPopouts });
  };

  // Draw crop preview and interactive handles whenever the crop or source image changes.
  useEffect(() => {
    if (!selectedPopout || !sourceImage || !cropPreviewRef.current) return;
    const canvas = cropPreviewRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const containerWidth = canvas.parentElement?.clientWidth || 280;
    const imgAspect = sourceImage.width / sourceImage.height;
    const canvasW = containerWidth * 2;
    const canvasH = Math.round(canvasW / imgAspect);
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = Math.round(containerWidth / imgAspect) + 'px';

    // Letterbox the image within the canvas and position the crop rect against it.
    const { drawX, drawY, drawW, drawH } = getCropPreviewLayout(canvas, sourceImage);

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Draw full image
    ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);

    // Dim overlay
    const rx = drawX + (selectedPopout.cropX / 100) * drawW;
    const ry = drawY + (selectedPopout.cropY / 100) * drawH;
    const rw = (selectedPopout.cropWidth / 100) * drawW;
    const rh = (selectedPopout.cropHeight / 100) * drawH;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Clear crop region
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.clearRect(rx, ry, rw, rh);
    ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(10, 132, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    // Handles
    const handleSize = 8;
    const handles = [
      { x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx, y: ry + rh }, { x: rx + rw, y: ry + rh },
      { x: rx + rw / 2, y: ry }, { x: rx + rw / 2, y: ry + rh },
      { x: rx, y: ry + rh / 2 }, { x: rx + rw, y: ry + rh / 2 },
    ];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(10, 132, 255, 1)';
    ctx.lineWidth = 1.5;
    handles.forEach(h => {
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    });
  }, [selectedPopout, sourceImage]);

  return (
    <div className="tab-content active" id="tab-popouts">
      <div className="control-group">
        <button className="add-btn" onClick={addPopout} disabled={!hasImage} style={{ opacity: hasImage ? 1 : 0.4 }}>
          + Add Popout
        </button>
        {!hasImage && <p className="hint-text">Upload a screenshot image first to add popouts.</p>}
      </div>

      <div id="popouts-list">
        {popouts.length === 0 ? (
          <div id="popouts-empty" className="empty-message">No popouts yet.</div>
        ) : (
          popouts.map((p, idx) => (
            <div key={p.id} className={`popout-item${p.id === selectedPopoutId ? ' selected' : ''}`} onClick={() => setSelectedPopoutId(p.id)}>
              <div className="popout-item-thumb"><PopoutThumb popout={p} sourceImage={sourceImage} /></div>
              <div className="popout-item-info">
                <div className="popout-item-name">Popout {idx + 1}</div>
                <div className="popout-item-crop">{Math.round(p.cropWidth)}% × {Math.round(p.cropHeight)}%</div>
              </div>
              <div className="popout-item-actions">
                <button className="element-item-btn" onClick={(e) => { e.stopPropagation(); movePopout(p.id, 'up'); }}>↑</button>
                <button className="element-item-btn" onClick={(e) => { e.stopPropagation(); movePopout(p.id, 'down'); }}>↓</button>
                <button className="element-item-btn danger" onClick={(e) => { e.stopPropagation(); deletePopout(p.id); }}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedPopout && (
        <div id="popout-properties" style={{ marginTop: '16px' }}>
          {/* Crop */}
          <div className="control-group">
            <label className="control-label">Crop X</label>
            <div className="control-row">
              <input type="range" min="0" max={100 - selectedPopout.cropWidth} value={selectedPopout.cropX}
                onChange={(e) => updatePopout(selectedPopout.id, { cropX: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.cropX)}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Crop Y</label>
            <div className="control-row">
              <input type="range" min="0" max={100 - selectedPopout.cropHeight} value={selectedPopout.cropY}
                onChange={(e) => updatePopout(selectedPopout.id, { cropY: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.cropY)}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Crop Width</label>
            <div className="control-row">
              <input type="range" min="5" max={100 - selectedPopout.cropX} value={selectedPopout.cropWidth}
                onChange={(e) => updatePopout(selectedPopout.id, { cropWidth: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.cropWidth)}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Crop Height</label>
            <div className="control-row">
              <input type="range" min="5" max={100 - selectedPopout.cropY} value={selectedPopout.cropHeight}
                onChange={(e) => updatePopout(selectedPopout.id, { cropHeight: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.cropHeight)}%</span>
            </div>
          </div>

          {/* Crop Preview */}
          <div className="control-group">
            <label className="control-label">Crop Preview</label>
            <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
              <canvas
                ref={cropPreviewRef}
                id="popout-crop-preview"
                style={{ display: 'block', width: '100%', touchAction: 'none', cursor: cropCursor }}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
                onPointerLeave={handleCropPointerLeave}
              />
            </div>
          </div>

          {/* Position */}
          <div className="control-group">
            <label className="control-label">Position X</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={selectedPopout.x}
                onChange={(e) => updatePopout(selectedPopout.id, { x: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.x)}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Position Y</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={selectedPopout.y}
                onChange={(e) => updatePopout(selectedPopout.id, { y: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.y)}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Width</label>
            <div className="control-row">
              <input type="range" min="5" max="100" value={selectedPopout.width}
                onChange={(e) => updatePopout(selectedPopout.id, { width: parseInt(e.target.value) })} />
              <span className="control-value">{formatValue(selectedPopout.width)}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Rotation</label>
            <div className="control-row">
              <input type="range" min="-180" max="180" value={selectedPopout.rotation}
                onChange={(e) => updatePopout(selectedPopout.id, { rotation: parseInt(e.target.value) })} />
              <span className="control-value">{selectedPopout.rotation}°</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Opacity</label>
            <div className="control-row">
              <input type="range" min="0" max="100" value={selectedPopout.opacity}
                onChange={(e) => updatePopout(selectedPopout.id, { opacity: parseInt(e.target.value) })} />
              <span className="control-value">{selectedPopout.opacity}%</span>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">Corner Radius</label>
            <div className="control-row">
              <input type="range" min="0" max="50" value={selectedPopout.cornerRadius}
                onChange={(e) => updatePopout(selectedPopout.id, { cornerRadius: parseInt(e.target.value) })} />
              <span className="control-value">{selectedPopout.cornerRadius}px</span>
            </div>
          </div>

          {/* Shadow */}
          <div className="control-group">
            <div className={`toggle-row${selectedPopout.shadow.enabled ? '' : ' collapsed'}`}>
              <label className="control-label">Shadow</label>
              <div className={`toggle${selectedPopout.shadow.enabled ? ' active' : ''}`}
                onClick={() => updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, enabled: !selectedPopout.shadow.enabled } })}>
                <div className="toggle-handle" />
              </div>
            </div>
          </div>
          {selectedPopout.shadow.enabled && (
            <>
              <div className="control-group">
                <label className="control-label">Shadow Blur</label>
                <div className="control-row">
                  <input type="range" min="0" max="100" value={selectedPopout.shadow.blur}
                    onChange={(e) => updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, blur: parseInt(e.target.value) } })} />
                  <span className="control-value">{selectedPopout.shadow.blur}px</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Shadow Opacity</label>
                <div className="control-row">
                  <input type="range" min="0" max="100" value={selectedPopout.shadow.opacity}
                    onChange={(e) => updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, opacity: parseInt(e.target.value) } })} />
                  <span className="control-value">{selectedPopout.shadow.opacity}%</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Shadow X</label>
                <div className="control-row">
                  <input type="range" min="-50" max="50" value={selectedPopout.shadow.x}
                    onChange={(e) => updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, x: parseInt(e.target.value) } })} />
                  <span className="control-value">{selectedPopout.shadow.x}px</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Shadow Y</label>
                <div className="control-row">
                  <input type="range" min="-50" max="100" value={selectedPopout.shadow.y}
                    onChange={(e) => updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, y: parseInt(e.target.value) } })} />
                  <span className="control-value">{selectedPopout.shadow.y}px</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Shadow Color</label>
                <div className="control-row">
                  <input type="color" value={selectedPopout.shadow.color}
                    onChange={(e) => updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, color: e.target.value } })}
                    className="color-input-small" />
                  <input
                    type="text"
                    value={selectedPopout.shadow.color}
                    onChange={(e) => {
                      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                        updatePopout(selectedPopout.id, { shadow: { ...selectedPopout.shadow, color: e.target.value } });
                      }
                    }}
                    className="hex-input"
                  />
                </div>
              </div>
            </>
          )}

          {/* Border */}
          <div className="control-group">
            <div className={`toggle-row${selectedPopout.border.enabled ? '' : ' collapsed'}`}>
              <label className="control-label">Border</label>
              <div className={`toggle${selectedPopout.border.enabled ? ' active' : ''}`}
                onClick={() => updatePopout(selectedPopout.id, { border: { ...selectedPopout.border, enabled: !selectedPopout.border.enabled } })}>
                <div className="toggle-handle" />
              </div>
            </div>
          </div>
          {selectedPopout.border.enabled && (
            <>
              <div className="control-group">
                <label className="control-label">Border Width</label>
                <div className="control-row">
                  <input type="range" min="1" max="20" value={selectedPopout.border.width}
                    onChange={(e) => updatePopout(selectedPopout.id, { border: { ...selectedPopout.border, width: parseInt(e.target.value) } })} />
                  <span className="control-value">{selectedPopout.border.width}px</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Border Opacity</label>
                <div className="control-row">
                  <input type="range" min="0" max="100" value={selectedPopout.border.opacity}
                    onChange={(e) => updatePopout(selectedPopout.id, { border: { ...selectedPopout.border, opacity: parseInt(e.target.value) } })} />
                  <span className="control-value">{selectedPopout.border.opacity}%</span>
                </div>
              </div>
              <div className="control-group">
                <label className="control-label">Border Color</label>
                <div className="control-row">
                  <input type="color" value={selectedPopout.border.color}
                    onChange={(e) => updatePopout(selectedPopout.id, { border: { ...selectedPopout.border, color: e.target.value } })}
                    className="color-input-small" />
                  <input
                    type="text"
                    value={selectedPopout.border.color}
                    onChange={(e) => {
                      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                        updatePopout(selectedPopout.id, { border: { ...selectedPopout.border, color: e.target.value } });
                      }
                    }}
                    className="hex-input"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
