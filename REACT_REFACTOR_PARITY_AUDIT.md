# React Refactor Parity Audit

> Source of truth: original vanilla-JS implementation — `app.js` (8,649 lines), `three-renderer.js` (1,323), `language-utils.js` (565), `magical-titles.js` (~460), `llm.js`, `styles.css` (3,528), and the committed `index.html` (`git show HEAD:index.html`, 1,977 lines).
> Refactor under audit: `src/` (React + Zustand + TypeScript, ~2,358 lines across stores, hooks, canvas renderer, and components).
> Method: seven parallel deep-dives, one per subsystem, each treating `app.js` as canonical. No application code was modified during this audit.

---

## Summary

The React refactor is a **substantial but incomplete** port. The core architecture is sound: a Zustand `appStore` mirrors the original `state` object, `renderer.ts` is a mostly-faithful translation of the 2D canvas pipeline, `useThreeJS.ts` reproduces the iPhone GLB load path and lighting, IndexedDB schema/version match, and the CSS file is essentially a **superset** of the original (most "missing class" worries are unfounded). Per-control wiring for Background/Device/Text/Elements/Popouts largely exists.

## Implementation Progress

**Status as of 2026-06-28:** Core output correctness, 3D export/render parity, key slider/range drift, persistence/data-safety fixes, project backup import/export, Magical Titles, Translate All, element translation, crop dragging, duplicate upload handling, Tauri import, theme fixes, bundled JSZip/Three.js dependencies, Text-tab font picker visibility/full fallback catalog, and build/browser verification have been implemented in React. All tracked checklist items below are marked complete; documented deviations are called out inline.

**Verification:** `npm run build` passes after the implementation pass. A Playwright smoke check against `http://localhost:5174/` loads the app, renders meaningful content, shows no framework overlay, reports no console errors or failed requests, opens/closes Settings, adds a blank screenshot, and captures desktop/mobile screenshots. A follow-up Playwright check verifies the Text-tab font picker opens, shows 100 visible options, searches the local All-font fallback catalog, and updates the selected font preview.

However, the refactor is **not 1:1**, and several gaps are severe enough to break primary workflows:

**Biggest risks**

1. **3D screenshots do not export.** The export path is 2D-only; the live preview composites the Three.js device but every export handler calls `renderToCanvas(..., use3D=false)`. Any 3D screenshot exports with an empty device region. (Preview ≠ export.)
2. **Multi-language text never reaches the export.** `drawText` ignores its language argument and always renders `text.currentHeadlineLang`. So per-language ZIP folders all contain the *same* headline/subheadline text — the central payoff of the entire translation system is broken.
3. **Whole features are missing:** "Magical Titles" (vision-AI headline generation), "Translate All" (project-wide bulk translation), project backup import/export (`.json`), the data-migration layer for projects authored by the original app, interactive **drag-to-position** for elements, and interactive **crop-rectangle drag** for popouts.
4. **3D frame/body color does nothing.** The color swatches in the Device panel write state that the 3D renderer never reads or applies. Plus a double-`baseModelScale` bug and a spurious vertical offset make the 3D device the wrong size and position vs. the original.
5. **Silent output drift from slider range changes.** ~10 sliders have different `min/max` than the original (scale, X/Y position, rotations, text sizes, offset-Y, line-height). Same slider position → different pixels, and position presets that set values outside the new ranges (e.g. bleed presets at y=120/−20) can't round-trip.
6. **Fragile persistence:** icon elements lose their image on reload, duplicated screenshots lose all images, project screenshot counts are always stale, `projectLanguages`/custom dimensions aren't in the auto-save dependency set, and a background holding a live `Image` can make the entire save silently throw.

The refactor is closer to **70–80% feature-complete** for the static-2D path and **much less** for 3D, export fidelity, localization output, and direct-manipulation interactions. The sections below enumerate every finding with locations and fixes.

---

## Critical Issues

### C-1. 3D-mode screenshots export with no device (preview ≠ export)
- **Severity:** Critical
- **app.js:** `updateCanvas` (≈7000–7016) composites 3D via `renderThreeJSToCanvas`; `exportCurrent` (8214/8221), `exportAllForLanguage` (8298), `exportAllLanguages` (8370); full-res 3D in `three-renderer.js` `renderThreeJSToCanvas` (897–970).
- **React:** `src/components/Layout/LeftSidebar.tsx` `handleExportCurrent` (194), `handleExportAll` (220), `handleExportAllAllLanguages` (254) all call `renderToCanvas(... use3D=false)`; `src/canvas/renderer.ts:696` (`if (screenshotImage && !use3D)`) suppresses the 2D image when 3D is on, and nothing composites the model.
- **Original:** Export reuses the same compositing as the preview, so a 3D screenshot exports as the rendered device mockup at full device resolution.
- **React:** The live preview (`src/hooks/useCanvas.ts:62–82`) composites 3D, but exports never call `threeRenderer.renderToCanvas`. Exported PNG shows background + text/elements with an empty device area.
- **Why this is a parity problem:** The tool's primary output is broken for every 3D screenshot; what you see is not what you get.
- **Recommended fix:** Extract the `useCanvas` 3D branch into a shared `renderScreenshotToCanvas(canvas, screenshot, dims, lang)` and call it from all three export handlers; when `screenshot.screenshot.use3D && threeRenderer?.isReady`, draw bg/noise → `threeRenderer.renderToCanvas(...)` → elements/popouts/text. Requires C-3 below for per-screenshot device/texture switching.

### C-2. Multi-language export renders the wrong text language (`drawText` ignores its lang arg)
- **Severity:** Critical
- **app.js:** `exportAllForLanguage` (8289–8294) and `exportAllLanguages` (8362–8366) temporarily set each screenshot's `text.currentHeadlineLang`/`currentSubheadlineLang` (and current layout lang) to the target language before rendering, then restore.
- **React:** `src/canvas/renderer.ts` `drawText` (338–357) names its parameter `_currentLanguage` and never uses it — it always reads `text.currentHeadlineLang || 'en'` / `text.currentSubheadlineLang`. `handleExportAllAllLanguages` (LeftSidebar 234–268) passes `lang` but it has no effect on text; only the localized *image* swaps.
- **Original:** Each per-language folder shows that language's translated headline/subheadline and that language's image.
- **React:** Every language folder shows identical text (whatever the UI's current headline language is). `handleExportCurrent` shares the flaw (only correct when UI language == `currentHeadlineLang`).
- **Why this is a parity problem:** The output of the entire localization + AI-translation system never appears in exports. Translations are invisible.
- **Recommended fix:** Either make `drawText` honor the passed language (`text.headlines[lang] ?? headlines[currentHeadlineLang] ?? en`, same for subheadline and layout lang), or have the export path pass a cloned `text` object with `currentHeadlineLang/currentSubheadlineLang/currentLayoutLang = lang` (mirrors the original).

### C-3. 3D renderer cannot render an arbitrary screenshot (no per-screenshot texture/device/frame-color)
- **Severity:** Critical
- **three-renderer.js:** `renderThreeJSForScreenshot(canvas, w, h, index)` (973–1132) selects the screenshot's device (live or cached model), swaps the screen texture to that screenshot's image, applies its frame color, rotation, scale, position, renders, restores. Model cache: `loadCachedPhoneModel`/`buildCachedModel`/`preloadAllPhoneModels` (601–705).
- **React:** `src/hooks/useThreeJS.ts` `renderToCanvasInternal` (344–416) takes only `(canvas, w, h, screenshotSettings)` and always renders the single currently-loaded `phonePivot` with the texture currently bound. No index, no texture swap, no device switch, no frame color, no model cache.
- **Original:** Can render any screenshot's correct device + image + color regardless of which model is "active".
- **React:** Can only correctly render the currently selected screenshot's device.
- **Why this is a parity problem:** Blocks correct 3D **batch export** (C-1) and 3D **side previews** (H-5). Mixed-device 3D projects can't export correctly.
- **Recommended fix:** Port the model cache + a `renderForScreenshot(canvas, w, h, screenshot)` that swaps texture/device/frameColor and restores.

### C-4. 3D frame/body color is never applied to the model
- **Severity:** Critical
- **three-renderer.js:** `frameColorPresets` (67–114); `setPhoneFrameColor` (333–353); `setCachedModelFrameColor` (356–374); applied in `finishCurrentModelLoad` (258–260) and `renderThreeJSForScreenshot` (1048–1054, 1118–1123). Traverses the model and sets `child.material.color` for any mesh whose lowercased `material.name` matches a preset key (iPhone: `backpanel`/`metalframe`/`gray`; iPad: `frame`/`back_glass`/`bezel`/`camera`; Samsung: `frame`/`back_glass`/`antenna`).
- **React:** `src/components/Controls/DevicePanel.tsx:108–128` renders swatches and writes `setScreenshotSetting('frameColor', id)`, but `useThreeJS.ts` has no `frameColorPresets`, no traversal, and never reads `ss.frameColor`. The swatch UI is purely cosmetic.
- **Original:** Clicking a color recolors the device.
- **React:** The device always renders in default gray.
- **Why this is a parity problem:** A prominent control has zero effect.
- **Recommended fix:** Port `frameColorPresets` + a `setFrameColor(presetId, deviceType)` traversal; call it on model load and whenever `ss.frameColor` changes. Also reconcile the hardcoded `FRAME_COLORS` swatch hexes in DevicePanel with the original (several diverge — see D-13) and add the iPad `camera` mesh/material (B-4) so its preset key binds.

---

## Missing Functionality

### M-1. "Magical Titles" (vision-AI headline generation) — entirely removed
- **Severity:** Critical
- **Source:** `magical-titles.js` (whole module); `index.html` `#magical-titles-btn` (106–110) + `#magical-titles-modal`, wired `app.js:4082–4091`.
- **React:** No `src/**/magical*`, no header button (LeftSidebar header has only language/About/Settings), no modal, no vision API calls.
- **Original:** A header button opens a confirm modal (screenshot count, provider, source-language picker), sends **every screenshot's image** as vision input to the selected LLM, generates unique punchy headline+subheadline per screenshot, parses indexed JSON, and writes results into **all** screenshots (enabling headline/subheadline). Includes progress overlay + first-run discovery tooltip.
- **React:** Feature absent.
- **Why this is a parity problem:** A flagship AI feature is gone, including all three provider vision integrations.
- **Recommended fix:** Port to a `useMagicalTitles` hook + `MagicalTitlesModal` + header button; reuse the vision request builders; apply results across `screenshots` via the store.

### M-2. "Translate All" (project-wide bulk translation) — removed
- **Severity:** High
- **Source:** `index.html` language menu second button `#translate-all-btn` → `translateAllText` (`app.js:5641`); also `aiTranslateAll` (5303), `showTranslateConfirmDialog` (5527).
- **React:** LeftSidebar language menu (390–405) has only "Edit Languages…".
- **Original:** Collects all screenshots' headlines + subheadlines, sends one indexed prompt, writes translations back into all screenshots for all target languages at once; with a confirm dialog showing source-language picker + live "texts to translate" count + provider.
- **React:** Only per-field translation via `TranslateModal`, scoped to the current screenshot's single field. No bulk path, no confirm/cost preview.
- **Recommended fix:** Add a "Translate All…" menu item; port `translateAllText` + `showTranslateConfirmDialog` over the store.

### M-3. Project backup export/import (`.json`) — removed
- **Severity:** High
- **Source:** `setupEventListeners` handlers (`app.js:3960–4017`) for `#export-project-btn`/`#import-project-btn`/`#import-project-input` (index.html 154–168).
- **React:** No such buttons, input, or handlers anywhere in `src/`.
- **Original:** Export dumps every IndexedDB object store via `getAll()` to `appscreen-backup-YYYY-MM-DD.json`; import `put`s every record back and reloads. Full cross-machine/browser backup/restore.
- **React:** Capability gone.
- **Recommended fix:** Re-add export/import (LeftSidebar or Settings) using `projectStore.db` to `getAll()`/`put()`.

### M-4. Data-migration layer for legacy/original-app projects — removed
- **Severity:** High (corrupts data written by the original app sharing the same DB name)
- **Source:** `loadState` migration (1764–1804, 1930–1934), `migrate3DPosition` (1714–1728), `showMigrationPrompt`/`convertProject` (1983–2001); `saveState` stamps `formatVersion: 2` (1684).
- **React:** `projectStore.loadProjectState` (243–265)/`deserializeScreenshots` (46–77) — no old-format detection, no 3D-position migration, no legacy `src`→`localizedImages` conversion, no migration modal, never writes `formatVersion`.
- **Original:** Detects old top-level `background/screenshot/text`, migrates single `src` into `localizedImages`, runs `migrate3DPosition` when `formatVersion < 2`, prompts to convert.
- **React:** Projects from the original app (same IndexedDB `AppStoreScreenshotGenerator`) load blank/mispositioned.
- **Recommended fix:** Port the detection + conversions into `deserializeScreenshots`/`loadProjectState`; stamp `formatVersion: 2` on save.

### M-5. Interactive element drag-to-position on canvas — entirely missing
- **Severity:** Critical (major lost capability)
- **app.js:** `setupElementCanvasDrag` (2915–3187), `hitTestElements` (2984), `applyDragMove` (3018), `drawSnapGuides` (3190–3224).
- **React:** `src/components/Layout/CanvasArea.tsx` wires only 3D drag-rotate (98–118) and two-finger swipe (71–95). No element hit-testing/dragging on `#preview-canvas`; no snap guides anywhere. Position is sliders-only (`ElementsPanel.tsx:213–222`).
- **Original:** Click hit-tests elements (reverse Z across layers), drag updates `x/y` live with 0–100 clamp + center/middle snap guides (`SNAP_THRESHOLD 1.5`), auto-selects + switches to Elements tab, hover highlight, touch support.
- **React:** None of this.
- **Recommended fix:** Port `setupElementCanvasDrag` + `drawSnapGuides` into a canvas `useEffect`; hit-test `screenshots[selectedIndex].elements`, update via store, draw guides as an overlay pass, add touch.

### M-6. Interactive popout crop-rectangle drag — handlers missing
- **Severity:** Critical
- **app.js:** `setupCropPreviewDrag` (3491–3637) + `hitTestCropHandle` (3507): 8 handles + inside-move, cursor map, 5% min size, bounds clamp, touch.
- **React:** `src/components/Controls/PopoutsPanel.tsx` `useEffect` (55–110) only **draws** the image/overlay/border/8 handle squares — no `mousedown/move/up`/touch listeners. Handles are decorative.
- **Original:** Drag handles to resize / drag inside to move, live.
- **React:** Crop changes only via the four sliders.
- **Recommended fix:** Attach pointer handlers mirroring `setupCropPreviewDrag`, using the same preview layout used to draw (see I-9 about layout-model reconciliation).

### M-7. Tauri desktop file import — removed
- **Severity:** Low (only affects desktop build)
- **app.js:** `importScreenshotsFromTauri` (6207–6230), `handleFilesFromDesktop`/`processDesktopFilesSequentially`/`processDesktopImageFile` (6196–6287), `window.__TAURI__`.
- **React:** No `__TAURI__` usage in `src/` (index.html still adds the `tauri-app` class but nothing consumes it for import).
- **Recommended fix:** Port `importScreenshotsFromTauri` and route through the shared upload handler. Lower priority unless a desktop build ships.

### M-8. Element text "Translate" button + element-translation path — missing
- **Severity:** Medium
- **app.js:** `#translate-element-btn` (index.html 1226) → `openTranslateModal('element')` (4145–4147); element `texts` map + `getElementText` fully supported.
- **React:** `ElementsPanel.tsx` text section (252–257) is a plain input, no translate button. `TranslateModal` declares `target:'element'` but `handleApply` (AllModals 59–75) only writes headline/subheadline — the `'element'` case is dead code.
- **Recommended fix:** Add the button; extend `TranslateModal` to read/write the selected element's `texts` when `target==='element'`.

### M-9. Slider reset buttons — removed across all tabs
- **Severity:** High (pervasive UX loss)
- **app.js:** `setupSliderResetButtons` (594–610, called at 1632) injects a `.slider-reset-btn` on every `.control-row input[type=range]`; click resets to `defaultValue` and dispatches `input`.
- **React:** No equivalent on any range input in Background/Device/Text panels.
- **Recommended fix:** Add a reset affordance per slider (ideally a shared `<Slider min max default>` wrapper that also fixes the range mismatches in the next section).

### M-10. Default elements/popouts — not modeled
- **Severity:** Low–Medium
- **app.js:** `state.defaults` includes `elements: []`/`popouts: []` (97–98); `createNewScreenshot` copies `defaults.elements` (6387); `loadState` ensures it (1957).
- **React:** `DefaultSettings` (types 166–170) has only background/screenshot/text; `createDefaultScreenshot` always uses empty elements; `setCurrentScreenshotAsDefault` captures only bg/screenshot/text.
- **Recommended fix:** Add `elements`/`popouts` to `DefaultSettings` and deep-clone them into new screenshots.

### M-11. Popout list thumbnail + icon-thumb theme filter — missing
- **Severity:** Low
- **app.js:** `updatePopoutsList` (3253–3270) renders a 28×28 cropped thumbnail per popout; element list icon thumb uses `filter: var(--icon-thumb-filter, none)` (2534).
- **React:** PopoutsPanel list items (125–137) show text only (no thumb); ElementsPanel icon thumb (187) omits the filter.
- **Recommended fix:** Render small per-item canvases; add the `--icon-thumb-filter` style.

### M-12. Icon shadow X/Y offset sliders — missing
- **Severity:** Medium
- **app.js:** binds `#element-icon-shadow-x`/`-y` (2777–2778), populated in `updateElementProperties` (2661–2664); renderer uses `s.x/s.y`.
- **React:** `ElementsPanel.tsx` icon-shadow block (332–353) exposes only Blur/Opacity/Color. Icon shadow offset is stuck at default x0/y10.
- **Recommended fix:** Add Shadow X (−50..50) and Y sliders mirroring the popout shadow controls.

---

## Incorrect or Broken Functionality

### B-render-1. Background overlay incorrectly applied to gradient/solid backgrounds
- **Severity:** Critical
- **app.js:** `drawBackgroundToContext` (7283–7299) — gradient/solid branches stop after fill; overlay applied **only** inside `drawBackgroundImageToContext` (7359–7364).
- **React:** `renderer.ts` `drawBackground` (100–104) applies overlay after the gradient/solid branch whenever `overlayOpacity > 0`.
- **Original:** Overlay tints image backgrounds only.
- **React:** Tints gradient and solid backgrounds too; since `overlayOpacity` persists across type switches, a gradient gets an unexpected wash.
- **Recommended fix:** Remove the overlay block at renderer.ts 100–104; keep overlay only in `drawImageBackground`.

### B-render-2. Laurel/star element frames not drawn; frame dropdown options are wrong
- **Severity:** High
- **app.js:** `drawElementFrame` (7785) handles `laurel-*` (via `drawLaurelSVG` 7831 + `drawStar` 7870), `badge-circle`, `badge-ribbon`; laurel SVGs preloaded from `img/laurel-*.svg` (178–183). Original `<select id="element-frame">` options: `none`, `laurel-simple`, `laurel-simple-star`, `laurel-detailed`, `laurel-detailed-star`, `badge-circle`, `badge-ribbon`.
- **React:** `renderer.ts` `drawElementFrame` (469–509) handles only `badge-circle`/`badge-ribbon` and explicitly skips laurels (504–506); `ElementsPanel.tsx` frame `<select>` (288–290) offers `none`/`solid`/`gradient` — values that match **no** frame id the renderer understands.
- **Original:** Seven real frame types render, including laurel wreaths + optional star.
- **React:** `solid`/`gradient` draw nothing; the supported `badge-*` frames aren't even selectable; all laurel/star variants unimplemented.
- **Recommended fix:** Change the `<select>` to the original 7 ids; port `drawLaurelSVG`/`drawStar` + preload the laurel SVGs; add the `laurel-*`/`-star` branches.

### B-render-3. Element frame sized to element box, not measured text width
- **Severity:** Medium
- **app.js:** `drawElementFrame` (7788–7792) sizes the frame from the widest wrapped line's `measureText`.
- **React:** `renderer.ts` (579) passes `elWidth` (the full element box) as `textWidth`.
- **Why:** badge-circle/badge-ribbon render larger/mispositioned whenever text is narrower than the element width (the common case).
- **Recommended fix:** Compute `maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width))` and pass that.

### B-render-4. Export/side-preview noise is ~5× weaker than the original
- **Severity:** High
- **app.js:** Two formulas — `drawNoise` (main preview, 8144–8158) uses `intensity/100*50` (max ±25); `drawNoiseToContext` (side previews + export, 7367–7380) uses `intensity/100*255` (max ±127.5).
- **React:** `renderer.ts` `drawNoise` (182–202) uses the ±25 formula everywhere, including export.
- **Why:** Exported PNG noise is ~5× subtler than the original's export.
- **Recommended fix:** Use the `*255` formula for the export/side-preview path while keeping `*50` for the live preview (or pick one and document the deviation).

### B-render-5. `behind-screenshot` elements not drawn in 3D mode
- **Severity:** Medium
- **app.js:** `updateCanvas` draws `drawElements('behind-screenshot')` for both 2D and 3D.
- **React:** `useCanvas.ts` 3D branch (64–82) omits the `behind-screenshot` layer entirely (2D path via `renderToCanvas` is fine).
- **Recommended fix:** Draw `behind-screenshot` elements after bg/noise and before the 3D model in the 3D branch.

### B-3d-1. Double `baseModelScale` makes the 3D device too small
- **Severity:** Medium
- **three-renderer.js:** model carries `baseModelScale`; pivot scale = `ss.scale/100`. Combined = `baseModelScale × ss.scale/100`.
- **React:** `useThreeJS.ts` sets `model.scale = baseModelScale` (280) **and** `phonePivot.scale = baseModelScale × screenshotScale` (364) → `baseModelScale²`.
- **Recommended fix:** `phonePivot.scale.setScalar(screenshotScale)` (drop the extra factor).

### B-3d-2. Spurious vertical offset (`positionOffsetFactor − 1`) shifts the 3D device
- **Severity:** Medium
- **three-renderer.js:** base position offset y = 0; `positionOffsetFactor` is unused in transform math.
- **React:** `renderToCanvasInternal` (367–371) adds `y = positionOffsetFactor − 1` (iPhone −0.19, iPad −0.28, Samsung −0.5).
- **Recommended fix:** Set `basePositionOffset.y = 0`.

### B-3d-3. Alt+drag-to-move not implemented (tip claims it works)
- **Severity:** High (false UI affordance)
- **three-renderer.js:** `setup3DCanvasInteraction` (1221–1316): Alt-drag adjusts `ss.x/ss.y` (`+= delta*0.2`, clamp 0–100), plain drag rotates.
- **React:** `setupDragRotate` (435–475) + CanvasArea (98–118) only rotate; no `altKey` branch. `DevicePanel.tsx:210` displays "Alt+drag to move".
- **Recommended fix:** Add an Alt-drag branch updating `x/y` (delta*0.2, clamp), with a `move` cursor.

### B-3d-4. 3D rotation clamps differ; Y unbounded on drag
- **Severity:** Medium
- **three-renderer.js:** drag clamps both X and Y to ±45.
- **React:** CanvasArea (109–111) — Y unclamped (`+= dx*0.5`), X clamped ±90; sliders use ±90.
- **Recommended fix:** Decide canonical range; to match original, clamp both axes to ±45 on drag (and reconcile slider ranges — see D-5).

### B-3d-5. Drag bound to hidden Three container, no element-drag guard
- **Severity:** Medium
- **three-renderer.js:** drag listeners on the visible `#preview-canvas` (1222), with an early-abort when `.canvas-wrapper.element-dragging` (1238–1244).
- **React:** `setupDragRotate(threeContainerRef.current, ...)` binds to `#threejs-container`; no element-drag guard.
- **Recommended fix:** Bind to the preview canvas (or guarantee overlay) and port the `element-dragging` guard so device-rotate doesn't fight element dragging (once M-5 lands).

### B-3d-6. Procedural iPad missing camera mesh + `camera` material
- **Severity:** High
- **three-renderer.js:** `createProceduralDeviceModel` (156–218) — 4 materials (`frame`/`back_glass`/`bezel`/`camera`) + 4 meshes incl. a `CircleGeometry` camera at the top; `group.name='procedural-ipad'`.
- **React:** `useThreeJS.ts` (81–123) — 3 materials, 3 meshes, no camera; group name dropped.
- **Recommended fix:** Add the 4th material + camera mesh exactly as the original (also restores the binding target for the iPad `camera` color preset key).

### B-render-6. Position-preset values diverge (esp. "Centered" y) and preset set changed
- **Severity:** High
- **app.js:** `applyPositionPreset` (6157–6166) — 8 presets: `centered{70,x50,y50}`, `bleed-bottom{85,50,120}`, `bleed-top{85,50,-20}`, `float-center{60,50,50}`, `tilt-left{65,50,60,-8}`, `tilt-right{65,50,60,8}`, `perspective{65,50,50,persp15}`, `float-bottom{55,50,70}`.
- **React:** `DevicePanel.tsx` `POSITION_PRESETS` (3–13) — 9 presets: `centered` uses **y=60** (vs 50); drops `float-center`/`float-bottom`; adds invented `large-center`/`small-top`/`small-bottom`.
- **Why:** Same-named "Centered" produces a different vertical position; the preset menu is a different product; bleed presets set values outside React's clamped sliders (see D-2/D-3) so they can't round-trip.
- **Recommended fix:** Restore the exact 8 original presets/values (centered y=50); remove the invented ones.

### B-state-1. Icon element images lost on reload
- **Severity:** High
- **app.js:** `reconstructElementImages` (1731–1750) re-fetches each icon via `getLucideImage(iconName,…)` on load; save strips only the `image`.
- **React:** `ElementsPanel.addIconElement` (114–141) stores `image` as a blob URL with `src:null`; `deserializeScreenshots` (66–73) only rebuilds when `el.src` is set and never re-fetches by `iconName`. Icons come back `image:null` → render nothing.
- **Recommended fix:** In deserialize, add an icon branch re-fetching/colorizing by `iconName/iconColor/iconStrokeWidth` (or store the colorized SVG as a data URL in `el.src`).

### B-state-2. `duplicateScreenshot` loses all images + wrong name format
- **Severity:** Medium
- **app.js:** `duplicateScreenshot` (2200–2250) inserts "(Copy)" before the extension, deep-copies `localizedImages` and the primary image from their `src`.
- **React:** `appStore.duplicateScreenshot` (242–263) names `name + ' (Copy)'` (→ `foo.png (Copy)`), sets `localizedImages={}`, never sets `clone.image`, element `image:null` without re-fetch.
- **Why:** Duplicates are blank.
- **Recommended fix:** Re-create images from each `localizedImages[lang].src` and `original.image.src`; extension-aware "(Copy)".

### B-state-3. Background save can silently throw; `overrides` dropped
- **Severity:** Medium
- **app.js:** `saveState` serializes background via `serializeBackgroundSettings` (always nulls `image`, keeps `imageSrc`); keeps `overrides`.
- **React:** `projectStore.serializeScreenshots` (24–30) only rewrites `background` when `s.background.image && s.background.imageSrc`; otherwise stores `s.background` as-is — which can still hold a live `HTMLImageElement`, making `store.put` throw (caught silently in `saveProjectState`), aborting the whole save. `overrides` is deleted.
- **Recommended fix:** Always normalize background to `{...bg, image: undefined, imageSrc: bg.imageSrc || bg.image?.src || null}`.

### B-state-4. `updateScreenshotCount` never called → stale/zero project counts
- **Severity:** Medium
- **app.js:** `saveState` updates `project.screenshotCount` every save (1696–1700).
- **React:** `projectStore.updateScreenshotCount` (267–275) exists but has no caller. Dropdown rows show the count from `createProject` init (0) forever; only the current project's trigger uses live `screenshots.length`.
- **Recommended fix:** Call `updateScreenshotCount(screenshots.length)` inside `appStore.saveState()`.

### B-state-5. Deleting the active project doesn't load the new current project
- **Severity:** Medium
- **app.js:** `deleteProject` (2136–2159) switches to `projects[0]` and loads its state.
- **React:** `projectStore.deleteProject` (190–210) sets `currentProjectId` but never loads the new project; `LeftSidebar.handleDeleteProject` (295) doesn't either. UI keeps showing the deleted project's screenshots until manual switch/reload.
- **Recommended fix:** After delete, load + `setState` the new current project (mirror the switch flow).

### B-lang-1. Duplicate-upload handling: silent overwrite + weaker matching, no dialog
- **Severity:** High
- **Source:** `showDuplicateDialog`/`findScreenshotByBaseFilename` (`language-utils.js:40–63, 455–565`); upload `handleFiles` (`app.js:6308–6342`).
- **React:** `LeftSidebar.handleFileUpload` (110–153) matches only by primary `name` base; condition `existingIdx >= 0 && detectedLang !== currentLanguage` auto-adds as a localized image **with no dialog**, silently overwriting an existing slot; same-language re-uploads always create a new screenshot.
- **Original:** Scans every localized image's stored filename; if the language slot already has an image → Replace/Create New/Skip dialog; empty slot → add silently.
- **Recommended fix:** Port `findScreenshotByBaseFilename` (scan all `localizedImages[*].name`); branch on whether `localizedImages[detectedLang]` exists; show a ported duplicate modal.

### B-lang-2. `getScreenshotImage` fallback chain shortened/inconsistent across copies
- **Severity:** Medium
- **Source:** `getScreenshotImage` (`language-utils.js:94–122`): current lang → iterate `projectLanguages` → iterate any localized key → legacy `image`.
- **React:** Several divergent copies (`useCanvas.ts:113`, `CanvasArea.tsx:8`, `LeftSidebar.tsx:176,253,486`, `AllModals.tsx:203,247`) all use only `lang → 'en' → image`, skipping the "any project language" / "any key" steps.
- **Why:** A screenshot with only a non-en, non-current image renders blank in React where the original falls back.
- **Recommended fix:** Centralize one `getScreenshotImage(screenshot, lang, projectLanguages)` with the full chain; use everywhere.

### B-lang-3. Filename language-detection regex misses underscore/region variants
- **Severity:** Medium
- **Source:** `getBaseFilename`/`detectLanguageFromFilename` (`language-utils.js:13–86`) — longest-first, `[-_]?` compound separator, optional trailing `[_-][a-z]{2}` region.
- **React:** Inline regexes (`LeftSidebar.tsx:97–108`) accept only exact hyphenated compounds (`pt-br`), not `_pt_br`/`ptbr`, and ignore trailing region segments (`_de-DE`).
- **Why:** `home_pt_br.png`, `home_de_DE.png` detect in the original but fall to current-language in React.
- **Recommended fix:** Replace inline regexes with a shared util ported from `language-utils.js`.

### B-lang-4. Languages modal: `currentLanguage` not reassigned on removal; `defaults.text` not cleaned
- **Severity:** Medium
- **Source:** `removeProjectLanguage` (`app.js:5035`) switches `currentLanguage` to `projectLanguages[0]` if it was removed; strips the lang from `defaults.text` too.
- **React:** `Modals.tsx` `LanguagesModal.handleDone` (267–309) cleans each screenshot but never updates the global `currentLanguage` (left dangling on a removed code) and doesn't clean `defaults.text` (removed langs reappear on the next new screenshot).
- **Recommended fix:** If `currentLanguage ∈ removed`, set it to `languages[0]`; strip removed langs from `defaults.text`.

### B-lang-5. AI translate: per-field/current-screenshot scope, N× calls, weaker prompt
- **Severity:** High
- **Source:** `aiTranslateAll` (5303) sends one JSON prompt for all target languages with length/marketing constraints; `translateAllText` (5641) covers all screenshots in one indexed prompt; both map `AI_UNAVAILABLE`/401/403.
- **React:** `AllModals.tsx` `handleAiTranslate` (77–134) fires **one fetch per language** for the current screenshot's single field, with a bare prompt (no length/marketing/JSON), swallows errors per-language.
- **Why:** No project-wide translate, N× cost, translations may overflow on-screen, weaker error reporting.
- **Recommended fix:** Restore the single-prompt JSON approach + the bulk path + marketing/length prompt + error mapping.

### B-misc-1. Export progress modal is dead code; export loop blocks the main thread
- **Severity:** High
- **app.js:** `showExportProgress`/`hideExportProgress` (8254/8267) updated with live percent + "N of M" / "Generating ZIP…" / "Complete!"; `setTimeout(100)` yields between frames.
- **React:** `LeftSidebar.tsx:33` declares `exportProgress` with **no setter**; `<ExportProgressModal>` (622) is implemented but never opens; no yields in the loops.
- **Recommended fix:** Add the setter, update progress inside loops, restore the yield.

### B-misc-2. Native `alert()` + silent project delete (no confirm)
- **Severity:** Medium (one data-loss hazard)
- **app.js:** themed `showAppAlert`/`showAppConfirm` (5444/5486); project deletion gated behind a confirm modal.
- **React:** `handleExportAll`/`handleExportAllAllLanguages` use native `alert('JSZip not loaded…')` (209/237); `handleDeleteProject` (295) deletes immediately with no confirmation.
- **Recommended fix:** Add reusable `AppAlert`/`AppConfirm`; gate delete behind a confirm; replace native alerts.

### B-misc-3. Google model list missing two Gemini 3 preview models
- **Severity:** Medium
- **llm.js:** Google has 5 models incl. `gemini-3-flash-preview`, `gemini-3-pro-preview`.
- **React:** `Modals.tsx:71–82` Google has only 3 (the two Gemini 3 previews missing). (Anthropic/OpenAI lists, defaults, storage keys, prefixes all match. Minor: Anthropic display name "Anthropic (Claude)" vs React "Claude (Anthropic)".)
- **Recommended fix:** Add the two `gemini-3-*-preview` entries.

### B-misc-4. `auto` theme forces dark instead of following the OS
- **Severity:** Medium
- **app.js:** `applyTheme`/`initTheme` (5955–5969) — for `auto`, deletes `dataset.theme` so `prefers-color-scheme` governs.
- **React:** `main.tsx:7–16` applies saved theme on load (so the theme **is** restored — good), but for `auto` it sets `dataset.theme='dark'` (13), as does `Modals.tsx:111–115`.
- **Recommended fix:** For `auto`, delete `document.documentElement.dataset.theme` in both places.

### B-css-1. Duplicate `#threejs-container` rule clobbers overlay z-index/pointer-events/sizing
- **Severity:** High
- **React:** `src/styles.css:963–977` (intended overlay: `z-index:2; pointer-events:auto; canvas 100% !important`) is overridden by a later appended duplicate at `src/styles.css:3389–3403` (drops `z-index`/`pointer-events`, switches canvas to `max-width/height`). Consumer: `CanvasArea.tsx:233–237`.
- **Why:** The 3D overlay loses explicit stacking + interactivity + forced-fill sizing → drag-to-rotate and layering can break.
- **Recommended fix:** Delete the appended duplicate (3389–3403); keep only 963–977.

---

## UI / Visual Differences

### D — Slider range / default mismatches (each silently changes output)
For every item below, the React `min/max` differs from the original; the same slider position maps to different pixels, and values outside the new range can't round-trip. Fix by restoring original ranges (a shared `<Slider min max default>` wrapper is the clean path, and would also restore M-9 reset buttons).

- **D-1. Screenshot Scale** — orig `min=30 max=100` (index.html 656) vs React `min=10 max=150` (DevicePanel 134). **High.**
- **D-2. Vertical Position** — orig `min=-80 max=180` (index.html 664) vs React `min=0 max=100` (DevicePanel 144). **High** (breaks bleed presets at y=120/−20).
- **D-3. Horizontal Position** — orig `min=-80 max=180` (672) vs React `0..100` (154). **High.**
- **D-4. 2D Rotation** — orig `±45` (696) vs React `±180` (166). **High.**
- **D-5. 3D Rotation X/Y/Z** — orig `±45` (566/573/580) vs React `±90` (84/92/100). **High.**
- **D-6. Headline Size** — orig number input `12..300` (856) vs React slider `20..200` (TextPanel 129). **High** (also control-type change: number entry → slider-only).
- **D-7. Subheadline Size** — orig number `12..200` (977) vs React slider `10..150` (226). **High.**
- **D-8. Text Offset-Y** — orig `0..100` (908) vs React `0..50` (295). **High.**
- **D-9. Line Height** — orig `80..250` (916) vs React `80..200` (304). **Medium.**
- **D-10. Custom export width/height max** — orig `max=4000` (276/278) vs React `max=10000` (LeftSidebar 582/586). **Medium.**
- *Confirmed matching:* corner radius 0–100/24, shadow blur/opacity/x/y, frame width/opacity, subheadline opacity 0–100/70, gradient angle 0–360/135, blur 0–50, overlay opacity. **No action.**

### D-11. Gradient presets reduced 28 → 12, renamed/recolored, categories dropped
- **Severity:** High
- **index.html:** `#gradient-presets` (397–431) — 28 swatches in 8 labeled categories with exact `data-gradient` strings.
- **React:** `BackgroundPanel.tsx:4–17` — 12 presets, mostly new names/colors; no category grouping; applied via hand-authored `angle`+`stops` that don't all match the original gradient strings.
- **Recommended fix:** Port all 28 verbatim (parse the `data-gradient` strings for exact angle+stops); optionally restore category separators.

### D-12. Gradient color-stop editor: draggable bar → plain inputs
- **Severity:** Medium
- **index.html/app.js:** `#gradient-stops` rendered by `updateGradientStopsUI` (6918) as a draggable visual stop bar.
- **React:** `BackgroundPanel.tsx:114–150` — plain color + number(%) inputs (functionally editable, but the drag interaction and live bar are gone). "+ Add Color Stop" label shortened to "+ Add Stop".
- **Recommended fix:** Reimplement the draggable stop bar, or document the simplification.

### D-13. 3D frame-color swatch hexes diverge from the original presets
- **Severity:** Medium
- **three-renderer.js:** `frameColorPresets` swatch/material colors.
- **React:** `DevicePanel.tsx:15–42` hardcodes `FRAME_COLORS` with several different hexes (e.g. iPhone `gold #c4a882` vs `#e3c8a0`, `red #c41e3a` vs `#c1272d`; iPad `silver #c0c0c0` vs `#d8d8d3`, `blue/purple` differ; all Samsung differ).
- **Recommended fix:** Reconcile ids/labels/swatches against `frameColorPresets` (needed anyway for C-4).

### D-14. Image-fit option value: `stretch` → `fill`
- **Severity:** Medium
- **index.html:** `#bg-image-fit` options `cover`/`contain`/`stretch` (485–489).
- **React:** `BackgroundPanel.tsx:243–250` `cover`/`contain`/`fill`. The renderer's non-cover/contain branch stretches regardless, but the persisted string differs (`stretch` vs `fill`) → data written by one won't match the other.
- **Recommended fix:** Align the value string (likely `stretch`) with persistence + renderer.

### D-15. Text Position adds a "Center" option the original lacked
- **Severity:** Medium
- **index.html:** `#text-position` is Top/Bottom only (899–902).
- **React:** `TextPanel.tsx:280` renders Top/Center/Bottom. `renderer.ts` treats `position !== 'bottom'` as top, so `center` silently renders as top.
- **Recommended fix:** Remove `center` (use `['top','bottom']`) unless both renderer + original support it.

### D-16. Output-size dropdown: grouped custom dropdown → flat `<select>`
- **Severity:** Medium
- **index.html:** `#output-size-dropdown` (200–281) — categorized menu (iPhone/iPad/Android/Web dividers), two-line name+dims, "Custom Size" entry.
- **React:** `LeftSidebar.tsx:557–575` — plain `<select>` with the same 15 values but no grouping. (Device set/values match.)
- **Recommended fix:** Optionally restore grouping via `<optgroup>`; low priority since values match.

### D-17. Collapsible sections conflated with the enable toggle
- **Severity:** Medium
- **index.html:** Noise/Shadow/Frame/Headline/Subheadline are `.collapsible` headers with a chevron + body that expands/collapses **independently** of the enable toggle (and specific default collapsed/expanded states).
- **React:** Each section conditionally renders its body based on the enable boolean — collapsing == disabling; no chevron; different initial layout.
- **Recommended fix:** Reintroduce a collapsible component with its own open/closed state separate from the feature-enabled toggle.

### D-18. Other UI control-style differences (low)
- Italic/Underline/Strikethrough icon buttons → text `I/U/S` buttons (TextPanel 155/259). Functionally equivalent.
- Weight "800" labeled "Heavy" (orig) vs "Extra Bold" (React); values match.
- Gradient angle label "Gradient Direction" → "Angle"; bg image upload drop-zone → "Upload Image" button.
- Emoji element list label "😀 Emoji" (generic) because the emoji `name` isn't carried through `onSelect` (AllModals 322 / ElementsPanel 100) — see I-4.

### D-19. Emoji search is broken; emoji metadata lost
- **Severity:** High
- **Source:** `EMOJI_DATA` (`lucide-icons.js`) is `{emoji, name, keywords}`; `renderEmojiSearchResults` (8484) matches name/keywords.
- **React:** `AllModals.tsx` `EmojiPicker` (277–333) stores bare glyphs; search does `emoji.includes(search)` against the glyph itself → typing "fire"/"heart" returns nothing.
- **Recommended fix:** Port `EMOJI_DATA` with name/keywords; match on those; carry `name` into the created element.

### D-20. Icon picker: ~90 icons, no categories, no full-set search
- **Severity:** High
- **Source:** bundled `lucide-icons.js` (`LUCIDE_POPULAR` 55, `LUCIDE_ALL` 1318) with Popular/All categories + name search; runtime SVG colorized.
- **React:** `AllModals.tsx` `IconPicker` (336–395) hardcodes ~90 icons, single flat list, `<img src="unpkg.com/...">` thumbnails. Search filters only those ~90. Most Lucide icons unreachable; offline-broken; blob-URL element images not persistable (see B-state-1).
- **Recommended fix:** Port `lucide-icons.js` arrays into `src/`, restore Popular/All categories + full-set search; prefer a bundled/local SVG source.

---

## Interaction / Workflow Differences

### I-1. Sliding carousel animation between screenshots — not implemented
- **Severity:** Medium
- **app.js:** `slideToScreenshot` (7122–7219) — 300ms `translateX` slide, awaits 3D model loads, pre-renders adjacent previews to temp canvases (anti-flicker), uses `skipSidePreviewRender`.
- **React:** `CanvasArea.tsx` side previews (207/217/255/265) and the wheel swipe (71–95) call `selectScreenshot` instantly; no slide, no pre-render, no flicker suppression.
- **Recommended fix:** Port the slide transition + temp-canvas pre-render + flicker flag; gate the index change on model-load like the original.

### I-2. Keyboard shortcuts — React *added* shortcuts the original never had
- **Severity:** Medium (reverse parity; one data-loss hazard)
- **app.js:** No global shortcuts; the only keydown is on `#project-name-input` (Enter to confirm).
- **React:** `LeftSidebar.tsx:61–94` adds global ArrowLeft/Right, Delete/Backspace (deletes selected screenshot), Ctrl/Cmd+D/E/S, and Escape-to-close.
- **Why:** A 1:1 refactor added behavior absent from the source; Delete/Backspace can destroy a screenshot whenever focus isn't in an input; Ctrl+S/E hijack browser shortcuts.
- **Recommended fix:** For strict parity, remove these (or at minimum guard the destructive Delete/Backspace).

### I-3. 3D side previews are 2D-only (3D neighbors render blank)
- **Severity:** High
- **three-renderer.js:** `renderThreeJSForScreenshot` powers 3D side previews.
- **React:** `CanvasArea.renderSidePreview` (121–178) calls only `renderToCanvas` (2D); a neighboring 3D screenshot shows bg+text with an empty device.
- **Recommended fix:** After C-3 (model cache + `renderForScreenshot`), composite 3D in side previews.

### I-4. Emoji element name not carried; generic list labels
- **Severity:** Low–Medium
- See D-19/D-18. Fix: pass the emoji `name` through `onSelect` into `addEmojiElement`.

### I-5. New-screenshot inherits imageSpan background — partial
- **Severity:** Low
- React `createDefaultScreenshot` (LeftSidebar 155–169) inherits the active span background (matches intent), but the imageSpan **toggle** (BackgroundPanel 258) only flips the current screenshot rather than propagating/clearing across all spanned screenshots like `setBackgroundImageSpan` (app.js 686/698). See I-7.

### I-6. `isWideBackgroundImage` auto-span uses hardcoded dimensions
- **Severity:** Medium
- **app.js:** `isWideBackgroundImage` (652–659) uses real `getCanvasDimensions()` for `screenRatio`.
- **React:** `BackgroundPanel.tsx:208–212` hardcodes `{1290, 2796}`, so auto-span detection triggers on different images for non-iPhone-6.7 outputs (iPad/Android/landscape OG).
- **Recommended fix:** Compute dims from the actual `outputDevice` via `getCanvasDimensions`.

### I-7. Image-span toggle doesn't propagate to all screenshots
- **Severity:** Medium
- **app.js:** `setBackgroundImageSpan(true/false)` (686–708) applies/clears span across all screenshots sharing the image.
- **React:** BackgroundPanel span toggle flips only the current screenshot; enabling via toggle (vs upload) doesn't re-propagate the image.
- **Recommended fix:** Route the toggle through a store action mirroring `setBackgroundImageSpan`.

### I-8. Crop preview layout model differs (letterbox vs aspect-canvas)
- **Severity:** Medium (matters once M-6 drag lands)
- **app.js:** `getCropPreviewLayout` (3392) letterboxes the image inside a fixed canvas (`drawX/drawY` offsets); drag hit-testing uses the same layout.
- **React:** PopoutsPanel `useEffect` (55–110) reflows the canvas to the image aspect and fills it (`drawX=drawY=0`).
- **Recommended fix:** Pick one model; make draw + (to-be-added) drag hit-testing use the same math (reusing `getCropPreviewLayout` is the safest 1:1 path).

### I-9. `movePopout` "down" swap written inconsistently (works today)
- **Severity:** Low (refactor smell)
- React `PopoutsPanel.movePopout` (42–52) writes the `down` swap differently from `ElementsPanel.moveElement`; net result is equivalent. Normalize for clarity.

---

## Data / State / Side Effect Differences

### S-1. Persistence depends on a fragile mix of array-replacement + manual `saveState()`
- **Severity:** High
- **app.js:** `saveState` is invoked inside `updateCanvas()` on every render — *everything* persists, always (selectedIndex, outputDevice, customWidth/Height, currentLanguage, projectLanguages, defaults).
- **React:** Auto-save effect deps are `[screenshots, outputDevice, currentLanguage, isLoading]` (App.tsx 42–51). Store mutators (`setBackground`/`setScreenshotSetting`/`setTextSetting`/`setCustomDimensions`/`setCurrentLanguage`/`setOutputDevice`/`selectScreenshot`/…) do **not** call `saveState` themselves.
  - Persisted (array replaced or in deps): all per-screenshot bg/screenshot/text/element/popout edits, `outputDevice`, `currentLanguage`.
  - **Not in deps:** `customWidth`, `customHeight`, `projectLanguages`, `selectedIndex`, `defaults`. Changing only these doesn't trigger auto-save; they persist only when a component happens to call `saveState()` manually (LeftSidebar does for custom dims; `setCurrentScreenshotAsDefault` callsite does; others don't).
- **Why:** `projectLanguages` edits and `defaults` changes can be lost; `selectedIndex` persists only opportunistically.
- **Recommended fix:** Add `customWidth/customHeight/projectLanguages/selectedIndex/defaults` to the auto-save deps, or (cleaner) call a debounced `saveState()` at the end of every mutator — restoring the original "every change persists" guarantee.

### S-2. Init/switch flow: default background image not restored; stray `id` leaks into state
- **Severity:** Medium
- **app.js:** `loadState` (1943–1962) assigns each field with fallbacks (`customWidth || 1320`, etc.) and `restoreBackgroundSettings(defaults.background)`.
- **React:** App.tsx init (22–39) does `resetState()` then `setState(savedState)` (shallow merge). The saved record includes an `id` (from `saveProjectState`) that leaks into `AppState`; `defaults.background.image` is never rebuilt (deserialize handles per-screenshot only); no per-field fallbacks. Project-switch logic is duplicated inline in `LeftSidebar` (425–433) rather than centralized.
- **Recommended fix:** Strip `id`, deserialize `defaults.background` image, apply fallbacks; centralize switch logic in the store.

### S-3. Legacy single-image `src` field not written
- **Severity:** Medium (forward/back compat with original app)
- **app.js:** `saveState` writes `src: s.image?.src || ''` per screenshot (1661).
- **React:** `serializeScreenshots` writes `imageSrc` only. A React-saved project read by the original (no `src`, no `localizedImages`) would be treated as blank.
- **Recommended fix:** Also write `src`; on load fall back to `s.src` when `imageSrc` is absent.

### S-4. `activeTab` in state but never persisted/reset; localStorage round-trip instead
- **Severity:** Low
- React adds `AppState.activeTab` but `saveState`/`resetState` omit it; `RightSidebar` persists it via `localStorage` separately. Harmless inconsistency.
- **Recommended fix:** Either drop it from `AppState` (keep component-local) or include it in save/reset.

### S-5. IndexedDB schema/version — confirmed at parity (no action)
- DB `AppStoreScreenshotGenerator` v2, deletes legacy `state` store, creates `projects` (keyPath `id`) + `meta` (keyPath `key`); meta keys `projects`/`currentProject`. Matches the original. The core per-screenshot serialize/deserialize of primary + localized + background images is faithful.

---

## File-by-File Findings

**`src/canvas/renderer.ts`** — Overlay applied to gradient/solid (B-render-1, Critical); laurel/star frames skipped (B-render-2); element frame uses box width not text width (B-render-3); export noise 5× too weak (B-render-4); `drawText` ignores language arg (C-2, Critical); `getEffectiveLayout`/layout-lang fallbacks slightly diverge (low). Screenshot transform math, popout rendering, and core text layout are otherwise faithful 1:1.

**`src/hooks/useCanvas.ts`** — 3D `behind-screenshot` layer omitted (B-render-5); 3D never composited into export (drives C-1); local `getScreenshotImage` is a shortened copy (B-lang-2).

**`src/hooks/useThreeJS.ts`** — no frame-color application (C-4, Critical); `renderToCanvasInternal` can't render arbitrary screenshots / no model cache (C-3, Critical); double `baseModelScale` (B-3d-1); spurious `positionOffsetFactor−1` offset (B-3d-2); no Alt-drag move (B-3d-3); rotation clamp mismatch (B-3d-4); procedural iPad missing camera (B-3d-6). Lighting/camera/renderer/encoding and `createDeviceScreenImage` are faithful.

**`src/components/Layout/CanvasArea.tsx`** — no element drag (M-5, Critical); no sliding animation (I-1); 3D side previews are 2D-only (I-3); drag bound to hidden container, no element-drag guard (B-3d-5).

**`src/components/Layout/LeftSidebar.tsx`** — exports are 2D-only (C-1) + wrong per-language text (C-2) + dead progress modal (B-misc-1) + naming divergence + native alert / silent delete (B-misc-2); added global keyboard shortcuts (I-2); duplicate-upload silent overwrite + weak matching (B-lang-1); inline detection regex gaps (B-lang-3); output-size flat select (D-16); custom dims max 10000 (D-10); no project backup buttons (M-3); no Magical Titles / Translate All buttons (M-1/M-2).

**`src/components/Controls/DevicePanel.tsx`** — slider ranges (D-1..D-5); position presets diverge (B-render-6); FRAME_COLORS hex drift (D-13); frame-color does nothing without C-4; Alt+drag tip is false (B-3d-3).

**`src/components/Controls/BackgroundPanel.tsx`** — 28→12 presets renamed (D-11); draggable stop editor lost (D-12); image-fit `fill` vs `stretch` (D-14); auto-span hardcoded dims (I-6); span toggle non-propagating (I-7).

**`src/components/Controls/TextPanel.tsx`** — text size/offset/line-height ranges (D-6..D-9); number-input → slider (D-6/D-7); "Center" position added (D-15); per-language selectors otherwise OK.

**`src/components/Controls/ElementsPanel.tsx`** — frame `<select>` options wrong (B-render-2); icon images via unpkg blob URLs, not persisted (B-state-1); icon shadow X/Y missing (M-12); no element translate button (M-8); emoji name not carried (I-4).

**`src/components/Controls/PopoutsPanel.tsx`** — crop drag handlers missing (M-6); crop layout model differs (I-8); no list thumbnail (M-11); `movePopout` down-swap inconsistency (I-9).

**`src/components/Modals/AllModals.tsx`** — emoji search broken (D-19); icon picker tiny/flat/online (D-20); `TranslateModal` per-field + N× calls + weak prompt + dead `element` case (B-lang-5 / M-8); `ScreenshotTranslationsModal` minor (en lock, full-res thumb).

**`src/components/Modals/Modals.tsx`** — Google models missing two Gemini 3 previews (B-misc-3); Languages modal `currentLanguage`/`defaults.text` cleanup gaps (B-lang-4); `auto` theme forces dark (B-misc-4); settings persistence otherwise at parity.

**`src/stores/appStore.ts`** — mutators don't self-persist (S-1); `duplicateScreenshot` loses images + naming (B-state-2); `defaults` lacks elements/popouts (M-10).

**`src/stores/projectStore.ts`** — background save can silently throw + `overrides` dropped (B-state-3); `updateScreenshotCount` never called (B-state-4); delete doesn't reload new current (B-state-5); no migration / `formatVersion` (M-4); legacy `src` not written (S-3); icon image not reconstructed (B-state-1).

**`src/App.tsx`** — auto-save dep gaps (S-1); init merges stray `id`, no default-bg-image restore, no fallbacks (S-2).

**`src/styles.css`** — duplicate `#threejs-container` rule clobbers overlay (B-css-1). Otherwise a faithful superset; light theme, Tauri rules, carousel/slide classes, and utility classes are all present (the only genuinely undefined classes — `.lang-btn`, `.language-option`, `.add-blank-btn`, `.screenshot-delete` — are cosmetically harmless because elements are inline-styled or inherit a sibling base class).

**Missing modules entirely:** `magical-titles.js` (M-1), project backup (M-3), migration layer (M-4), Tauri import (M-7), bundled `lucide-icons.js` icon/emoji data (D-19/D-20).

---

## Recommended Fix Order

**Phase 1 — Output correctness (must fix; the tool produces wrong files today)**
1. C-2 — `drawText` honor the language arg (multi-language export shows correct text). *Small, high impact.*
2. C-1 + C-3 — composite 3D into all export paths via a shared render function + per-screenshot model/texture switching.
3. B-render-1 — remove the gradient/solid overlay.
4. B-render-4 — restore the export noise strength.
5. D-1..D-10, B-render-6 — restore original slider ranges + position-preset values (a shared `<Slider>` wrapper).

**Phase 2 — 3D fidelity**
6. C-4 + D-13 — apply frame color to the model; reconcile swatch hexes.
7. B-3d-1 / B-3d-2 — fix double scale + spurious offset.
8. B-3d-6 — iPad camera mesh/material.
9. I-3 — 3D side previews; B-3d-3/B-3d-4/B-3d-5 — Alt-drag, clamps, hit target + guard.

**Phase 3 — Persistence & data safety**
10. S-1 — make every mutation persist (deps or per-mutator save).
11. B-state-1 — reconstruct icon images on load.
12. B-state-3 — always normalize background before save (stop silent save failures).
13. B-state-2 — fix `duplicateScreenshot` image loss + naming.
14. B-state-4 / B-state-5 — screenshot counts; reload-after-delete.
15. M-4 + S-3 — migration layer + legacy `src` (only if sharing data with the original app matters).

**Phase 4 — Missing features**
16. M-5 — element drag + snap guides; M-6 — crop drag.
17. M-1 — Magical Titles; M-2/B-lang-5 — Translate All + restored AI translate scope/prompt; M-8 — element translation.
18. B-render-2 + D-19/D-20 — laurel/star frames, emoji search, full icon set (bundle `lucide-icons.js`).
19. M-3 — project backup import/export; M-9 — slider reset buttons; M-12 — icon shadow X/Y.

**Phase 5 — UI polish / lower-risk parity**
20. B-misc-1 (export progress), B-misc-2 (alerts/confirm), B-misc-3 (Gemini 3), B-misc-4 (auto theme), B-css-1 (duplicate CSS rule), B-lang-1/B-lang-2/B-lang-3/B-lang-4, D-11..D-18, I-1/I-2/I-6/I-7/I-8, S-2.

---

## Detailed Checklist

Every item below must be addressed for the refactor to be considered 1:1 complete. (✔ = verified already at parity; no action.)

### Export & output correctness
- [x] `drawText` renders the language passed by the export path (C-2)
- [x] 3D screenshots composite the device into `exportCurrent`/`exportAll`/`exportAllLanguages` (C-1)
- [x] 3D renderer can render an arbitrary screenshot (texture/device/frame-color swap + model cache) (C-3)
- [x] Export filenames/ZIP names match original (`screenshot-N.png`, `screenshots_<device>_<lang>.zip`, `<lang>/screenshot-N.png`) (B-misc-1 sub-item)
- [x] Export progress modal is driven with live percent; loops yield (B-misc-1)
- [x] Background overlay no longer applied to gradient/solid (B-render-1)
- [x] Export/side-preview noise uses the `×255` strength (B-render-4)

### Rendering fidelity
- [x] Laurel + star + badge element frames implemented; frame `<select>` uses the 7 original ids (B-render-2)
- [x] Element frame sized to measured text width (B-render-3)
- [x] `behind-screenshot` elements drawn in 3D mode (B-render-5)
- [x] Position presets restored to original 8 with original values (centered y=50) (B-render-6)
- [x] Sliding carousel animation + anti-flicker pre-render (I-1)

### 3D
- [x] Frame/body color applied to the model; FRAME_COLORS hexes reconciled (C-4, D-13)
- [x] Pivot scale = `ss.scale/100` (no double `baseModelScale`) (B-3d-1)
- [x] `basePositionOffset.y = 0` (B-3d-2)
- [x] iPad camera mesh + `camera` material restored (B-3d-6)
- [x] Alt+drag-to-move implemented (B-3d-3)
- [x] Rotation clamps reconciled (drag + slider) (B-3d-4, D-5)
- [x] Drag bound to visible canvas + `element-dragging` guard (B-3d-5)
- [x] 3D side previews render the device (I-3)

### Sliders / controls (ranges & defaults)
- [x] Scale 30–100 (D-1)
- [x] Vertical position −80..180 (D-2)
- [x] Horizontal position −80..180 (D-3)
- [x] 2D rotation ±45 (D-4)
- [x] 3D rotation X/Y/Z ±45 (D-5)
- [x] Headline size 12–300 (number entry) (D-6)
- [x] Subheadline size 12–200 (number entry) (D-7)
- [x] Text offset-Y 0–100 (D-8)
- [x] Line height 80–250 (D-9)
- [x] Custom export dims max 4000 (D-10)
- [x] Slider reset buttons on every range (M-9)
- [x] Collapsible sections decoupled from enable toggles (D-17) — React toggle rows only toggle enabled state; no section-collapse handler is bound to them.
- [x] ✔ corner radius / shadow / frame / subheadline opacity / gradient angle / blur ranges

### Background / Text panels
- [x] Committed gradient presets restored with exact gradients (25 swatches in `HEAD:index.html`) (D-11)
- [x] Draggable gradient stop editor (D-12)
- [x] Image-fit value `stretch` aligned with renderer + persistence (D-14)
- [x] `isWideBackgroundImage` uses real output dimensions (I-6)
- [x] Image-span toggle propagates/clears across spanned screenshots (I-7)
- [x] Text "Center" position removed (or fully supported end-to-end) (D-15)

### Elements / Popouts
- [x] Interactive element drag + snap guides on canvas (M-5)
- [x] Interactive crop-rectangle drag with handles (M-6)
- [x] Crop preview draw + drag use the same layout model (I-8)
- [x] Icon picker: bundled full Lucide set + Popular/All categories + name search, offline-capable fallback/cache (D-20)
- [x] Emoji picker: name/keyword search + categories from `EMOJI_DATA`; emoji name carried into element (D-19, I-4)
- [x] Element text translate button + `TranslateModal` element path (M-8)
- [x] Icon shadow X/Y sliders (M-12)
- [x] Popout list thumbnails + icon-thumb theme filter (M-11)
- [x] `movePopout` down-swap normalized (I-9)

### Localization / AI
- [x] Magical Titles feature (button + modal + vision generation across all screenshots) (M-1)
- [x] "Translate All" bulk path + confirm/cost dialog (M-2, B-lang-5)
- [x] AI translate: single-prompt JSON, marketing/length prompt, error mapping (B-lang-5)
- [x] Duplicate-upload Replace/Create/Skip dialog + `findScreenshotByBaseFilename` matching (B-lang-1)
- [x] Shared full `getScreenshotImage` fallback chain everywhere (B-lang-2)
- [x] Filename language-detection ported util (underscore/region variants) (B-lang-3)
- [x] Languages modal reassigns `currentLanguage` + cleans `defaults.text` on removal (B-lang-4)
- [x] Google model list adds the two Gemini 3 preview models (B-misc-3)

### Persistence / state
- [x] Every state mutation persists (deps or per-mutator save) (S-1)
- [x] Icon element images reconstructed on load (B-state-1)
- [x] Background always normalized before save (B-state-3)
- [x] `duplicateScreenshot` preserves images + extension-aware "(Copy)" (B-state-2)
- [x] `updateScreenshotCount` called on save (B-state-4)
- [x] Delete project loads the new current project (B-state-5)
- [x] Migration layer + `formatVersion` for original-app data (M-4)
- [x] Legacy `src` written + read (S-3)
- [x] Init strips stray `id`, restores default-bg image, applies fallbacks; switch logic centralized (S-2)
- [x] `defaults.elements`/`defaults.popouts` modeled + cloned into new screenshots (M-10)
- [x] `activeTab` handling made consistent (S-4)
- [x] Project backup export/import (.json) (M-3)
- [x] Tauri desktop import (if desktop build ships) (M-7)
- [x] ✔ IndexedDB schema/version (S-5)

### Misc UI / behavior
- [x] Themed `AppAlert`/`AppConfirm`; gate project delete behind confirm; remove native `alert()` (B-misc-2)
- [x] `auto` theme follows OS (remove forced dark) (B-misc-4)
- [x] Remove duplicate `#threejs-container` CSS rule (B-css-1)
- [x] Reconcile/remove the added global keyboard shortcuts (esp. destructive Delete) (I-2)
- [x] Output-size grouped dropdown (optional) (D-16)
- [x] ✔ light theme, Tauri styling, carousel/slide CSS, base font, settings key persistence/validation
