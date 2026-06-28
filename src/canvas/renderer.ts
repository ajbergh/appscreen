import type {
  BackgroundSettings,
  ScreenshotSettings,
  TextSettings,
  ElementSettings,
  PopoutSettings,
  DeviceDimensions,
} from '../types';
import { DEVICE_DIMENSIONS } from '../types';

// ===== Helpers =====

export function getCanvasDimensions(outputDevice: string, customWidth: number, customHeight: number): DeviceDimensions {
  if (outputDevice === 'custom') {
    return { width: customWidth, height: customHeight };
  }
  return DEVICE_DIMENSIONS[outputDevice] || { width: 1290, height: 2796 };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph) { lines.push(''); continue; }
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

const laurelImages: Record<string, HTMLImageElement | null> = {
  'laurel-simple-left': null,
  'laurel-detailed-left': null,
};

if (typeof Image !== 'undefined') {
  Object.keys(laurelImages).forEach((name) => {
    const img = new Image();
    img.src = `img/${name}.svg`;
    laurelImages[name] = img;
  });
}

// ===== Background Rendering =====

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  bg: BackgroundSettings,
  screenIndex = 0,
  screenCount = 1
): void {
  ctx.clearRect(0, 0, dims.width, dims.height);

  if (bg.type === 'gradient') {
    const angleRad = (bg.gradient.angle * Math.PI) / 180;
    const x1 = dims.width / 2 - Math.cos(angleRad) * dims.width;
    const y1 = dims.height / 2 - Math.sin(angleRad) * dims.height;
    const x2 = dims.width / 2 + Math.cos(angleRad) * dims.width;
    const y2 = dims.height / 2 + Math.sin(angleRad) * dims.height;

    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    bg.gradient.stops.forEach((stop) => {
      gradient.addColorStop(stop.position / 100, stop.color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dims.width, dims.height);
  } else if (bg.type === 'solid') {
    ctx.fillStyle = bg.solid;
    ctx.fillRect(0, 0, dims.width, dims.height);
  } else if (bg.type === 'image' && bg.image) {
    drawImageBackground(ctx, dims, bg, screenIndex, screenCount);
    return; // Overlay is applied inside drawImageBackground
  }
}

function drawImageBackground(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  bg: BackgroundSettings,
  screenIndex = 0,
  screenCount = 1
): void {
  if (!bg.image) return;
  const img = bg.image;

  // When imageSpan is on, each screenshot gets a horizontal slice of the panorama
  const spanCount = bg.imageSpan ? Math.max(1, screenCount) : 1;
  const spanIndex = bg.imageSpan ? Math.max(0, Math.min(screenIndex, spanCount - 1)) : 0;
  const targetWidth = dims.width * spanCount;
  const targetHeight = dims.height;
  const imgRatio = img.width / img.height;
  const targetRatio = targetWidth / targetHeight;

  let dx = 0;
  let dy = 0;
  let dw = targetWidth;
  let dh = targetHeight;

  if (bg.imageFit === 'cover') {
    if (imgRatio > targetRatio) {
      dh = targetHeight;
      dw = dh * imgRatio;
      dx = (targetWidth - dw) / 2;
    } else {
      dw = targetWidth;
      dh = dw / imgRatio;
      dy = (targetHeight - dh) / 2;
    }
  } else if (bg.imageFit === 'contain') {
    if (imgRatio > targetRatio) {
      dw = targetWidth;
      dh = dw / imgRatio;
      dy = (targetHeight - dh) / 2;
    } else {
      dh = targetHeight;
      dw = dh * imgRatio;
      dx = (targetWidth - dw) / 2;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, dims.width, dims.height);
  } else {
    // fill mode
    dw = targetWidth;
    dh = targetHeight;
  }

  ctx.save();
  // Clip to this screenshot's portion of the panorama
  ctx.beginPath();
  ctx.rect(0, 0, dims.width, dims.height);
  ctx.clip();
  // Translate so the correct slice is visible
  ctx.translate(-spanIndex * dims.width, 0);

  if (bg.imageBlur > 0) {
    ctx.filter = `blur(${bg.imageBlur}px)`;
  }

  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
  ctx.restore();

  // Overlay
  if (bg.overlayOpacity > 0) {
    ctx.fillStyle = hexToRgba(bg.overlayColor, bg.overlayOpacity / 100);
    ctx.fillRect(0, 0, dims.width, dims.height);
  }
}

// ===== Noise Overlay =====

export function drawNoise(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  intensity: number
): void {
  if (intensity <= 0) return;

  const imageData = ctx.getImageData(0, 0, dims.width, dims.height);
  const data = imageData.data;
  const noiseScale = (intensity / 100) * 255;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseScale;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
}

// ===== Screenshot Rendering =====

function drawDeviceFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  settings: ScreenshotSettings
): void {
  const frameWidth = settings.frame.width * (width / 400);
  const frameOpacity = settings.frame.opacity / 100;
  const radius = (settings.cornerRadius || 0) * (width / 400) + frameWidth;

  ctx.globalAlpha = frameOpacity;
  ctx.strokeStyle = settings.frame.color;
  ctx.lineWidth = frameWidth;
  ctx.beginPath();
  roundRectPath(ctx, x - frameWidth / 2, y - frameWidth / 2, width + frameWidth, height + frameWidth, radius);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawScreenshot(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  img: HTMLImageElement,
  settings: ScreenshotSettings
): void {
  const scale = settings.scale / 100;

  // Calculate scaled dimensions (match original app.js logic)
  let imgWidth = dims.width * scale;
  let imgHeight = (img.height / img.width) * imgWidth;

  // If image is taller than canvas after scaling, adjust
  if (imgHeight > dims.height * scale) {
    imgHeight = dims.height * scale;
    imgWidth = (img.width / img.height) * imgHeight;
  }

  // Ensure minimum movement range so position works even at 100% scale
  const moveX = Math.max(dims.width - imgWidth, dims.width * 0.15);
  const moveY = Math.max(dims.height - imgHeight, dims.height * 0.15);
  const x = (dims.width - imgWidth) / 2 + (settings.x / 100 - 0.5) * moveX;
  const y = (dims.height - imgHeight) / 2 + (settings.y / 100 - 0.5) * moveY;
  const centerX = x + imgWidth / 2;
  const centerY = y + imgHeight / 2;

  // Scale corner radius with image size (match original)
  const radius = (settings.cornerRadius || 0) * (imgWidth / 400);

  ctx.save();

  // Apply transformations: translate to center, rotate, perspective, translate back
  ctx.translate(centerX, centerY);

  if (settings.rotation !== 0) {
    ctx.rotate((settings.rotation * Math.PI) / 180);
  }

  if (settings.perspective !== 0) {
    ctx.transform(1, settings.perspective * 0.01, 0, 1, 0, 0);
  }

  ctx.translate(-centerX, -centerY);

  // Draw shadow first (separate filled shape, not clipped)
  if (settings.shadow.enabled) {
    const shadowColor = hexToRgba(settings.shadow.color, settings.shadow.opacity / 100);
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = settings.shadow.blur;
    ctx.shadowOffsetX = settings.shadow.x;
    ctx.shadowOffsetY = settings.shadow.y;

    ctx.fillStyle = '#000';
    ctx.beginPath();
    roundRectPath(ctx, x, y, imgWidth, imgHeight, radius);
    ctx.fill();

    // Reset shadow before drawing image
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Clip and draw image
  ctx.beginPath();
  roundRectPath(ctx, x, y, imgWidth, imgHeight, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, imgWidth, imgHeight);

  ctx.restore();

  // Draw device frame outside clip (separate transform context)
  if (settings.frame.enabled) {
    ctx.save();
    ctx.translate(centerX, centerY);
    if (settings.rotation !== 0) {
      ctx.rotate((settings.rotation * Math.PI) / 180);
    }
    if (settings.perspective !== 0) {
      ctx.transform(1, settings.perspective * 0.01, 0, 1, 0, 0);
    }
    ctx.translate(-centerX, -centerY);
    drawDeviceFrame(ctx, x, y, imgWidth, imgHeight, settings);
    ctx.restore();
  }
}

// ===== Text Rendering =====

function getEffectiveLayout(text: TextSettings, lang: string) {
  if (!text.perLanguageLayout) {
    return {
      headlineSize: text.headlineSize || 100,
      subheadlineSize: text.subheadlineSize || 50,
      position: (text.position || 'top') as 'top' | 'center' | 'bottom',
      offsetY: typeof text.offsetY === 'number' ? text.offsetY : 12,
      lineHeight: text.lineHeight || 110,
    };
  }

  const settings = text.languageSettings?.[lang] || text.languageSettings?.['en'];
  if (settings) return settings;

  return {
    headlineSize: text.headlineSize || 100,
    subheadlineSize: text.subheadlineSize || 50,
    position: (text.position || 'top') as 'top' | 'center' | 'bottom',
    offsetY: typeof text.offsetY === 'number' ? text.offsetY : 12,
    lineHeight: text.lineHeight || 110,
  };
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  text: TextSettings,
  currentLanguage: string
): void {
  const headlineEnabled = text.headlineEnabled !== false;
  const subheadlineEnabled = text.subheadlineEnabled || false;

  const requestedLang = currentLanguage || 'en';
  const headlineLang = text.headlines?.[requestedLang] !== undefined
    ? requestedLang
    : (text.currentHeadlineLang || 'en');
  const subheadlineLang = text.subheadlines?.[requestedLang] !== undefined
    ? requestedLang
    : (text.currentSubheadlineLang || 'en');

  const layoutLang = text.languageSettings?.[requestedLang]
    ? requestedLang
    : (text.currentLayoutLang || headlineLang);
  const headlineLayout = getEffectiveLayout(text, headlineLang);
  const subheadlineLayout = getEffectiveLayout(text, subheadlineLang);
  const layoutSettings = getEffectiveLayout(text, layoutLang);

  const headline = headlineEnabled && text.headlines
    ? (text.headlines[headlineLang] || text.headlines[text.currentHeadlineLang] || text.headlines.en || '')
    : '';
  const subheadline = subheadlineEnabled && text.subheadlines
    ? (text.subheadlines[subheadlineLang] || text.subheadlines[text.currentSubheadlineLang] || text.subheadlines.en || '')
    : '';

  if (!headline && !subheadline) return;

  const padding = dims.width * 0.08;
  const isTop = layoutSettings.position === 'top';
  const textY = isTop
    ? dims.height * (layoutSettings.offsetY / 100)
    : dims.height * (1 - layoutSettings.offsetY / 100);

  ctx.textAlign = 'center';
  ctx.textBaseline = isTop ? 'top' : 'bottom';

  let currentY = textY;

  // Draw headline
  if (headline) {
    const fontStyle = text.headlineItalic ? 'italic' : 'normal';
    ctx.font = `${fontStyle} ${text.headlineWeight || '600'} ${headlineLayout.headlineSize}px ${text.headlineFont}`;
    ctx.fillStyle = text.headlineColor;

    const lines = wrapText(ctx, headline, dims.width - padding * 2);
    const lineHeight = headlineLayout.headlineSize * (layoutSettings.lineHeight / 100);

    // For bottom positioning, offset so lines draw correctly upward
    if (!isTop) {
      currentY -= (lines.length - 1) * lineHeight;
    }

    let lastLineY = currentY;
    lines.forEach((line, i) => {
      const lineY = currentY + i * lineHeight;
      lastLineY = lineY;
      ctx.fillText(line, dims.width / 2, lineY);

      const textWidth = ctx.measureText(line).width;
      const fontSize = headlineLayout.headlineSize;
      const lineThickness = Math.max(2, fontSize * 0.05);
      const lx = dims.width / 2 - textWidth / 2;

      if (text.headlineUnderline) {
        const underlineY = isTop ? lineY + fontSize * 0.9 : lineY + fontSize * 0.1;
        ctx.fillStyle = text.headlineColor;
        ctx.fillRect(lx, underlineY, textWidth, lineThickness);
        ctx.fillStyle = text.headlineColor;
      }

      if (text.headlineStrikethrough) {
        const strikeY = isTop ? lineY + fontSize * 0.4 : lineY - fontSize * 0.4;
        ctx.fillStyle = text.headlineColor;
        ctx.fillRect(lx, strikeY, textWidth, lineThickness);
        ctx.fillStyle = text.headlineColor;
      }
    });

    // Track where subheadline should start
    const gap = lineHeight - headlineLayout.headlineSize;
    if (isTop) {
      currentY = lastLineY + headlineLayout.headlineSize + gap;
    } else {
      currentY = lastLineY + gap;
    }
  }

  // Draw subheadline
  if (subheadline) {
    const subFontStyle = text.subheadlineItalic ? 'italic' : 'normal';
    const subWeight = text.subheadlineWeight || '400';
    ctx.font = `${subFontStyle} ${subWeight} ${subheadlineLayout.subheadlineSize}px ${text.subheadlineFont || text.headlineFont}`;
    ctx.fillStyle = hexToRgba(text.subheadlineColor, text.subheadlineOpacity / 100);

    const lines = wrapText(ctx, subheadline, dims.width - padding * 2);
    const subLineHeight = subheadlineLayout.subheadlineSize * 1.4;

    const subY = currentY;
    // For bottom positioning, switch baseline so subheadline draws downward from headline
    if (!isTop) {
      ctx.textBaseline = 'top';
    }

    lines.forEach((line, i) => {
      const lineY = subY + i * subLineHeight;
      ctx.fillText(line, dims.width / 2, lineY);

      const textWidth = ctx.measureText(line).width;
      const fontSize = subheadlineLayout.subheadlineSize;
      const lineThickness = Math.max(2, fontSize * 0.05);
      const lx = dims.width / 2 - textWidth / 2;

      if (text.subheadlineUnderline) {
        const underlineY = lineY + fontSize * 0.9;
        ctx.fillStyle = hexToRgba(text.subheadlineColor, text.subheadlineOpacity / 100);
        ctx.fillRect(lx, underlineY, textWidth, lineThickness);
        ctx.fillStyle = hexToRgba(text.subheadlineColor, text.subheadlineOpacity / 100);
      }

      if (text.subheadlineStrikethrough) {
        const strikeY = lineY + fontSize * 0.4;
        ctx.fillStyle = hexToRgba(text.subheadlineColor, text.subheadlineOpacity / 100);
        ctx.fillRect(lx, strikeY, textWidth, lineThickness);
        ctx.fillStyle = hexToRgba(text.subheadlineColor, text.subheadlineOpacity / 100);
      }
    });

    if (!isTop) {
      ctx.textBaseline = 'bottom';
    }
  }
}

// ===== Element Frame Rendering =====

function drawElementFrame(
  ctx: CanvasRenderingContext2D,
  el: ElementSettings,
  textWidth: number,
  textHeight: number
): void {
  const scale = (el.frameScale || 100) / 100;
  const padding = el.fontSize * 0.4 * scale;
  const frameW = textWidth + padding * 2;
  const frameH = textHeight + padding * 2;
  const color = el.frameColor || '#ffffff';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, el.fontSize * 0.04) * scale;

  const frame = el.frame || 'none';
  const isLaurel = frame.startsWith('laurel-');
  const hasStar = frame.endsWith('-star');

  if (isLaurel) {
    const variant = frame.includes('detailed') ? 'laurel-detailed-left' : 'laurel-simple-left';
    drawLaurelSVG(ctx, variant, frameW, frameH, scale, color);
    if (hasStar) {
      drawStar(ctx, 0, -frameH / 2 - el.fontSize * 0.2 * scale, el.fontSize * 0.3 * scale, color);
    }
  } else if (frame === 'badge-circle') {
    const radius = Math.max(frameW, frameH) / 2 + padding * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (frame === 'badge-ribbon') {
    const sw = frameW + padding;
    const sh = frameH + padding * 1.5;
    ctx.beginPath();
    ctx.moveTo(-sw / 2, -sh / 2);
    ctx.lineTo(sw / 2, -sh / 2);
    ctx.lineTo(sw / 2, sh / 2 - padding);
    ctx.lineTo(0, sh / 2);
    ctx.lineTo(-sw / 2, sh / 2 - padding);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

function drawLaurelSVG(
  ctx: CanvasRenderingContext2D,
  variant: string,
  width: number,
  height: number,
  scale: number,
  color: string
): void {
  const img = laurelImages[variant];
  if (!img || !img.complete || !(img.naturalWidth || img.width)) return;

  const branchH = height * 1.1 * scale;
  const aspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  const branchW = branchH * aspect;
  const tmp = document.createElement('canvas');
  tmp.width = Math.ceil(branchW);
  tmp.height = Math.ceil(branchH);
  const tctx = tmp.getContext('2d');
  if (!tctx) return;

  tctx.drawImage(img, 0, 0, branchW, branchH);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, branchW, branchH);

  const gap = 2 * scale;
  const leftX = -width / 2 - branchW - gap;
  const topY = -branchH / 2;
  ctx.drawImage(tmp, leftX, topY, branchW, branchH);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(tmp, leftX, topY, branchW, branchH);
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outer = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const inner = outer + Math.PI / 5;
    const ox = cx + Math.cos(outer) * size;
    const oy = cy + Math.sin(outer) * size;
    const ix = cx + Math.cos(inner) * size * 0.4;
    const iy = cy + Math.sin(inner) * size * 0.4;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ===== Elements Rendering =====

export function drawElements(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  elements: ElementSettings[],
  layer: string,
  currentLanguage = 'en'
): void {
  const layerElements = elements.filter((el) => el.layer === layer);

  for (const el of layerElements) {
    ctx.save();

    const cx = dims.width * (el.x / 100);
    const cy = dims.height * (el.y / 100);
    const elWidth = dims.width * (el.width / 100);

    ctx.translate(cx, cy);
    if (el.rotation !== 0) {
      ctx.rotate((el.rotation * Math.PI) / 180);
    }
    ctx.globalAlpha = el.opacity / 100;

    if (el.type === 'emoji' && el.emoji) {
      const emojiSize = elWidth * 0.85;
      ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.emoji, 0, 0);
    } else if (el.type === 'icon' && el.image) {
      // Icon shadow
      if (el.iconShadow?.enabled) {
        const s = el.iconShadow;
        ctx.shadowColor = hexToRgba(s.color || '#000000', (s.opacity || 0) / 100);
        ctx.shadowBlur = s.blur || 0;
        ctx.shadowOffsetX = s.x || 0;
        ctx.shadowOffsetY = s.y || 0;
      }
      ctx.drawImage(el.image, -elWidth / 2, -elWidth / 2, elWidth, elWidth);
      if (el.iconShadow?.enabled) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    } else if (el.type === 'graphic' && el.image) {
      const aspect = el.image.height / el.image.width;
      const elHeight = elWidth * aspect;
      ctx.drawImage(el.image, -elWidth / 2, -elHeight / 2, elWidth, elHeight);
    } else if (el.type === 'text') {
      const elText = el.texts
        ? (el.texts[currentLanguage] || el.texts['en'] || Object.values(el.texts).find(v => v) || el.text || '')
        : (el.text || '');
      if (!elText) { ctx.restore(); continue; }

      const fontStyle = el.italic ? 'italic' : 'normal';
      ctx.font = `${fontStyle} ${el.fontWeight} ${el.fontSize}px ${el.font}`;
      ctx.fillStyle = el.fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lines = wrapText(ctx, elText, elWidth);
      const lineHeight = el.fontSize * 1.05;
      const totalHeight = (lines.length - 1) * lineHeight + el.fontSize;
      const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);

      // Draw frame behind text (matches original drawElementFrame)
      if (el.frame && el.frame !== 'none') {
        drawElementFrame(ctx, el, maxLineWidth, totalHeight);
      }

      const startY = -(totalHeight / 2) + el.fontSize / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineHeight);
      });
    }

    ctx.restore();
  }
}

// ===== Popouts Rendering =====

export function drawPopouts(
  ctx: CanvasRenderingContext2D,
  dims: DeviceDimensions,
  popouts: PopoutSettings[],
  sourceImage: HTMLImageElement | null
): void {
  if (!sourceImage) return;

  for (const p of popouts) {
    ctx.save();
    ctx.globalAlpha = p.opacity / 100;

    const cx = dims.width * (p.x / 100);
    const cy = dims.height * (p.y / 100);
    const displayW = dims.width * (p.width / 100);
    const sw = (p.cropWidth / 100) * sourceImage.width;
    const sh = (p.cropHeight / 100) * sourceImage.height;
    const cropAspect = sh / sw;
    const displayH = displayW * cropAspect;
    const halfW = displayW / 2;
    const halfH = displayH / 2;
    // Scale corner radius with display size (matches original: displayW / 300)
    const radius = p.cornerRadius * (displayW / 300);

    ctx.translate(cx, cy);
    if (p.rotation !== 0) {
      ctx.rotate((p.rotation * Math.PI) / 180);
    }

    // Draw shadow as filled shape BEFORE clip (so shadow is visible)
    if (p.shadow.enabled) {
      ctx.shadowColor = hexToRgba(p.shadow.color, p.shadow.opacity / 100);
      ctx.shadowBlur = p.shadow.blur;
      ctx.shadowOffsetX = p.shadow.x;
      ctx.shadowOffsetY = p.shadow.y;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      roundRectPath(ctx, -halfW, -halfH, displayW, displayH, radius);
      ctx.fill();
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Draw border as filled background BEHIND image (matches original)
    if (p.border.enabled) {
      const bw = p.border.width;
      ctx.save();
      ctx.globalAlpha = (p.opacity / 100) * (p.border.opacity / 100);
      ctx.fillStyle = p.border.color;
      ctx.beginPath();
      roundRectPath(ctx, -halfW - bw, -halfH - bw, displayW + bw * 2, displayH + bw * 2, radius + bw);
      ctx.fill();
      ctx.restore();
    }

    // Clip and draw cropped image
    const sx = (p.cropX / 100) * sourceImage.width;
    const sy = (p.cropY / 100) * sourceImage.height;
    ctx.beginPath();
    roundRectPath(ctx, -halfW, -halfH, displayW, displayH, radius);
    ctx.clip();
    ctx.drawImage(sourceImage, sx, sy, sw, sh, -halfW, -halfH, displayW, displayH);

    ctx.restore();
  }
}

// ===== Full Render Pipeline =====

export function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  dims: DeviceDimensions,
  background: BackgroundSettings,
  screenshotSettings: ScreenshotSettings,
  textSettings: TextSettings,
  elements: ElementSettings[],
  popouts: PopoutSettings[],
  screenshotImage: HTMLImageElement | null,
  currentLanguage: string,
  use3D: boolean,
  screenIndex = 0,
  screenCount = 1
): void {
  canvas.width = dims.width;
  canvas.height = dims.height;

  // Background (pass screenIndex/screenCount for panoramic imageSpan slicing)
  drawBackground(ctx, dims, background, screenIndex, screenCount);

  // Noise
  if (background.noise) {
    drawNoise(ctx, dims, background.noiseIntensity);
  }

  // Elements behind screenshot
  drawElements(ctx, dims, elements, 'behind-screenshot', currentLanguage);

  // Screenshot (2D mode only - 3D handled separately)
  if (screenshotImage && !use3D) {
    drawScreenshot(ctx, dims, screenshotImage, screenshotSettings);
  }

  // Elements above screenshot
  drawElements(ctx, dims, elements, 'above-screenshot', currentLanguage);

  // Popouts
  drawPopouts(ctx, dims, popouts, screenshotImage);

  // Text
  drawText(ctx, dims, textSettings, currentLanguage);

  // Elements above text
  drawElements(ctx, dims, elements, 'above-text', currentLanguage);
}
