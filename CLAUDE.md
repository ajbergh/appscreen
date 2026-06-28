# CLAUDE.md

This file gives coding agents the current repository context and the local workflow for the App Store Screenshot Generator.

## Project Overview

App Store Screenshot Generator is a browser-based tool for composing App Store and marketing screenshots. The active application is the React + TypeScript refactor under `src/`, using Zustand for state, Vite for local development/builds, Canvas 2D for final compositing, Three.js for 3D device mockups, IndexedDB for project persistence, and JSZip for batch exports.

The original vanilla implementation remains in the repository as parity reference material:

- `app.js` - canonical legacy UI/application behavior.
- `three-renderer.js` - canonical legacy 3D rendering behavior.
- `language-utils.js` - canonical legacy localization/upload behavior.
- `magical-titles.js` and `llm.js` - canonical legacy AI feature behavior.

When behavior differs between React and vanilla, treat `REACT_REFACTOR_PARITY_AUDIT.md` as the tracking document and keep it updated with fixes, verification, and known deviations.

## Agent Instructions

**Development Server**

- Use `npm run dev -- --host localhost` for the React app.
- Vite normally serves the app on `http://localhost:5173/`; if that port is busy, use the next port Vite reports.
- Start the server in the background when rendered validation is needed and tell the user the URL.
- Do not ask the user to start the server manually unless the local environment blocks process execution.

**Build and Validation**

- Run `npx tsc -b` for TypeScript validation after TypeScript/React edits.
- Run `npm run build` when the sandbox allows Vite/esbuild access. If sandboxing blocks Vite config resolution, report the sandbox limitation and provide the TypeScript/browser checks that did run.
- For UI changes, run a browser smoke check against the local Vite URL. Python Playwright is available in this workspace even when the Node `playwright` package is absent.
- Keep screenshots and temporary browser artifacts outside committed source unless the user explicitly asks for committed test artifacts.

**Git and Commits**

- Do not commit automatically.
- Before creating a commit, show the proposed commit message and wait for user approval.
- Preserve unrelated working-tree changes. This repository currently contains both legacy files and untracked React-refactor files, so inspect before reverting or deleting anything.

## Active React Architecture

**Entry and Layout**

- `src/main.tsx` initializes the app and applies the persisted/OS theme.
- `src/App.tsx` initializes IndexedDB/project state, installs autosave, and renders the main layout.
- `src/components/Layout/AppLayout.tsx` composes `LeftSidebar`, `CanvasArea`, and `RightSidebar`.
- `src/components/Layout/LeftSidebar.tsx` owns project selection, image import, backup import/export, screenshot list actions, language menus, and PNG/ZIP export flows.
- `src/components/Layout/CanvasArea.tsx` owns the live preview canvas, side previews, element dragging, snap guides, and 3D drag interaction.
- `src/components/Layout/RightSidebar.tsx` switches between Background, Device, Text, Elements, and Popouts controls.

**State and Persistence**

- `src/stores/appStore.ts` is the in-memory Zustand store for screenshots, selected index, defaults, current language, device output, active tab, and style transfer actions.
- `src/stores/projectStore.ts` owns IndexedDB database creation, project metadata, serialization, deserialization, format-version migration, and screenshot counts.
- `src/types/index.ts` defines the shared data contracts used by the stores, renderer, controls, and modals.

**Rendering**

- `src/canvas/renderer.ts` is the pure Canvas 2D pipeline: background, noise, screenshot image, text, elements, popouts, and full render orchestration.
- `src/hooks/useCanvas.ts` connects Zustand state to the preview canvas and exposes `renderScreenshotToCanvas()` for export and side-preview parity.
- `src/hooks/useThreeJS.ts` owns Three.js scene setup, model loading, frame-color application, 3D texture swapping, preview rendering, and export rendering.

**Controls and Modals**

- `src/components/Controls/*.tsx` contains the right-panel editors for background, device, text, elements, and popouts.
- `src/components/UI/FontPicker.tsx` implements the Text/Element font picker; `src/components/UI/fontCatalog.ts` provides the offline fallback catalog for the All tab.
- `src/components/Modals/Modals.tsx` contains About, Settings, and Languages modals.
- `src/components/Modals/AllModals.tsx` contains export progress, per-field translation, Translate All, Magical Titles, screenshot translations, emoji picker, and icon picker.

## Current Dependency Model

- React, React DOM, Zustand, Three.js, and JSZip are bundled through Vite.
- `index.html` should not load Three.js, GLTFLoader, or JSZip from CDNs.
- Google Fonts stylesheets are loaded on demand only when a Google font is selected or previewed; the font list itself has a local fallback catalog.
- Lucide icon metadata is provided by `lucide-icons.js`, and individual icon SVGs may be fetched/cached or reconstructed from stored data.

## Rendering Pipeline

The shared render path is:

1. Resolve output dimensions with `getCanvasDimensions()`.
2. Resolve the localized screenshot image with `getScreenshotImage()`.
3. Draw background and optional noise.
4. Draw elements behind the screenshot.
5. Draw either the 2D screenshot image or the Three.js device render.
6. Draw elements above the screenshot.
7. Draw popouts from the localized source image.
8. Draw localized headline/subheadline text.
9. Draw elements above text.

Use `renderScreenshotToCanvas()` for preview/export parity instead of creating a separate export-only drawing path.

## Documentation Expectations

- Keep `README.md`, `CLAUDE.md`, and `REACT_REFACTOR_PARITY_AUDIT.md` consistent with the active React implementation.
- File-level comments should explain ownership, runtime assumptions, and cross-module contracts.
- Function comments should explain non-obvious behavior, compatibility decisions, persistence formats, or rendering math. Avoid comments that only restate a function name.
