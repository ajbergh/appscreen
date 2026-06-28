# App Store Screenshot Generator

A free, open-source tool for creating App Store and marketing screenshots with customizable backgrounds, localized text overlays, decorative elements, popouts, and 2D/3D device mockups.


**[Start using it now. Hosted on GitHub Pages](https://yuzu-hub.github.io/appscreen/)**

![App Store Screenshot Generator](img/screenshot-generator.png)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 🍋 **Built by [YuzuHub](https://yuzuhub.com)** — We build smart AI products in Düsseldorf, Germany. Check out [yuzu.chat](https://yuzu.chat), [Eno](https://eno.yuzuhub.com), [VoltPlan](https://voltplan.app) and more.

## Features

### Output & Export
- **Multiple Output Sizes**: iPhone, iPad, Android phone/tablet, web social/hero formats, and custom dimensions
- **Batch Export**: Export all screenshots at once as a ZIP file
- **Per-Screenshot Settings**: Each screenshot can have its own background, device settings, and text

### Backgrounds
- **Gradient Backgrounds**: Multi-stop gradients with draggable color stops and angle control
- **Preset Gradients**: Quick-access gradient presets for common styles
- **Solid Color**: Simple single-color backgrounds
- **Image Backgrounds**: Upload custom images with blur, overlay, and fit options
- **Noise Overlay**: Add subtle noise texture to any background

### Device Mockups
- **2D Mode**: Position, scale, rotate, and adjust corner radius of screenshots
- **3D Mode**: Interactive iPhone, iPad, and Samsung mockups with drag-to-rotate and frame color presets
- **Position Presets**: Centered, bleed, tilt left/right, perspective, and more
- **Shadow Effects**: Customizable drop shadows with color, blur, opacity, and offset
- **Border Effects**: Add borders around screenshots with adjustable width and opacity

### Text Overlays
- **Headlines & Subheadlines**: Separate controls with enable/disable toggles
- **Font Picker**: Searchable system, popular, and "All" font lists with a local Google Fonts fallback catalog
- **Text Styling**: Font weight, italic, underline, strikethrough options
- **Positioning**: Top or bottom placement with offset control
- **Line Height**: Adjustable spacing for multi-line text

### Multi-Language Support
- **Multiple Languages**: Add translations for any language
- **Language Flags**: Visual language switcher with flag icons
- **AI-Powered Translation**: Auto-translate using Claude, OpenAI, or Google AI
- **Per-Screenshot Languages**: Different text per screenshot if needed
- **Localized Screenshots**: Upload language-specific screenshot images with auto-detection from filename
- **Smart Duplicate Detection**: Dialog to replace, create new, or skip when uploading matching screenshots
- **Multi-Language Export**: Export current language only or all languages in separate folders

### Project Management
- **Multiple Projects**: Create, rename, and delete projects
- **Auto-Save**: All changes saved automatically to browser storage
- **Screenshot Count**: See screenshot counts in project selector

### User Interface
- **Theme Modes**: Dark, light, and automatic system-theme modes
- **Side Preview Carousel**: See adjacent screenshots while editing
- **Drag & Drop**: Reorder screenshots by dragging
- **Toggle Sections**: Enable/disable controls for optional effects and text areas
- **Tab Persistence**: Remembers your active tab between sessions

## Getting Started

### Just Want to Use It?

Visit **[yuzu-hub.github.io/appscreen](https://yuzu-hub.github.io/appscreen/)** to use the tool directly in your browser. No installation needed!

---

### Want to Develop & Customize?

#### Option 1: With Claude Desktop (Easiest - No Technical Knowledge Required)

Perfect for non-technical users who want to run and modify the tool locally with AI assistance:

1. **Install GitHub Desktop**
   - Download from [desktop.github.com](https://desktop.github.com)
   - Install and sign in with your GitHub account

2. **Clone this repository**
   - Click the green "Code" button above → "Open with GitHub Desktop"
   - Choose where to save it (e.g., Documents folder)

3. **Install Claude Desktop**
   - Download from [claude.ai/download](https://claude.ai/download)
   - Sign in with your Anthropic account

4. **Open in Claude Desktop**
   - Open Claude Desktop app
   - Click the "Code" tab at the top
   - Click "Open Folder" and select the cloned repository folder

5. **Start the app**
   - Simply type: **"start the app"**
   - Claude will automatically start the server and tell you which URL to open in your browser
   - Claude monitors the server and reports any issues

6. **Make changes**
   - Ask Claude to modify features, fix bugs, or add functionality
   - Claude will show you the proposed commit message before committing
   - All changes are automatically saved to Git

No command line, no technical setup - just chat with Claude!

#### Option 2: Run Locally (Command Line)

The active app is the React + TypeScript implementation under `src/`, served by Vite:

```bash
cd appscreen
npm install
npm run dev -- --host localhost
```

Then open the local URL Vite prints, usually `http://localhost:5173/`. If that port is already in use, Vite will choose the next available port.

For a production build:

```bash
npm run build
```

The legacy vanilla files remain in the repository as parity references, but opening `index.html` directly from the filesystem is not the recommended development path for the React app.

#### Option 3: Static Legacy Preview

The original vanilla implementation can still be served with a simple static server for reference work:

```bash
python3 -m http.server 8000
```

Use this only when comparing against the legacy implementation. React development should use Vite.

#### Option 4: Docker

Run the pre-built Docker image from GitHub Container Registry:

```bash
# Using Docker directly
docker run -d -p 8080:80 ghcr.io/yuzu-hub/appscreen:latest

# Using Docker Compose
docker compose up -d
```

Then open `http://localhost:8080` in your browser.

#### Building locally

If you want to build the image yourself:

```bash
docker compose -f docker-compose.build.yml up -d
```

## Usage

1. **Upload Screenshots**: Drag and drop your app screenshots or click to browse
2. **Choose Output Size**: Select the target device size from the sidebar
3. **Customize Background**: Choose gradient, solid color, or image background
4. **Position Screenshot**: Use presets or manually adjust scale, position, and rotation
5. **Switch to 3D** (optional): Enable 3D mode for interactive iPhone mockup
6. **Add Text**: Enter your headline and optional subheadline
7. **Export**: Download the current screenshot or export all at once as ZIP

## AI Translation

To use the AI-powered translation feature:

1. Click the Settings icon (gear) in the sidebar
2. Choose your AI provider (Claude, OpenAI, or Google)
3. Enter your API key from the respective provider's console
4. Add multiple languages to your headline/subheadline
5. Click the translate icon and use "Auto-translate with AI"

Your API key is stored locally in your browser and only sent to the respective AI provider's API.

## Tech Stack

- React 18 + TypeScript + Vite for the active app
- Zustand for in-memory app/project state
- HTML5 Canvas for 2D compositing and PNG export
- Three.js for 3D device mockups
- IndexedDB for browser-local project storage
- JSZip for batch ZIP export
- Local font fallback catalog plus on-demand Google Fonts stylesheet loading
- Claude/OpenAI/Google APIs for translations and Magical Titles
- Docker + nginx for containerized deployment

## Architecture

The active React implementation is organized around a shared render path so preview, side previews, and exports stay aligned:

- `src/main.tsx` and `src/App.tsx` initialize theme, IndexedDB, project loading, autosave, and layout.
- `src/stores/appStore.ts` holds screenshots, selected index, defaults, output dimensions, language state, and style-transfer actions.
- `src/stores/projectStore.ts` serializes/deserializes projects to IndexedDB and migrates legacy data where possible.
- `src/canvas/renderer.ts` draws backgrounds, screenshots, text, elements, popouts, and noise into Canvas 2D.
- `src/hooks/useCanvas.ts` connects store state to the preview and exports `renderScreenshotToCanvas()` for export parity.
- `src/hooks/useThreeJS.ts` handles Three.js scene/model setup, frame colors, texture swapping, and 3D export rendering.
- `src/components/Controls/` contains the right-panel editors.
- `src/components/Modals/` contains settings, languages, translation, Magical Titles, emoji, icon, and progress modals.
- `REACT_REFACTOR_PARITY_AUDIT.md` tracks parity work against the original vanilla app.

The original `app.js`, `three-renderer.js`, `language-utils.js`, `magical-titles.js`, and `llm.js` files are still useful as reference material when validating parity.

## Apps Using This Project

Built something with this tool? Add your app to the list by submitting a pull request!

| App | Description | Link |
|-----|-------------|------|
| Cable | Manage your 12V systems like Boats and RVs | [cable.yuzuhub.com](https://cable.yuzuhub.com) |
| Eno | Wine pairings and food pairings made easy | [eno.yuzuhub.com](https://eno.yuzuhub.com) |
| TravelRates Currency Converter* | Exchange Rates for Travelers | [apple.com](https://apps.apple.com/sg/app/travelrates-currency-converter/id6756080378) |
| Trakz Sales Tracker | Manage sales for restaurants and small businesses | [apple.com](https://apps.apple.com/us/app/trakz-sales-tracker/id6748954468) |
| AI Soccer Insights Football IQ | AI-powered football predictions and insights | [apple.com](https://apps.apple.com/us/app/ai-soccer-insights-football-iq/id6592649804) |
| Navegatime | time tracking for workers and business functions | [play.google.com](https://play.google.com/store/apps/details?id=com.companyname.NavegaTime) |
| Sommo | Your personal wine journey — scan labels, learn wine, and build your tasting journal | [sommo.app](https://sommo.app) |
| Dandelion: Write and Let Go | An ephemeral journal for writing to let go, not save. | [apple.com](https://apps.apple.com/us/app/dandelion-write-and-let-go/id6757363901) |
| *Your app here* | *Submit a PR to add your app* | *Your app link* |

## License

MIT License - feel free to use, modify, and distribute.

## Credits
- **Samsung Galaxy S25 Ultra 3D Model** by [mistJS](https://sketchfab.com/mistjs) - Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

- **iPhone 15 Pro Max 3D Model** by [MajdyModels](https://sketchfab.com/majdymodels) - Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Author

Proudly vibe coded by [Stefan](https://github.com/BlackMac) at [YuzuHub](https://yuzuhub.com/en) — building smart AI products from Düsseldorf, Germany.
