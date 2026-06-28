/**
 * Center canvas workspace for the screenshot editor.
 *
 * CanvasArea coordinates the live 2D canvas hook, optional Three.js device
 * overlay, adjacent screenshot previews, screenshot navigation gestures, and
 * direct element dragging. Rendering itself stays in `canvas/renderer.ts` and
 * Three.js scene management stays in `hooks/useThreeJS.ts`.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { getScreenshotImage, renderScreenshotToCanvas, setActiveSnapGuides, useCanvas } from '../../hooks/useCanvas';
import { useThreeJS } from '../../hooks/useThreeJS';
import { getCanvasDimensions } from '../../canvas/renderer';

/**
 * Renders the preview strip and wires pointer/gesture interactions to the
 * selected screenshot.
 */
export function CanvasArea() {
  const canvasRef = useCanvas();
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const elementDragRef = useRef<{
    kind: 'element' | 'popout';
    id: string;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
  } | null>(null);
  const { initScene, loadPhoneModel, preloadPhoneModel, setRotation, setFrameColor, updateScreenTexture, setupDragRotate, stateRef } = useThreeJS(threeContainerRef);
  const [showThreeJS, setShowThreeJS] = useState(false);

  // Side preview canvas refs.
  const leftPreviewRef = useRef<HTMLCanvasElement>(null);
  const farLeftPreviewRef = useRef<HTMLCanvasElement>(null);
  const rightPreviewRef = useRef<HTMLCanvasElement>(null);
  const farRightPreviewRef = useRef<HTMLCanvasElement>(null);
  const previousIndexRef = useRef(0);

  // Side preview container refs used for dynamic positioning around the main canvas.
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
  const setSelectedElementId = useAppStore((s) => s.setSelectedElementId);
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
    const slideDims = getCanvasDimensions(outputDevice, customWidth, customHeight);
    const slideScale = Math.min(400 / slideDims.width, 700 / slideDims.height);
    const slideOffset = slideDims.width * slideScale + 10;
    strip.classList.add('sliding');
    strip.style.transition = 'none';
    strip.style.transform = `translateX(${direction * slideOffset}px)`;
    requestAnimationFrame(() => {
      strip.style.transition = 'transform 0.3s ease-out';
      strip.style.transform = 'translateX(0)';
      window.setTimeout(() => {
        strip.classList.remove('sliding');
        strip.style.transition = '';
      }, 320);
    });
    previousIndexRef.current = selectedIndex;
  }, [selectedIndex, outputDevice, customWidth, customHeight]);

  // Initialize or refresh the Three.js model whenever the project needs 3D rendering.
  useEffect(() => {
    const currentScreenshot = screenshots[selectedIndex];
    const use3D = currentScreenshot?.screenshot?.use3D;
    const projectUses3D = screenshots.some((screenshot) => screenshot.screenshot?.use3D);

    if (projectUses3D && !stateRef.current.isInitialized) {
      initScene();
      const first3D = screenshots.find((screenshot) => screenshot.screenshot?.use3D);
      loadPhoneModel(first3D?.screenshot?.device3D || 'iphone');
    }

    if (use3D) {
      const refreshTextureWhenReady = (attempt = 0) => {
        const img = getScreenshotImage(currentScreenshot, currentLanguage, projectLanguages);
        if (img && stateRef.current.phoneModelLoaded) {
          updateScreenTexture(img);
        } else if (attempt < 20) {
          window.setTimeout(() => refreshTextureWhenReady(attempt + 1), 50);
        }
      };

      if (!showThreeJS) {
        setShowThreeJS(true);
        initScene();
        loadPhoneModel(currentScreenshot?.screenshot?.device3D || 'iphone');
      } else if (currentScreenshot?.screenshot?.device3D !== stateRef.current.currentDeviceModel) {
        loadPhoneModel(currentScreenshot?.screenshot?.device3D || 'iphone');
      }
      refreshTextureWhenReady();
      setFrameColor(currentScreenshot?.screenshot?.frameColor, currentScreenshot?.screenshot?.device3D || 'iphone');
      if (currentScreenshot?.screenshot?.rotation3D) {
        const { x, y, z } = currentScreenshot.screenshot.rotation3D;
        setRotation(x, y, z);
      }
    } else if (showThreeJS) {
      setShowThreeJS(false);
    }
  }, [screenshots, selectedIndex, currentLanguage, projectLanguages]);

  // Preload nearby 3D models so side previews and slide navigation do not flash.
  useEffect(() => {
    [selectedIndex - 2, selectedIndex - 1, selectedIndex + 1, selectedIndex + 2].forEach((index) => {
      const screenshot = screenshots[index];
      if (screenshot?.screenshot?.use3D) {
        preloadPhoneModel(screenshot.screenshot.device3D || 'iphone');
      }
    });
  }, [screenshots, selectedIndex, preloadPhoneModel]);

  // Two-finger horizontal swipe to navigate screenshots.
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

  // Enable 3D drag-to-rotate or drag-to-move and debounce persistence while dragging.
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

  /**
   * Renders one adjacent screenshot preview and positions its container relative
   * to the scaled main canvas. Hidden previews keep the DOM stable when there is
   * no screenshot at the requested offset.
   */
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

    // Dynamic positioning matching the original `updateSidePreviews()` layout.
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

  /**
   * Converts viewport pointer coordinates into unscaled export-canvas
   * coordinates so hit tests are independent of the preview scale.
   */
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * dims.width,
      y: ((e.clientY - rect.top) / rect.height) * dims.height,
    };
  };

  /**
   * Returns the topmost draggable popout under a canvas-space point.
   */
  const hitTestPopout = (x: number, y: number) => {
    const screenshot = screenshots[selectedIndex];
    if (!screenshot) return null;
    const image = getScreenshotImage(screenshot, currentLanguage, projectLanguages);
    if (!image) return null;
    const popouts = screenshot.popouts || [];
    for (let i = popouts.length - 1; i >= 0; i--) {
      const popout = popouts[i];
      const cx = dims.width * (popout.x / 100);
      const cy = dims.height * (popout.y / 100);
      const width = dims.width * (popout.width / 100);
      const sw = (popout.cropWidth / 100) * image.width;
      const sh = (popout.cropHeight / 100) * image.height;
      const height = width * (sh / sw);
      if (x >= cx - width / 2 && x <= cx + width / 2 && y >= cy - height / 2 && y <= cy + height / 2) {
        return popout;
      }
    }
    return null;
  };

  /**
   * Returns the topmost draggable overlay element under a canvas-space point.
   * Element bounds are reconstructed from the same percentage-based fields used
   * by the renderer, including text and graphic aspect-ratio adjustments.
   */
  const hitTestElement = (x: number, y: number) => {
    const screenshot = screenshots[selectedIndex];
    const elements = screenshot?.elements || [];
    const layers = ['above-text', 'above-screenshot', 'behind-screenshot'];
    for (const layer of layers) {
      const layerElements = elements.filter((el) => el.layer === layer);
      for (let i = layerElements.length - 1; i >= 0; i--) {
        const el = layerElements[i];
        const cx = dims.width * (el.x / 100);
        const cy = dims.height * (el.y / 100);
        const width = dims.width * (el.width / 100);
        let height = width;
        if (el.type === 'text') {
          height = el.fontSize * 1.5;
        } else if (el.type === 'graphic' && el.image) {
          height = width * (el.image.height / el.image.width);
        }
        if (x >= cx - width / 2 && x <= cx + width / 2 && y >= cy - height / 2 && y <= cy + height / 2) {
          return el;
        }
      }
    }
    return null;
  };

  /**
   * Resolves the topmost canvas object that can be moved directly from the
   * preview, with popouts taking priority over decorative elements.
   */
  const hitTestCanvasTarget = (x: number, y: number) => {
    const popout = hitTestPopout(x, y);
    if (popout) return { kind: 'popout' as const, target: popout };
    const element = hitTestElement(x, y);
    if (element) return { kind: 'element' as const, target: element };
    return null;
  };

  /**
   * Starts a direct element drag from the canvas and switches the inspector to
   * the Elements tab so numeric controls match the selected interaction.
   */
  const handleElementPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const screenshot = screenshots[selectedIndex];
    if (!screenshot) return;
    const point = getCanvasPoint(e);
    const target = hitTestCanvasTarget(point.x, point.y);
    if (!target) return;

    if (target.kind === 'popout') {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      document.getElementById('canvas-wrapper')?.classList.add('element-dragging');
      setActiveTab('popouts');
      setSelectedElementId(null);
      elementDragRef.current = {
        kind: 'popout',
        id: target.target.id,
        startX: point.x,
        startY: point.y,
        originalX: target.target.x,
        originalY: target.target.y,
      };
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    document.getElementById('canvas-wrapper')?.classList.add('element-dragging');
    setActiveTab('elements');
    setSelectedElementId(target.target.id);
    elementDragRef.current = {
      kind: 'element',
      id: target.target.id,
      startX: point.x,
      startY: point.y,
      originalX: target.target.x,
      originalY: target.target.y,
    };
  };

  /**
   * Updates hover cursor state when idle and, while dragging, moves the active
   * element/popout with center-line snapping and transient alignment guides.
   */
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = elementDragRef.current;
    const screenshot = screenshots[selectedIndex];
    const point = getCanvasPoint(e);
    const wrapper = document.getElementById('canvas-wrapper');
    if (!drag || !screenshot) {
      wrapper?.classList.toggle('element-hover', !!(screenshot && hitTestCanvasTarget(point.x, point.y)));
      return;
    }
    const dx = ((point.x - drag.startX) / dims.width) * 100;
    const dy = ((point.y - drag.startY) / dims.height) * 100;
    let nextX = Math.max(0, Math.min(100, drag.originalX + dx));
    let nextY = Math.max(0, Math.min(100, drag.originalY + dy));
    const snapX = Math.abs(nextX - 50) <= 1.5;
    const snapY = Math.abs(nextY - 50) <= 1.5;
    if (snapX) nextX = 50;
    if (snapY) nextY = 50;
    setActiveSnapGuides({ x: snapX ? 50 : null, y: snapY ? 50 : null });
    const roundedX = Math.round(nextX * 10) / 10;
    const roundedY = Math.round(nextY * 10) / 10;
    if (drag.kind === 'popout') {
      updateScreenshot(selectedIndex, {
        popouts: (screenshot.popouts || []).map((popout) =>
          popout.id === drag.id ? { ...popout, x: roundedX, y: roundedY } : popout
        ),
      });
    } else {
      updateScreenshot(selectedIndex, {
        elements: (screenshot.elements || []).map((el) =>
          el.id === drag.id ? { ...el, x: roundedX, y: roundedY } : el
        ),
      });
    }
  };

  /**
   * Finishes a direct canvas drag and persists the final element position.
   */
  const handleElementPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!elementDragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    elementDragRef.current = null;
    setActiveSnapGuides({ x: null, y: null });
    document.getElementById('canvas-wrapper')?.classList.remove('element-dragging');
    updateScreenshot(selectedIndex, {});
    saveState();
  };

  /** Clears idle hover affordances when the pointer leaves the preview canvas. */
  const handleCanvasPointerLeave = () => {
    if (!elementDragRef.current) {
      document.getElementById('canvas-wrapper')?.classList.remove('element-hover');
    }
  };

  return (
    <div className="canvas-area">
      <div className="preview-strip">
        {/* Far left side preview */}
        <div
          ref={farLeftContainerRef}
          className="side-preview side-preview-far-left hidden"
          id="side-preview-far-left"
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
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleElementPointerUp}
            onPointerCancel={handleElementPointerUp}
            onPointerLeave={handleCanvasPointerLeave}
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
        >
          <canvas ref={farRightPreviewRef} id="preview-canvas-far-right" />
        </div>
      </div>
    </div>
  );
}
