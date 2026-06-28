import { useState, useEffect, useRef, useCallback } from 'react';
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

interface FontPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function FontPicker({ value, onChange, id }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<'system' | 'popular' | 'all'>('popular');
  const [search, setSearch] = useState('');
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
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

  // Load a Google Font dynamically
  const loadGoogleFont = useCallback(async (fontName: string) => {
    if (loadedFonts.has(fontName)) return;
    try {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800;900&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      await document.fonts.load(`400 16px "${fontName}"`);
      setLoadedFonts(prev => new Set(prev).add(fontName));
    } catch {}
  }, [loadedFonts]);

  // Get fonts for current category
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

  return (
    <div className="font-picker" ref={dropdownRef}>
      <button
        ref={triggerRef}
        className="font-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="font-picker-preview" style={{ fontFamily: value }}>
          {currentFontName}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="font-picker-dropdown open">
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
            <button className={`font-category${category === 'system' ? ' active' : ''}`} onClick={() => setCategory('system')}>System</button>
            <button className={`font-category${category === 'popular' ? ' active' : ''}`} onClick={() => setCategory('popular')}>Popular</button>
            <button className={`font-category${category === 'all' ? ' active' : ''}`} onClick={() => setCategory('all')}>All</button>
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
                      loadGoogleFont(font.name);
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
        </div>
      )}
    </div>
  );
}

function getFontDisplayName(fontValue: string): string {
  // Check system fonts
  const system = SYSTEM_FONTS.find(f => f.value === fontValue);
  if (system) return system.name;

  // Extract from Google Font value like "'Roboto', sans-serif"
  const match = fontValue.match(/'([^']+)'/);
  if (match) return match[1];

  return 'SF Pro Display';
}
