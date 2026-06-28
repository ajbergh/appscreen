/**
 * Searchable font picker used by text controls and element controls.
 *
 * The picker exposes system fonts, a curated popular list, and a large local
 * fallback catalog for the All tab. It loads Google Font stylesheets lazily only
 * when a Google font is selected or previewed, so the dropdown remains usable in
 * offline/sandboxed environments.
 */
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FALLBACK_GOOGLE_FONTS } from './fontCatalog';

// Google Fonts configuration (from original app.js)
const SYSTEM_FONTS = [
  { name: 'SF Pro Display', value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display'" },
  { name: 'SF Pro Rounded', value: "'SF Pro Rounded', -apple-system" },
  { name: 'Helvetica Neue', value: "'Helvetica Neue', Helvetica" },
  { name: 'Avenir Next', value: "'Avenir Next', Avenir" },
  { name: 'Georgia', value: "Georgia, serif" },
  { name: 'Arial', value: "Arial, sans-serif" },
  { name: 'Times New Roman', value: "'Times New Roman', serif" },
  { name: 'Courier New', value: "'Courier New', monospace" },
  { name: 'Verdana', value: "Verdana, sans-serif" },
  { name: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
];

const POPULAR_FONTS = [
  'Inter', 'Poppins', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Raleway',
  'Nunito', 'Playfair Display', 'Oswald', 'Merriweather', 'Source Sans Pro',
  'PT Sans', 'Ubuntu', 'Rubik', 'Work Sans', 'Quicksand', 'Mulish', 'Barlow',
  'DM Sans', 'Manrope', 'Space Grotesk', 'Plus Jakarta Sans', 'Outfit', 'Sora',
  'Lexend', 'Figtree', 'Albert Sans', 'Urbanist', 'Satoshi', 'General Sans',
  'Bebas Neue', 'Anton', 'Archivo', 'Bitter', 'Cabin', 'Crimson Text',
  'Dancing Script', 'Fira Sans', 'Heebo', 'IBM Plex Sans', 'Josefin Sans',
  'Karla', 'Libre Franklin', 'Lora', 'Noto Sans', 'Nunito Sans', 'Pacifico',
  'Permanent Marker', 'Roboto Condensed', 'Roboto Mono', 'Roboto Slab',
  'Shadows Into Light', 'Signika', 'Slabo 27px', 'Source Code Pro', 'Titillium Web',
  'Varela Round', 'Zilla Slab', 'Arimo', 'Barlow Condensed', 'Catamaran',
  'Comfortaa', 'Cormorant Garamond', 'Dosis', 'EB Garamond', 'Exo 2',
  'Fira Code', 'Hind', 'Inconsolata', 'Indie Flower', 'Jost', 'Kanit',
  'Libre Baskerville', 'Maven Pro', 'Mukta', 'Nanum Gothic', 'Noticia Text',
  'Oxygen', 'Philosopher', 'Play', 'Prompt', 'Rajdhani', 'Red Hat Display',
  'Righteous', 'Saira', 'Sen', 'Spectral', 'Teko', 'Vollkorn', 'Yanone Kaffeesatz',
  'Zeyada', 'Amatic SC', 'Archivo Black', 'Asap', 'Assistant', 'Bangers',
  'BioRhyme', 'Cairo', 'Cardo', 'Chivo', 'Concert One', 'Cormorant',
  'Cousine', 'DM Serif Display', 'DM Serif Text', 'Dela Gothic One',
  'El Messiri', 'Encode Sans', 'Eczar', 'Fahkwang', 'Gelasio',
];

const ALL_FONT_FALLBACKS = [...new Set([...POPULAR_FONTS, ...FALLBACK_GOOGLE_FONTS])].sort();
const GOOGLE_FONT_WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];
const loadedGoogleFontFamilies = new Set<string>();
const loadingGoogleFontFamilies = new Map<string, Promise<void>>();

/**
 * Builds a stable Google Fonts CSS2 URL for the family and weight range used by
 * the editor. Loading the full text-weight range keeps live previews and export
 * output aligned for headline, subheadline, and element text controls.
 */
function getGoogleFontHref(fontName: string) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@${GOOGLE_FONT_WEIGHTS.join(';')}&display=swap`;
}

/**
 * Loads a Google Font once per page session and awaits both the stylesheet and
 * browser font-face resolution. Network failures resolve successfully so
 * project state can still store the chosen CSS font-family in offline builds.
 */
async function ensureGoogleFont(fontName: string) {
  if (loadedGoogleFontFamilies.has(fontName)) return;
  const existing = loadingGoogleFontFamilies.get(fontName);
  if (existing) return existing;

  const loadPromise = (async () => {
    const linkId = `google-font-${fontName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    let linkLoad: Promise<void> = Promise.resolve();
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.href = getGoogleFontHref(fontName);
      link.rel = 'stylesheet';
      linkLoad = new Promise((resolve) => {
        link.onload = () => resolve();
        link.onerror = () => resolve();
      });
      document.head.appendChild(link);
    }

    await linkLoad;
    if (document.fonts?.load) {
      await Promise.all(GOOGLE_FONT_WEIGHTS.map((weight) =>
        document.fonts.load(`${weight} 16px "${fontName}"`).catch(() => [])
      ));
    }
    loadedGoogleFontFamilies.add(fontName);
  })().finally(() => {
    loadingGoogleFontFamilies.delete(fontName);
  });

  loadingGoogleFontFamilies.set(fontName, loadPromise);
  return loadPromise;
}

interface FontPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/**
 * Renders a dropdown-style font selector and reports the CSS font-family value.
 *
 * The option menu is portaled to `document.body` and positioned from the trigger
 * rectangle so right-sidebar scrolling and overflow rules cannot hide the
 * additional System, Popular, or All font lists.
 */
export function FontPicker({ value, onChange, id }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<'system' | 'popular' | 'all'>('popular');
  const [search, setSearch] = useState('');
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(() => new Set(loadedGoogleFontFamilies));
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Extract current font name
  const currentFontName = getFontDisplayName(value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /**
   * Positions the portaled dropdown near the trigger and flips upward when the
   * trigger is close to the bottom of the viewport.
   */
  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(300, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(margin, rect.right - width),
      window.innerWidth - width - margin
    );
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const opensUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(220, Math.min(400, (opensUp ? spaceAbove : spaceBelow) - 4));
    setDropdownStyle({
      position: 'fixed',
      top: opensUp ? Math.max(margin, rect.top - availableHeight - 4) : rect.bottom + 4,
      left,
      width,
      maxHeight: availableHeight,
      zIndex: 10000,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  /**
   * Loads a Google Fonts family through the shared page-level cache and updates
   * this picker's local loaded set after the font can be used for previews.
   */
  const loadGoogleFont = useCallback(async (fontName: string) => {
    await ensureGoogleFont(fontName);
    setLoadedFonts(new Set(loadedGoogleFontFamilies));
  }, []);

  /**
   * Builds the visible option list for the current category and search text.
   *
   * The list is capped to 100 options to keep the right-panel dropdown fast and
   * visually bounded, matching the original app's rendering behavior.
   */
  const getFonts = () => {
    let fonts: { name: string; value: string; category: string }[] = [];

    if (category === 'system') {
      fonts = SYSTEM_FONTS.map(f => ({ ...f, category: 'system' }));
    } else if (category === 'popular') {
      fonts = POPULAR_FONTS.map(name => ({ name, value: `'${name}', sans-serif`, category: 'google' }));
    } else {
      fonts = [
        ...SYSTEM_FONTS.map(f => ({ ...f, category: 'system' })),
        ...ALL_FONT_FALLBACKS.map(name => ({ name, value: `'${name}', sans-serif`, category: 'google' })),
      ];
    }

    if (search) {
      const s = search.toLowerCase();
      fonts = fonts.filter(f => f.name.toLowerCase().includes(s));
    }

    return fonts.slice(0, 100);
  };

  const fonts = getFonts();

  const dropdown = isOpen ? createPortal(
    <div ref={dropdownRef} className="font-picker-dropdown open" style={dropdownStyle}>
      <div className="font-picker-search">
        <input
          type="text"
          placeholder="Search fonts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="font-picker-categories">
        <button type="button" className={`font-category${category === 'system' ? ' active' : ''}`} onClick={() => setCategory('system')}>System</button>
        <button type="button" className={`font-category${category === 'popular' ? ' active' : ''}`} onClick={() => setCategory('popular')}>Popular</button>
        <button type="button" className={`font-category${category === 'all' ? ' active' : ''}`} onClick={() => setCategory('all')}>All</button>
      </div>

      <div className="font-picker-list">
        {fonts.map((font) => {
          const isSelected = value === font.value || value.includes(font.name);
          const isLoaded = font.category === 'system' || loadedFonts.has(font.name);

          return (
            <div
              key={font.name}
              className={`font-option${isSelected ? ' selected' : ''}`}
              onClick={async () => {
                if (font.category === 'google') {
                  await loadGoogleFont(font.name);
                }
                onChange(font.value);
                setIsOpen(false);
              }}
              onMouseEnter={() => {
                if (font.category === 'google' && !loadedFonts.has(font.name)) {
                  void loadGoogleFont(font.name);
                }
              }}
            >
              <span className="font-option-name" style={{ fontFamily: isLoaded ? font.value : 'inherit' }}>
                {font.name}
              </span>
              <span className="font-option-category">{font.category}</span>
            </div>
          );
        })}
        {fonts.length === 0 && (
          <div className="font-picker-empty">No fonts found</div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="font-picker">
      <button
        id={id}
        ref={triggerRef}
        className="font-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="font-picker-preview" style={{ fontFamily: value }}>
          {currentFontName}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {dropdown}
    </div>
  );
}

/**
 * Extracts a human-readable family name from a CSS font-family value.
 */
function getFontDisplayName(fontValue: string): string {
  // Check system fonts
  const system = SYSTEM_FONTS.find(f => f.value === fontValue);
  if (system) return system.name;

  // Extract from Google Font value like "'Roboto', sans-serif"
  const match = fontValue.match(/'([^']+)'/);
  if (match) return match[1];

  return 'SF Pro Display';
}
