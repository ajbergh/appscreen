/**
 * React canvas bridge for live preview, side previews, and exports.
 *
 * The pure renderer in `canvas/renderer.ts` does not know about React state or
 * Three.js. This hook connects Zustand state to a preview canvas and exposes
 * shared helpers that other UI surfaces use to render the exact same screenshot
 * into arbitrary canvases.
 */
import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { getCanvasDimensions, renderToCanvas, drawBackground, drawNoise, drawElements, drawPopouts, drawText } from '../canvas/renderer';
import type { DeviceDimensions, Screenshot } from '../types';

// Global Three.js renderer reference registered by `useThreeJS`.
let threeRenderer: {
  renderToCanvas: (canvas: HTMLCanvasElement, width: number, height: number, ss?: any) => void;
  renderForScreenshot?: (canvas: HTMLCanvasElement, width: number, height: number, screenshot: Screenshot, image: HTMLImageElement | null) => Promise<boolean>;
  isReady: boolean;
} | null = null;

/**
 * Registers the active Three.js renderer adapter.
 *
 * `useThreeJS` owns the actual WebGL scene. This setter gives the Canvas render
 * path a narrow adapter so it can request 3D compositing without importing
 * Three.js or coupling export code to the preview component.
 */
export function setThreeRenderer(renderer: typeof threeRenderer) {
  threeRenderer = renderer;
}

/**
 * Returns a ref for the main preview canvas and keeps it rendered from store state.
 *
 * The hook uses `requestAnimationFrame` to coalesce rapid Zustand updates from
 * sliders/text fields into a single canvas paint per frame.
 */
export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const screenshots = useAppStore((s) => s.screenshots);
  const selectedIndex = useAppStore((s) => s.selectedIndex);
  const outputDevice = useAppStore((s) => s.outputDevice);
  const customWidth = useAppStore((s) => s.customWidth);
  const customHeight = useAppStore((s) => s.customHeight);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const projectLanguages = useAppStore((s) => s.projectLanguages);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dims = getCanvasDimensions(outputDevice, customWidth, customHeight);

    // Scale for preview
    const maxPreviewWidth = 400;
    const maxPreviewHeight = 700;
    const scale = Math.min(maxPreviewWidth / dims.width, maxPreviewHeight / dims.height);
    canvas.style.width = `${dims.width * scale}px`;
    canvas.style.height = `${dims.height * scale}px`;

    if (screenshots.length === 0) {
      // Clear canvas when no screenshots
      canvas.width = dims.width;
      canvas.height = dims.height;
      ctx.clearRect(0, 0, dims.width, dims.height);
      return;
    }

    const screenshot: Screenshot | undefined = screenshots[selectedIndex];
    if (!screenshot) return;

    await renderScreenshotToCanvas(canvas, screenshot, dims, currentLanguage, selectedIndex, screenshots, projectLanguages);
  }, [screenshots, selectedIndex, outputDevice, customWidth, customHeight, currentLanguage, projectLanguages]);

  // Re-render on state changes
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [render]);

  return canvasRef;
}

/**
 * Renders one screenshot into any supplied canvas using the shared preview/export path.
 *
 * This function is the parity contract for current export, batch export,
 * all-language export, live preview, and side-preview thumbnails. It resolves
 * localized image data, preserves the same layer order for 2D and 3D outputs,
 * and falls back to the current Three.js model render if the per-screenshot 3D
 * render adapter cannot render a cached model.
 */
export async function renderScreenshotToCanvas(
  canvas: HTMLCanvasElement,
  screenshot: Screenshot,
  dims: DeviceDimensions,
  currentLanguage: string,
  screenIndex: number,
  screenshots: Screenshot[],
  projectLanguages: string[] = []
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const image = getScreenshotImage(screenshot, currentLanguage, projectLanguages);
  const use3D = !!(screenshot.screenshot.use3D && image && threeRenderer?.isReady);

  if (!use3D) {
    renderToCanvas(
      ctx,
      canvas,
      dims,
      screenshot.background,
      screenshot.screenshot,
      screenshot.text,
      screenshot.elements || [],
      screenshot.popouts || [],
      image,
      currentLanguage,
      false,
      screenIndex,
      screenshots.length
    );
    return;
  }

  canvas.width = dims.width;
  canvas.height = dims.height;
  drawBackground(ctx, dims, screenshot.background, screenIndex, screenshots.length);
  if (screenshot.background.noise) {
    drawNoise(ctx, dims, screenshot.background.noiseIntensity);
  }
  drawElements(ctx, dims, screenshot.elements || [], 'behind-screenshot', currentLanguage);

  const rendered = await threeRenderer?.renderForScreenshot?.(canvas, dims.width, dims.height, screenshot, image);
  if (!rendered) {
    threeRenderer?.renderToCanvas(canvas, dims.width, dims.height, screenshot.screenshot);
  }

  drawElements(ctx, dims, screenshot.elements || [], 'above-screenshot', currentLanguage);
  drawPopouts(ctx, dims, screenshot.popouts || [], image);
  drawText(ctx, dims, screenshot.text, currentLanguage);
  drawElements(ctx, dims, screenshot.elements || [], 'above-text', currentLanguage);
}

/**
 * Resolves the best image for a screenshot in the current language context.
 *
 * Fallback order mirrors the legacy language utility: requested language,
 * configured project languages, any localized image, then the legacy root
 * `image` field for old project data.
 */
export function getScreenshotImage(
  screenshot: Screenshot,
  currentLanguage: string,
  projectLanguages: string[] = []
): HTMLImageElement | null {
  // Try current language first
  if (screenshot.localizedImages?.[currentLanguage]?.image) {
    return screenshot.localizedImages[currentLanguage].image;
  }
  // Try configured project language order
  for (const lang of projectLanguages) {
    if (screenshot.localizedImages?.[lang]?.image) {
      return screenshot.localizedImages[lang].image;
    }
  }
  // Try any available language
  const langs = Object.keys(screenshot.localizedImages || {});
  if (langs.length > 0) {
    return screenshot.localizedImages[langs[0]].image;
  }
  // Legacy fallback
  return screenshot.image;
}
