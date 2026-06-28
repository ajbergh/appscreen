import { useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { getCanvasDimensions, renderToCanvas, drawBackground, drawNoise, drawElements, drawPopouts, drawText } from '../canvas/renderer';
import type { DeviceDimensions, Screenshot } from '../types';

// Global Three.js renderer reference (managed by useThreeJS hook)
let threeRenderer: {
  renderToCanvas: (canvas: HTMLCanvasElement, width: number, height: number, ss?: any) => void;
  renderForScreenshot?: (canvas: HTMLCanvasElement, width: number, height: number, screenshot: Screenshot, image: HTMLImageElement | null) => Promise<boolean>;
  isReady: boolean;
} | null = null;

export function setThreeRenderer(renderer: typeof threeRenderer) {
  threeRenderer = renderer;
}

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

    const background = screenshot.background;
    const screenshotSettings = screenshot.screenshot;
    const textSettings = screenshot.text;
    const elements = screenshot.elements || [];
    const popouts = screenshot.popouts || [];

    // Get the localized image
    const img = getScreenshotImage(screenshot, currentLanguage);
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
