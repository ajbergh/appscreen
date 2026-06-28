import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { getScreenshotImage, renderScreenshotToCanvas, useCanvas } from '../../hooks/useCanvas';
import { useThreeJS } from '../../hooks/useThreeJS';
import { getCanvasDimensions } from '../../canvas/renderer';

export function CanvasArea() {
  const canvasRef = useCanvas();
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const elementDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
  } | null>(null);
  const { initScene, loadPhoneModel, setRotation, setFrameColor, updateScreenTexture, setupDragRotate, stateRef } = useThreeJS(threeContainerRef);
  const [showThreeJS, setShowThreeJS] = useState(false);

  // Side preview canvas refs
  const leftPreviewRef = useRef<HTMLCanvasElement>(null);
  const farLeftPreviewRef = useRef<HTMLCanvasElement>(null);
  const rightPreviewRef = useRef<HTMLCanvasElement>(null);
  const farRightPreviewRef = useRef<HTMLCanvasElement>(null);
  const previousIndexRef = useRef(0);

  // Side preview container refs (for dynamic positioning)
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const farLeftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const farRightContainerRef = useRef<HTMLDivElement>(null);

  const screenshots = useAppStore((s) => s.screenshots);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const selectScreenshot = useAppStore((s) => s.selectScreenshot);
  const setScreenshotSetting = useAppStore((s) => s.setScreenshotSetting);
  const updateScreenshot = useAppStore((s) => s.updateScreenshot);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const saveState = useAppStore((s) => s.saveState);
  const outputDevice = useAppStore((s) => s.outputDevice);
  const customWidth = useAppStore((s) => s.customWidth);
  const customHeight = useAppStore((s) => s.customHeight);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);

  useEffect(() => {
    const previous = previousIndexRef.current;
    if (previous === selectedIndex) return;
    const strip = document.querySelector<HTMLElement>('.preview-strip');
    if (!strip) {
      previousIndexRef.current = selectedIndex;
      return;
    }
    const direction = selectedIndex > previous ? -1 : 1;
    strip.classList.add('sliding');
    strip.style.transition = 'none';
    strip.style.transform = `translateX(${direction * 36}px)`;
    requestAnimationFrame(() => {
      strip.style.transition = 'transform 0.3s ease-out';
      strip.style.transform = 'translateX(0)';
      window.setTimeout(() => {
        strip.classList.remove('sliding');
        strip.style.transition = '';
      }, 320);
    });
    previousIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Initialize Three.js when needed
  useEffect(() => {
    const currentScreenshot = screenshots[selectedIndex];
    const use3D = currentScreenshot?.screenshot?.use3D;

    if (use3D) {
      if (!showThreeJS) {
        setShowThreeJS(true);
        initScene();
        loadPhoneModel(currentScreenshot?.screenshot?.device3D || 'iphone');
      } else if (currentScreenshot?.screenshot?.device3D !== stateRef.current.currentDeviceModel) {
        loadPhoneModel(currentScreenshot?.screenshot?.device3D || 'iphone');
      }
      const img = getScreenshotImage(currentScreenshot, currentLanguage, projectLanguages);
      if (img && stateRef.current.phoneModelLoaded) {
        updateScreenTexture(img);
      }
      setFrameColor(currentScreenshot?.screenshot?.frameColor, currentScreenshot?.screenshot?.device3D || 'iphone');
      if (currentScreenshot?.screenshot?.rotation3D) {
        const { x, y, z } = currentScreenshot.screenshot.rotation3D;
        setRotation(x, y, z);
      }
    } else if (showThreeJS) {
      setShowThreeJS(false);
    }
  }, [screenshots, selectedIndex, currentLanguage, projectLanguages]);

  // Two-finger horizontal swipe to navigate screenshots
  useEffect(() => {
    const strip = document.querySelector('.preview-strip');
    if (!strip) return;
    const SWIPE_THRESHOLD = 50;
    let swipeAccumulator = 0;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      e.stopPropagation();
      swipeAccumulator += e.deltaX;
      if (swipeAccumulator > SWIPE_THRESHOLD) {
        const next = useAppStore.getState().selectedIndex + 1;
        if (next < useAppStore.getState().screenshots.length) selectScreenshot(next);
        swipeAccumulator = 0;
      } else if (swipeAccumulator < -SWIPE_THRESHOLD) {
        const prev = useAppStore.getState().selectedIndex - 1;
        if (prev >= 0) selectScreenshot(prev);
        swipeAccumulator = 0;
      }
    };

    strip.addEventListener('wheel', handleWheel as EventListener, { passive: false });
    return () => strip.removeEventListener('wheel', handleWheel as EventListener);
  }, []);

  // 3D drag-to-rotate
  useEffect(() => {
    const container = canvasRef.current;
    if (!container || !showThreeJS) return;

    const currentScreenshot = screenshots[selectedIndex];
    const rotation3D = currentScreenshot?.screenshot?.rotation3D || { x: 0, y: 0, z: 0 };
    let currentX = rotation3D.x;
    let currentY = rotation3D.y;

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    return setupDragRotate(container, (dx, dy, mode) => {
      if (mode === 'move') {
        const ss = currentScreenshot?.screenshot;
        if (!ss) return;
        const nextX = Math.max(-80, Math.min(180, ss.x + dx * 0.2));
        const nextY = Math.max(-80, Math.min(180, ss.y + dy * 0.2));
        setScreenshotSetting('x', Math.round(nextX));
        setScreenshotSetting('y', Math.round(nextY));
      } else {
        currentY += dx * 0.5;
        currentX -= dy * 0.5;
        currentX = Math.max(-45, Math.min(45, currentX));
        currentY = Math.max(-45, Math.min(45, currentY));
        setRotation(currentX, currentY, currentScreenshot?.screenshot?.rotation3D?.z || 0);
        setScreenshotSetting('rotation3D.x', Math.round(currentX));
        setScreenshotSetting('rotation3D.y', Math.round(currentY));
      }
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveState(), 500);
    });
  }, [showThreeJS, selectedIndex, screenshots]);

  // Render side previews and update their positions
  const renderSidePreview = useCallback((
    canvas: HTMLCanvasElement | null,
    container: HTMLDivElement | null,
    index: number,
    dims: ReturnType<typeof getCanvasDimensions>,
    previewScale: number,
    side: 'left' | 'far-left' | 'right' | 'far-right',
    mainCanvasWidth: number
  ) => {
    if (!canvas || !container || index < 0 || index >= screenshots.length) {
      if (container) container.classList.add('hidden');
      return;
    }

    const screenshot = screenshots[index];
    if (!screenshot) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    // Dynamic positioning matching original updateSidePreviews()
    const gap = 10;
    const sideOffset = mainCanvasWidth / 2 + gap;
    const farSideOffset = sideOffset + mainCanvasWidth + gap;

    if (side === 'left') {
      container.style.right = `calc(50% + ${sideOffset}px)`;
      container.style.left = '';
    } else if (side === 'far-left') {
      container.style.right = `calc(50% + ${farSideOffset}px)`;
      container.style.left = '';
    } else if (side === 'right') {
      container.style.left = `calc(50% + ${sideOffset}px)`;
      container.style.right = '';
    } else if (side === 'far-right') {
      container.style.left = `calc(50% + ${farSideOffset}px)`;
      container.style.right = '';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dims.width;
    canvas.height = dims.height;
    canvas.style.width = `${dims.width * previewScale}px`;
    canvas.style.height = `${dims.height * previewScale}px`;

    void renderScreenshotToCanvas(canvas, screenshot, dims, currentLanguage, index, screenshots, projectLanguages);
  }, [screenshots, currentLanguage, projectLanguages]);

  useEffect(() => {
    const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);
    const maxPreviewWidth = 400;
    const maxPreviewHeight = 700;
    const previewScale = Math.min(maxPreviewWidth / dims.width, maxPreviewHeight / dims.height);
    const mainCanvasWidth = dims.width * previewScale;

    renderSidePreview(leftPreviewRef.current, leftContainerRef.current, selectedIndex - 1, dims, previewScale, 'left', mainCanvasWidth);
    renderSidePreview(farLeftPreviewRef.current, farLeftContainerRef.current, selectedIndex - 2, dims, previewScale, 'far-left', mainCanvasWidth);
    renderSidePreview(rightPreviewRef.current, rightContainerRef.current, selectedIndex + 1, dims, previewScale, 'right', mainCanvasWidth);
    renderSidePreview(farRightPreviewRef.current, farRightContainerRef.current, selectedIndex + 2, dims, previewScale, 'far-right', mainCanvasWidth);
  }, [screenshots, selectedIndex, outputDevice, customWidth, customHeight, currentLanguage, renderSidePreview]);

  const hasScreenshots = screenshots.length > 0;
  const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);
  const maxPreviewWidth = 400;
  const maxPreviewHeight = 700;
  const scale = Math.min(maxPreviewWidth / dims.width, maxPreviewHeight / dims.height);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * dims.width,
      y: ((e.clientY - rect.top) / rect.height) * dims.height,
    };
  };

  const hitTestElement = (x: number, y: number) => {
    const screenshot = screenshots[selectedIndex];
    const elements = screenshot?.elements || [];
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const cx = dims.width * (el.x / 100);
      const cy = dims.height * (el.y / 100);
      const width = dims.width * (el.width / 100);
      let height = width;
      if (el.type === 'text') {
        height = Math.max(el.fontSize * 1.3, width * 0.35);
      } else if (el.type === 'graphic' && el.image) {
        height = width * (el.image.height / el.image.width);
      }
      if (x >= cx - width / 2 && x <= cx + width / 2 && y >= cy - height / 2 && y <= cy + height / 2) {
        return el;
      }
    }
    return null;
  };

  const handleElementPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const screenshot = screenshots[selectedIndex];
    if (!screenshot) return;
    const point = getCanvasPoint(e);
    const el = hitTestElement(point.x, point.y);
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    document.getElementById('canvas-wrapper')?.classList.add('element-dragging');
    setActiveTab('elements');
    elementDragRef.current = {
      id: el.id,
      startX: point.x,
      startY: point.y,
      originalX: el.x,
      originalY: el.y,
    };
  };

  const handleElementPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = elementDragRef.current;
    const screenshot = screenshots[selectedIndex];
    if (!drag || !screenshot) return;
    const point = getCanvasPoint(e);
    const dx = ((point.x - drag.startX) / dims.width) * 100;
    const dy = ((point.y - drag.startY) / dims.height) * 100;
    let nextX = Math.max(0, Math.min(100, drag.originalX + dx));
    let nextY = Math.max(0, Math.min(100, drag.originalY + dy));
    const snapX = Math.abs(nextX - 50) <= 1.5;
    const snapY = Math.abs(nextY - 50) <= 1.5;
    if (snapX) nextX = 50;
    if (snapY) nextY = 50;
    updateScreenshot(selectedIndex, {
      elements: (screenshot.elements || []).map((el) =>
        el.id === drag.id ? { ...el, x: Math.round(nextX * 10) / 10, y: Math.round(nextY * 10) / 10 } : el
      ),
    });
    const ctx = e.currentTarget.getContext('2d');
    if (ctx && (snapX || snapY)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(10, 132, 255, 0.85)';
      ctx.lineWidth = Math.max(2, dims.width * 0.003);
      ctx.setLineDash([dims.width * 0.015, dims.width * 0.01]);
      if (snapX) {
        ctx.beginPath();
        ctx.moveTo(dims.width / 2, 0);
        ctx.lineTo(dims.width / 2, dims.height);
        ctx.stroke();
      }
      if (snapY) {
        ctx.beginPath();
        ctx.moveTo(0, dims.height / 2);
        ctx.lineTo(dims.width, dims.height / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const handleElementPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!elementDragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    elementDragRef.current = null;
    document.getElementById('canvas-wrapper')?.classList.remove('element-dragging');
    saveState();
  };

  return (
    <div className="canvas-area">
      <div className="preview-strip">
        {/* Far left side preview */}
        <div
          ref={farLeftContainerRef}
          className="side-preview side-preview-far-left hidden"
          id="side-preview-far-left"
          onClick={() => { if (selectedIndex >= 2) selectScreenshot(selectedIndex - 2); }}
        >
          <canvas ref={farLeftPreviewRef} id="preview-canvas-far-left" />
        </div>

        {/* Left side preview */}
        <div
          ref={leftContainerRef}
          className="side-preview side-preview-left hidden"
          id="side-preview-left"
          onClick={() => { if (selectedIndex >= 1) selectScreenshot(selectedIndex - 1); }}
        >
          <canvas ref={leftPreviewRef} id="preview-canvas-left" />
        </div>

        {/* Main canvas */}
        <div className="canvas-wrapper" id="canvas-wrapper">
          <canvas
            ref={canvasRef}
            id="preview-canvas"
            onPointerDown={handleElementPointerDown}
            onPointerMove={handleElementPointerMove}
            onPointerUp={handleElementPointerUp}
            onPointerCancel={handleElementPointerUp}
            style={hasScreenshots ? {
              width: `${dims.width * scale}px`,
              height: `${dims.height * scale}px`,
              display: 'block',
            } : undefined}
          />
          <div
            ref={threeContainerRef}
            id="threejs-container"
            style={{ display: showThreeJS ? 'block' : 'none' }}
          />
          {!hasScreenshots && (
            <div className="no-screenshot" id="no-screenshot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <p>Upload screenshots to get started</p>
            </div>
          )}
        </div>

        {/* Right side preview */}
        <div
          ref={rightContainerRef}
          className="side-preview side-preview-right hidden"
          id="side-preview-right"
          onClick={() => { if (selectedIndex < screenshots.length - 1) selectScreenshot(selectedIndex + 1); }}
        >
          <canvas ref={rightPreviewRef} id="preview-canvas-right" />
        </div>

        {/* Far right side preview */}
        <div
          ref={farRightContainerRef}
          className="side-preview side-preview-far-right hidden"
          id="side-preview-far-right"
          onClick={() => { if (selectedIndex < screenshots.length - 2) selectScreenshot(selectedIndex + 2); }}
        >
          <canvas ref={farRightPreviewRef} id="preview-canvas-far-right" />
        </div>
      </div>
    </div>
  );
}
