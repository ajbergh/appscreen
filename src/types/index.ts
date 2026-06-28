/**
 * Shared state contracts for the React screenshot generator.
 *
 * These interfaces are intentionally close to the original vanilla `state`
 * shape so project data can be migrated, serialized, and compared against the
 * legacy app. Runtime-only image objects are represented beside their persisted
 * data URL/source fields; persistence code is responsible for dropping live DOM
 * objects before writing to IndexedDB.
 */

// ===== Core State Types =====

export interface GradientStop {
  color: string;
  position: number;
}

export interface BackgroundSettings {
  type: 'gradient' | 'solid' | 'image';
  gradient: {
    angle: number;
    stops: GradientStop[];
  };
  solid: string;
  image: HTMLImageElement | null;
  imageSrc: string | null;
  imageFit: 'cover' | 'contain' | 'stretch';
  imageSpan: boolean;
  imageBlur: number;
  overlayColor: string;
  overlayOpacity: number;
  noise: boolean;
  noiseIntensity: number;
}

export interface ShadowSettings {
  enabled: boolean;
  color: string;
  blur: number;
  opacity: number;
  x: number;
  y: number;
}

export interface FrameSettings {
  enabled: boolean;
  color: string;
  width: number;
  opacity: number;
}

export interface ScreenshotSettings {
  scale: number;
  y: number;
  x: number;
  rotation: number;
  perspective: number;
  cornerRadius: number;
  use3D: boolean;
  device3D: 'iphone' | 'ipad' | 'samsung';
  rotation3D: { x: number; y: number; z: number };
  shadow: ShadowSettings;
  frame: FrameSettings;
  frameColor?: string;
}

export interface LanguageLayoutSettings {
  headlineSize: number;
  subheadlineSize: number;
  position: 'top' | 'center' | 'bottom';
  offsetY: number;
  lineHeight: number;
}

export interface TextSettings {
  headlineEnabled: boolean;
  headlines: Record<string, string>;
  headlineLanguages: string[];
  currentHeadlineLang: string;
  headlineFont: string;
  headlineSize: number;
  headlineWeight: string;
  headlineItalic: boolean;
  headlineUnderline: boolean;
  headlineStrikethrough: boolean;
  headlineColor: string;
  perLanguageLayout: boolean;
  languageSettings: Record<string, LanguageLayoutSettings>;
  currentLayoutLang: string;
  position: 'top' | 'center' | 'bottom';
  offsetY: number;
  lineHeight: number;
  subheadlineEnabled: boolean;
  subheadlines: Record<string, string>;
  subheadlineLanguages: string[];
  currentSubheadlineLang: string;
  subheadlineFont: string;
  subheadlineSize: number;
  subheadlineWeight: string;
  subheadlineItalic: boolean;
  subheadlineUnderline: boolean;
  subheadlineStrikethrough: boolean;
  subheadlineColor: string;
  subheadlineOpacity: number;
}

export interface ElementSettings {
  id: string;
  type: 'graphic' | 'text' | 'emoji' | 'icon';
  x: number;
  y: number;
  width: number;
  rotation: number;
  opacity: number;
  layer: 'behind-screenshot' | 'above-screenshot' | 'above-text';
  image: HTMLImageElement | null;
  src: string | null;
  name: string;
  text: string;
  texts: Record<string, string>;
  font: string;
  fontSize: number;
  fontWeight: string;
  fontColor: string;
  italic: boolean;
  frame: string;
  frameColor: string;
  frameScale: number;
  emoji?: string;
  iconName?: string;
  iconColor?: string;
  iconStrokeWidth?: number;
  iconShadow?: ShadowSettings;
}

export interface PopoutSettings {
  id: string;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  x: number;
  y: number;
  width: number;
  rotation: number;
  opacity: number;
  cornerRadius: number;
  shadow: ShadowSettings;
  border: {
    enabled: boolean;
    color: string;
    width: number;
    opacity: number;
  };
}

export interface LocalizedImage {
  image: HTMLImageElement;
  src: string;
  name: string;
}

export interface Screenshot {
  image: HTMLImageElement | null;
  name: string;
  deviceType?: string;
  localizedImages: Record<string, LocalizedImage>;
  background: BackgroundSettings;
  screenshot: ScreenshotSettings;
  text: TextSettings;
  elements: ElementSettings[];
  popouts: PopoutSettings[];
  overrides: Record<string, unknown>;
}

/**
 * Defaults applied when creating new blank/uploaded screenshots.
 *
 * Elements and popouts are included because the original app lets users promote
 * the current screenshot styling into future screenshot defaults.
 */
export interface DefaultSettings {
  background: BackgroundSettings;
  screenshot: ScreenshotSettings;
  text: TextSettings;
  elements: ElementSettings[];
  popouts: PopoutSettings[];
}

export interface Project {
  id: string;
  name: string;
  screenshotCount: number;
}

export interface AppState {
  screenshots: Screenshot[];
  selectedIndex: number;
  transferTarget: number | null;
  outputDevice: string;
  currentLanguage: string;
  projectLanguages: string[];
  customWidth: number;
  customHeight: number;
  defaults: DefaultSettings;
  activeTab: string;
}

export interface DeviceDimensions {
  width: number;
  height: number;
}

/**
 * Canonical output sizes used by the export dropdown and render pipeline.
 *
 * Values are stored in final PNG pixels, not CSS preview pixels. Custom output
 * sizes are handled separately by `getCanvasDimensions()`.
 */
export const DEVICE_DIMENSIONS: Record<string, DeviceDimensions> = {
  'iphone-6.9': { width: 1320, height: 2868 },
  'iphone-6.7': { width: 1290, height: 2796 },
  'iphone-6.5': { width: 1284, height: 2778 },
  'iphone-5.5': { width: 1242, height: 2208 },
  'ipad-12.9': { width: 2048, height: 2732 },
  'ipad-11': { width: 1668, height: 2388 },
  'android-phone': { width: 1080, height: 1920 },
  'android-phone-hd': { width: 1440, height: 2560 },
  'android-tablet-7': { width: 1200, height: 1920 },
  'android-tablet-10': { width: 1600, height: 2560 },
  'web-og': { width: 1200, height: 630 },
  'web-twitter': { width: 1200, height: 675 },
  'web-hero': { width: 1920, height: 1080 },
  'web-feature': { width: 1024, height: 500 },
};
