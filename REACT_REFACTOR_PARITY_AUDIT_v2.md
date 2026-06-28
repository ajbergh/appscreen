# React Refactor Parity Audit

> **Audit date:** 2026-06-28
> **Source of truth:** `app.js` (8649 lines) + `three-renderer.js`, `language-utils.js`, `magical-titles.js`, `llm.js`, and the original `index.html`/`styles.css` (the original `index.html` was recovered from git `45086a5^:index.html`).
> **Subject under audit:** the React + TypeScript refactor under `src/`.
> **Method:** Ten parallel area-focused passes, each diffing legacy source-of-truth functions against the corresponding React modules. The React version was *not* assumed correct.

---

## Summary

The refactor is broadly faithful for the core single-screenshot **render pipeline** (orchestration order, device dimensions, gradient/image/noise math, 2D transform/shadow/perspective math, popout crop math, ZIP/PNG naming, preview scaling, and Three.js device configs all match). However, there is a long tail of parity gaps, and several are **data-loss or output-correctness bugs**, not cosmetics.

The biggest risks, in order:

1. **Style transfer is broken and destructive.** It copies in the wrong direction, overwrites every target's localized headline/subheadline text, and silently drops `elements`. "Apply to all" runs with no confirmation. (Critical — data loss.)
2. **Background images vanish on edit.** `normalizeBackgroundSettings` hard-codes `image: null`, so any background control touched after upload wipes the image from the canvas while the thumbnail still shows it. The "span across screenshots" feature is non-functional as a result. (Critical.)
3. **3D screenshots export as flat 2D in batch/all-language exports** because the Three.js engine is only initialized for the *selected* screenshot. (Critical.)
4. **Legacy project migration is entirely missing** (old pre-per-screenshot format detection, migration prompt, conversion). Old projects load with blank/wrong styling. (High.)
5. **Language model is fragmented:** adding a project language doesn't cascade onto screenshots/defaults, switching global language doesn't propagate per-field language pointers, and the Languages modal is a different interaction model. (Critical/High.)
6. **Canvas element selection isn't shared with the panel**, so click-to-edit on the canvas is broken; drag-and-drop file import is gone entirely.
7. Per-language text **layout storage diverges** (sizes written to the wrong language key; a non-legacy "Layout for" selector added; create-on-read seeding missing), changing both stored data and rendered output for multi-language projects.

There are also many High/Medium UX regressions (no slide animation, missing Replace Screenshot, missing show-key/help-links in Settings, reworked About modal, abbreviated AI prompts, missing progress/alert feedback) and a large set of Low cosmetic deltas.

A note on **text language resolution**: React renders headline/subheadline by `currentLanguage`; legacy renders strictly by `currentHeadlineLang`/`currentSubheadlineLang`. This is a deliberate-looking design change that affects both preview and export output across multiple areas. It must be explicitly decided and documented, not left implicit.

---

## Implementation Progress

> **Started:** 2026-06-28
> **Status:** Implementation complete; final production build validation is blocked by the current sandbox/escalation limit. This section is the live implementation log for the v2 audit. Checklist items below remain unchecked until code has been changed and validation has been run or an explicit accepted-deviation decision has been recorded.

### Current Pass
- [x] Phase 1 critical data-loss and output-correctness fixes.
- [x] Phase 2 language/persistence correctness fixes.
- [x] Phase 3 missing primary workflow fixes.
- [x] Phase 4 medium UI/settings parity fixes.
- [x] Phase 5 low-risk parity decisions and accepted-deviation documentation.
- [ ] Final validation (`npm run build` plus targeted rendered checks).

### Completed In This Pass
- C1/C2/C3: Style transfer now preserves target headline/subheadline text, transfers elements with fresh ids, and uses the legacy "copy style from clicked source into selected destination" direction.
- C4/C5: Background normalization preserves live `HTMLImageElement` references, and image-span enable/disable propagation works from the selected image.
- C7: `selectedElementId` is now shared through Zustand so canvas element drag/click selects the same element shown in the Elements panel.
- C8/C9: Adding languages now cascades into screenshot/default text maps, and switching global language updates per-field language pointers and saves.
- C10/M10: Per-language layout writes now target the legacy-compatible language buckets, the React-only "Layout for" selector was removed, and normalization seeds language layout records by copying existing settings.
- C6: Batch/all-language export now waits for a ready Three.js adapter, and the canvas workspace initializes Three.js whenever any screenshot in the project uses 3D.
- M3: "Apply style to all" now asks for confirmation and preserves text copy/translations.
- M1/M2: Sidebar drag-and-drop image import and per-screenshot "Replace Screenshot..." are implemented.
- B2/B3/B4/B5/W3: New screenshots deep-clone default text, image uploads get legacy iPhone/iPad labels, base-filename matching scans localized image names, imports process sequentially, and undetected languages default to English.
- M9/B22/B23/W5/W6/D11: Project load fallbacks now apply after stored data, defaults backfill `elements`/`popouts`, backup import reloads with user-visible error feedback, project create/switch/delete actions save/reset/load atomically, unload/visibility flush starts pending saves, and screenshot-count metadata skips unchanged writes.
- User-reported fixes: the Text-tab `FontPicker` dropdown is portaled outside the clipped right sidebar so System/Popular/All font options render, and left-panel screenshot rows reserve a stable action column so long filenames do not collide with hover controls.
- C11/B1/B6/B11/B13/B14/B15/B16/B17/B18/B21/B26/B28/M14: Old-format project records now migrate into per-screenshot settings with a conversion prompt, add/reorder selection follows legacy behavior, Lucide colorization leaves fills alone, popout crop math/previews/value formatting/hex inputs match legacy closer, OpenAI text requests include the completion-token cap and error body detail, applying subheadline translations enables subheadlines, gradient stop delete keeps the first two stops locked, CRLF text wraps correctly, and the renderer now uses field-language text pointers with all-language export forcing the export language.
- B8/B9/B10: Canvas hit testing now checks elements by legacy layer priority, popouts receive first hit-test/drag priority and switch to the Popouts tab, and snap guides are drawn after the normal preview repaint through the canvas render bridge.
- M5/B24/B25/D9: Side previews use the shared 3D-capable render path with adjacent cached model preloading, repeated same-device model loads short-circuit, 3D frame colors default to the first device preset, and live 3D screen textures retry refresh after model load on selection/language/image changes.
- M8/U1/U2/U7: Theme now defaults to auto, auto mode removes the manual `data-theme` override, and Settings has provider descriptions/icons, show/hide API key buttons, provider key links, on-open saved-key status, and the legacy "Save Settings" action label.
- W4/U6/U8/U9: The language menu now uses the legacy active class, ordered/full-name rows, and clearer action entries; the Languages modal is rebuilt around current-language rows with a current badge, protected removals, and a separate add-language selector.
- M6/M7/M11/B19/B20/U5: AI translation/title prompts now use language names and fuller JSON contracts, per-field translation uses field language arrays/defaults and "Element Text" labeling, Translate All shows provider/stats/disabled states and applied counts, Magical Titles scans project-language images with conditional field enablement, and the first-screenshot Magical Titles tooltip is restored.
- M4/M12/B12/B27/U3/U4/U10-U20/W1: Slide navigation now uses directional full-width animation with the 3D-ready side-preview render path, transfer mode hides add buttons/disables dragging and empty export buttons, the icon picker uses bundled Lucide lists with lazy/debounced search, Google font loading is shared/awaited/multi-weight, About/modal styling matches legacy closer, export language/progress labels use names/flags with legacy completion timing, thumbnail language flags/checkmarks use explicit localized images, far previews are display-only, and crop/hover/delete/SVG visual details are restored.

### Accepted Decisions / Documented Deviations
- B7: Keep React duplicate behavior that copies elements and popouts with fresh ids. Legacy duplicated only screenshot/text/background/image data, but preserving the full visual screenshot is the safer editor behavior and is documented as an intentional improvement.
- D8: Keep icon elements persisted as baked colorized data URLs plus `iconName`/color/stroke metadata. This differs from legacy's runtime Blob URL reconstruction, but it makes project round-trips and backup/export previews deterministic offline.
- D12: Keep Tauri multi-file import as one save after the loop. The imported data matches legacy output; batching persistence avoids redundant writes and still flushes when the import completes.
- D14: Keep the offscreen 3D side-preview/export render path isolated from the live persistent texture. The selected live 3D preview refreshes its persistent screen texture; offscreen preview/export renders through the cached model path to avoid mutating the live scene.
- D15: Keep React's noise amplitude at the legacy export value (`intensity / 100 * 255`) for both preview and export. This preserves exported output parity even though the old live preview used a softer `* 50` path.
- M13: Keep the native output-size `<select>` with adjacent custom width/height fields as an accepted simplification. Device values and custom dimensions are preserved; the custom two-line dropdown styling is not functionally required.
- M15: Keep the offline-first Google Fonts catalog instead of adding a Google Fonts API key setting. Font loading now matches the legacy caching/stylesheet-await/weight behavior for selected families; live popularity sorting remains intentionally omitted to keep the app usable without network/API setup.
- W2: Keep Escape-to-close for modals and lightweight menus as an intentional React usability improvement. The legacy app had no broader keyboard shortcut contract to preserve here.

### Validation Log
- `npx tsc -b` passed after the first critical cluster, after the text layout storage fix, after the 3D export readiness fix, and after the import/replace workflow fixes.
- `npx tsc -b` passed after the persistence/backup/autosave/font-picker/left-panel visual fixes.
- `npx tsc -b` passed after the migration/text-resolution/reorder/renderer/AI/icon/gradient/popout batch.
- `npx tsc -b` passed after the canvas hit-test/popout-drag/snap-guide batch.
- `npx tsc -b` passed after the 3D model preload/default/texture-refresh batch.
- `npx tsc -b` passed after the settings/theme parity batch.
- `npx tsc -b` passed after the language modal/menu parity batch.
- `npx tsc -b` passed after the AI prompt/translation/Magical Titles tooltip batch.
- `npx tsc -b` passed after the final UI parity/documented-deviation batch (font loader, sidebar thumbnails/export labels, modals, icon/emoji pickers, popout crop cursors, hover affordance, snap-guide style).
- `npm run build` was attempted after all fixes. `tsc -b` completed, but Vite/esbuild failed under sandboxed filesystem access while loading `vite.config.ts` (`Cannot read directory "../../../..": Access is denied`; `Could not resolve ... vite.config.ts`). Rerun with required escalation was rejected by the runtime usage limit, so final production build remains unverified in this environment.

---

## Critical Issues

These break core functionality, cause data loss, or make a primary workflow produce wrong output.

### C1. Style transfer overwrites localized headline/subheadline text (data loss)
- **Severity:** Critical
- **app.js:** `transferStyle` (6774–6779) and `applyStyleToAll` (6833–6838) save the target's `text.headlines`/`subheadlines` and restore them after copying style.
- **React:** `src/stores/appStore.ts` `transferStyle` (517) / `applyStyleToAll` (533) assign `text: normalizeTextSettings(source.text)` wholesale, including `headlines`/`subheadlines`.
- **Original:** Copies text *styling* but keeps each target's own copy/translations.
- **React:** Overwrites every target's headline/subheadline strings with the source's — destroying translations, especially in "apply to all."
- **Why a parity problem:** Silent, project-wide text data loss.
- **Fix:** Capture and restore each target's `headlines`/`subheadlines` around `normalizeTextSettings(source.text)`.

### C2. Style transfer drops `elements`
- **Severity:** Critical
- **app.js:** `transferStyle` (6782–6791), `applyStyleToAll` (6841–6848) copy elements with image reconstruction + fresh ids.
- **React:** `appStore.ts` `transferStyle` (507–521) / `applyStyleToAll` (523–537) copy only `background`, `screenshot`, `text`.
- **Original:** Overlay elements (badges/graphics/icons/text) transfer with the style.
- **React:** Target elements are untouched; elements never transfer.
- **Fix:** Clone `source.elements` with fresh ids and preserved `image` refs in both actions.

### C3. Style transfer copies in the inverted direction
- **Severity:** Critical
- **app.js:** menu sets `transferTarget = index` (6698); click handler calls `transferStyle(index, state.transferTarget)` (6639) — clicked item is the **source**, menu item is the **destination**. Hint: "Select a screenshot to copy style **from**" (6421).
- **React:** `LeftSidebar.tsx` `handleStartTransfer` (637–640) sets `transferSource = menuIndex`; `handleApplyTransfer` (643–650) calls `transferStyle(transferSource, targetIndex)`. Hint: "apply style from #{n}" (760).
- **Original:** Pulls style *into* the menu screenshot from the one you click next.
- **React:** Pushes style *from* the menu screenshot to the one you click — opposite result for identical gestures.
- **Fix:** Flip to `transferStyle(targetIndex, transferSource)` and relabel/hint to "copy style from", or formally document the redesign.

### C4. `normalizeBackgroundSettings` discards the in-memory background image
- **Severity:** Critical
- **app.js:** `normalizeBackgroundSettings` line 118 — `image: bg.image || null` (preserves the loaded `HTMLImageElement`).
- **React:** `src/stores/appStore.ts` line 47 — `image: null` (always).
- **Original:** Normalization is non-destructive to the live image.
- **React:** `setBackground` (366) and `setBackgroundSettings` (409) call the normalizer on every write, so touching *any* background control (Fit, Blur, Overlay, Noise, Span) wipes the image to `null`. The canvas goes blank while the thumbnail (driven by `imageSrc`) still shows the image.
- **Fix:** Use `image: bg.image || null`; only force `image: null` in the dedicated serialize path (legacy's `serializeBackgroundSettings`).

### C5. Background "span across screenshots" toggle is non-functional
- **Severity:** Critical (depends on C4)
- **app.js:** `setBackgroundImageSpan` (686), `applyBackgroundImage` (661) — clone preserving the image, apply the real image element to all screenshots; on disable, clear `imageSpan` for all screenshots sharing the image.
- **React:** `appStore.ts` `setBackground` (372–394) guards `if (toggledSpan && normalized.image)` — but `normalized.image` is always `null` (C4), so the image never propagates; the disable path also differs.
- **Fix:** Fix C4 first, then align span on/off with `applyBackgroundImage`/`setBackgroundImageSpan` (match by image/`imageSrc`).

### C6. 3D screenshots export as flat 2D in batch/all-language exports
- **Severity:** Critical
- **app.js:** `exportAllForLanguage` (8296–8311), `exportAllLanguages` (8368–8384) set `selectedIndex = i` and call `updateCanvas()`; the Three.js engine is a global singleton, so every 3D screenshot renders 3D.
- **React:** `useCanvas.ts` `renderScreenshotToCanvas` (112, 141–144) gates 3D on `threeRenderer?.isReady`; `useThreeJS.initScene` (324–331) registers the global only when mounted, and `CanvasArea.tsx` (82–90) mounts it only when the *selected* screenshot uses 3D.
- **React:** Exporting while a 2D screenshot is selected renders all 3D screenshots as 2D (or blank).
- **Fix:** Force-init/await the Three.js engine for export when any screenshot uses 3D, or use an export-only offscreen renderer independent of the preview mount.

### C7. Canvas element selection is not shared with the Elements panel (click-to-edit broken)
- **Severity:** Critical
- **app.js:** global `selectedElementId` set by both canvas drag (3107) and list click (2569); `drawSnapGuides` reads `getSelectedElement()`.
- **React:** `selectedElementId` is `useState` local to `ElementsPanel` (ElementsPanel.tsx:30); `CanvasArea` cannot set it and only switches tabs (CanvasArea.tsx:286–303).
- **Original:** Clicking/dragging an element on the canvas selects it and shows its properties.
- **React:** Dragging an element on the canvas does not select it in the panel — no/wrong property editor appears.
- **Fix:** Lift `selectedElementId` into the Zustand store so canvas and panel share it.

### C8. Adding a project language does not cascade onto screenshots/defaults
- **Severity:** Critical
- **app.js:** `addProjectLanguage` (4998–5033) pushes the lang into every screenshot's `headlineLanguages`/`subheadlineLanguages`, seeds `headlines[lang]=''`/`subheadlines[lang]=''`, and updates `defaults.text`.
- **React:** `LanguagesModal.handleDone` (Modals.tsx:304–355) and the upload paths set only `projectLanguages`.
- **React:** Per-screenshot language arrays and default text maps drift out of sync; new languages have no seeded text entries.
- **Fix:** Add an `addProjectLanguage` store action doing the full cascade; call it from the modal and both upload paths.

### C9. Switching global language does not propagate per-field language pointers
- **Severity:** Critical
- **app.js:** `switchGlobalLanguage` (4920–4934) sets `currentLanguage`, then sets every screenshot's `currentHeadlineLang`/`currentSubheadlineLang`, syncs UI, renders, saves.
- **React:** `setCurrentLanguage` (appStore.ts:455) only sets `currentLanguage`; no per-screenshot pointer update, no `saveState`.
- **React:** Persisted per-screenshot language pointers diverge from legacy; relies on the renderer keying off `currentLanguage` (itself a deviation, see I-text).
- **Fix:** Implement `switchGlobalLanguage` with the cascade + saveState; use it in the menu and modal.

### C10. Per-language text layout storage written to the wrong language key + non-legacy "Layout for" selector
- **Severity:** Critical
- **app.js:** `headlineSize` → `setTextLanguageValue('headlineSize', v, currentHeadlineLang)`; `subheadlineSize` → keyed to `currentSubheadlineLang`; position/offsetY/lineHeight → `getTextLayoutLanguage(text)` (4693–4756, 6083, 216).
- **React:** `TextPanel.setLangSetting` (70–78) funnels **all** of headlineSize/subheadlineSize/position/offsetY/lineHeight into a single `layoutLang` driven by a new "Layout for" button group (336–356) that does not exist in legacy.
- **React:** `languageSettings` data shape differs from legacy for identical user actions → wrong saved data and rendered output for multi-language projects; introduces UI not in the source of truth.
- **Fix:** Write headlineSize to `currentHeadlineLang`, subheadlineSize to `currentSubheadlineLang`, layout keys to `getTextLayoutLanguage`; remove the standalone selector (or document it).

### C11. Legacy project-format migration is entirely missing
- **Severity:** Critical/High
- **app.js:** `loadState` (1766–1804, 1953–1962) detects old format (`isOldFormat`, `hasScreenshotsWithoutSettings`), builds migrated background/screenshot/text from top-level fields, applies to screenshots lacking own settings, and assigns `state.defaults`. `showMigrationPrompt`/`convertProject` (1983–1997) surface a conversion prompt.
- **React:** `projectStore.ts` `loadProjectState` (379–420) only handles `formatVersion < 2` (3D position). No old-format detection, no migrated defaults, no migration prompt/convert.
- **React:** Projects saved in the old vanilla format load with wrong/blank styling.
- **Fix:** Port `isOldFormat`/`hasScreenshotsWithoutSettings`, migrated-default construction, and the migration prompt/convert flow.

---

## Missing Functionality

Features present in `app.js` but absent from the React refactor.

### M1. Global drag-and-drop file import (High)
- **app.js:** `.sidebar-content` drop zone (3800–3821) → `handleFiles(e.dataTransfer.files)` with `drop-active` highlight.
- **React:** No drop handlers anywhere (LeftSidebar/App). Import only via the hidden file input.
- **Fix:** Add `onDragOver/onDragLeave/onDrop` to the sidebar content, route dropped images through the upload logic.

### M2. "Replace Screenshot…" per-item action (High)
- **app.js:** `replaceScreenshot` (6863–6916); menu item (6459–6466) — replaces the current-language image, keeps settings.
- **React:** Context menu (LeftSidebar 819–842) has no Replace item; no `replaceScreenshot`.
- **Fix:** Add the menu item + file picker that updates `localizedImages[currentLanguage]` and legacy `image`, then saves.

### M3. Apply-style-to-all confirmation modal (High)
- **app.js:** menu → `showApplyStyleModal` (6709, 6808); copy runs only after confirm (`apply-style-confirm` → `applyStyleToAll`).
- **React:** `handleApplyStyleToAll` (658–662) applies instantly, no confirm.
- **Fix:** Add a confirm dialog before `applyStyleToAll` (especially given C1/C2).

### M4. Slide / carousel transition between screenshots (High)
- **app.js:** `slideToScreenshot` (7122–7219) — directional full-width (`dims.width*previewScale + 10`) 300ms strip translate, pre-renders adjacent previews to temp canvases, awaits 3D model loads, flicker suppression via `skipSidePreviewRender`.
- **React:** `CanvasArea.tsx` (58–79) only a fixed `translateX(±36px)` nudge after the index already changed; no direction, pre-render, or model gating.
- **Fix:** Reimplement `slideToScreenshot` semantics.

### M5. 3D rendering & model preload in side previews (High)
- **app.js:** `updateSidePreviews` (7041–7057) shows 3D and preloads adjacent 3D models; side previews render 3D (`renderThreeJSForScreenshot`).
- **React:** `renderSidePreview` falls to 2D for non-selected 3D (engine not ready); no adjacent preload.
- **Fix:** Init the engine when *any* screenshot is 3D; preload adjacent models.

### M6. Magical Titles AI feature regressions (High)
- **app.js (`magical-titles.js`):** full analysis prompt with examples + length rules + JSON schema, target language by **name** (`languageNames[sourceLang]`); image fallback iterates `projectLanguages` (`getScreenshotDataUrl` 64–77); enables headline/subheadline conditionally; preserves `currentHeadlineLang`; pre-flight "add screenshots" alert; provider name display; full-screen progress overlay; success/error/SyntaxError alerts; first-upload onboarding tooltip (11–56).
- **React:** `AllModals.tsx` MagicalTitlesModal (416–501) — abbreviated prompt; target language by **code**; image fallback `en`→`screenshot.image` (no project-language scan); unconditionally enables both + forces `currentHeadlineLang/SubLang = sourceLang`; no overlay; minimal error mapping; no tooltip.
- **Fix:** Restore the full prompt + language-name resolution, the project-language image scan, conditional enable flags, progress/alerts, and the tooltip.

### M7. Translate-All UX & prompt regressions (High)
- **app.js:** `showTranslateConfirmDialog` (5527–5638), `translateAllText` (5641) — provider name in stats, disable-when-zero, `<2 languages`/no-key/no-source alerts; screenshot-grouped context-rich prompt with numeric-index JSON; progress overlay + success count alert + `Failed to fetch` branch.
- **React:** `TranslateAllModal` (AllModals.tsx:268–360) — no provider line, no disable-when-zero, reduced inline pre-checks; flat per-line prompt + different JSON keys; no overlay, no success/error alerts, no applied count.
- **Fix:** Restore the dialog stats/guards, grouped prompt + JSON contract, progress/alerts, and applied count.

### M8. Settings: show/hide-key buttons, "Get your API key" links, on-open key status, section icons/descriptions (High)
- **index.html/app.js:** each provider section has an eye toggle (`.settings-show-key`, 4221–4229), an external "Get your API key from …" link, section icon/description, and a saved-status line populated on open (5990–5999) and save (6051–6061).
- **React:** `Modals.tsx` Settings (107–239) — none of these; only the active provider section is shown; status only after save.
- **Fix:** Add eye toggle, per-provider help links, icons/descriptions, and on-open status.

### M9. Backup import does not reload / fully reconcile (High)
- **app.js:** import handler (4010–4011) calls `location.reload()`, re-running full `init()` (meta + state + selector).
- **React:** `handleImportProjectBackup` (LeftSidebar 555–577) re-hydrates in place; can desync project list/selector/state; swallows errors to console (no alert); export has no try/catch.
- **Fix:** `window.location.reload()` after a successful import; add user-visible error feedback.

### M10. `getTextLanguageSettings` create-on-read seeding missing (High)
- **app.js:** `getTextLanguageSettings` (223–237) lazily creates `languageSettings[lang]` by copying the source language; `normalizeTextSettings` (252) seeds all languages in `headlineLanguages ∪ subheadlineLanguages`.
- **React:** `appStore.normalizeTextSettings` (147–160) only ensures `languageSettings` is `{}`; `renderer.getEffectiveLayout` (398–419) falls back to `en`/globals with no copy-from-source seeding.
- **React:** New per-language layouts reset to defaults instead of inheriting the previous language's sizes/positions.
- **Fix:** Port create-on-read + source-copy seeding into the store and reuse in panel + renderer.

### M11. Onboarding/Magical-Titles tooltip & first-screenshot hint (Low–Medium)
- **app.js:** `createNewScreenshot` (6396–6397) schedules `showMagicalTitlesTooltip()` after the first screenshot; CSS `.feature-tooltip` exists in `src/styles.css` but nothing renders it.
- **React:** Never shown.
- **Fix:** Port the one-time, API-key-gated, 8s auto-hide, localStorage-dismissed tooltip.

### M12. Right sidebar / export disabled-state and transfer-mode UI hiding (Low)
- **app.js:** `updateScreenshotList` toggles `.sidebar-right.disabled` and disables export buttons when empty (6408–6414); hides add buttons (6742–6746) and disables drag (6437–6440) during transfer mode.
- **React:** Export buttons always enabled (guarded as no-ops); add buttons always visible; items always draggable.
- **Fix:** Add disabled/dimmed states and transfer-mode gating.

### M13. Custom styled output-size dropdown replaced by native `<select>` (Medium)
- **index.html/app.js:** `.output-size-dropdown` with two-line device rows, group dividers, inline custom W×H (200–280; 4238–4289).
- **React:** native `<select>` + `<optgroup>` with custom inputs below (LeftSidebar 862–903).
- **Fix:** Reimplement the custom dropdown, or document the simplification.

### M14. Shadow/border hex text inputs in Popouts (Low)
- **app.js:** `updatePopoutProperties` (3363–3381) + listeners maintain paired hex text inputs with `/^#[0-9a-fA-F]{6}$/` validation.
- **React:** `PopoutsPanel.tsx` (446–485) has only the color swatch.
- **Fix:** Add paired hex inputs with validation.

### M15. Google Fonts "All" tab API fetch + API key setting (Medium)
- **app.js:** `fetchAllGoogleFonts` (860–1103) fetches the live popularity-sorted list using `settings.googleFontsApiKey`, falling back to the curated list.
- **React:** `FontPicker.getFonts` (108–128) only ever uses the local alphabetical fallback; no API, no `googleFontsApiKey` setting.
- **Note:** CLAUDE.md states offline fallback is intentional — but the missing setting and popularity ordering should be recorded/decided.

---

## Incorrect or Broken Functionality

Features that exist in React but behave differently or incorrectly.

### B1. `addScreenshot` always jumps selection to the new screenshot (Medium)
- **app.js:** `createNewScreenshot` (6394–6398) sets `selectedIndex = 0` only when it's the first screenshot; otherwise selection is unchanged.
- **React:** `appStore.addScreenshot` (298–302) always sets `selectedIndex` to the new index.
- **Fix:** Only select when the list was empty.

### B2. New screenshots blank out text maps instead of inheriting defaults (High)
- **app.js:** `createNewScreenshot` (6373, 6386) `text: JSON.parse(JSON.stringify(textDefaults))` (keeps default copy after "Set as Default Style").
- **React:** `createDefaultScreenshot` (LeftSidebar 359) forces `headlines:{en:''}, subheadlines:{en:''}`, dropping default text and non-`en` keys.
- **Fix:** Deep-clone `defaults.text`.

### B3. New-screenshot device type not detected from aspect ratio (High)
- **app.js:** `processImageFile` (6302–6306) `ratio>0.6 ? 'iPad' : 'iPhone'`.
- **React:** `createDefaultScreenshot` (356) stamps `deviceType: outputDevice` (full id like `iphone-6.9`).
- **Fix:** Compute device type from image ratio.

### B4. Duplicate-filename matching uses extra fields → false matches (High)
- **app.js:** `findScreenshotByBaseFilename` (language-utils.js 40–57) matches only `localizedImages[*].name`.
- **React:** LeftSidebar (128–139) also matches `screenshot.name`.
- **Fix:** Drop the `screenshot.name` branch.

### B5. Multi-file browser import not sequential (Medium)
- **app.js:** `processFilesSequentially` (6289–6293) awaits each file in order.
- **React:** `handleFileUpload` (234) fires all `FileReader`s concurrently → racing duplicate dialogs and duplicate screenshots for localized sets.
- **Fix:** Process files in an awaited sequential loop.

### B6. Drag-reorder selection tracking & drop precision lossy (Medium)
- **app.js:** drop handler (6593–6623) uses cursor midpoint + direction and a 3-branch `selectedIndex` adjustment; `dragover` (6554–6583) supports `drag-insert-before`.
- **React:** `handleDrop` (602–611) → `reorderScreenshots` sets `selectedIndex: toIndex`; only `drag-insert-after` shown.
- **Fix:** Port midpoint/direction logic, before/after indicators, and selection adjustment.

### B7. `duplicateScreenshot` copies elements/popouts (legacy drops them) (Medium)
- **app.js:** `duplicateScreenshot` (2200–2250) omits `elements`/`popouts`.
- **React:** `appStore.duplicateScreenshot` (323–345) clones both.
- **Note:** React behavior is arguably better; decide and document, or match legacy.

### B8. Element hit-test ignores layer ordering (Medium)
- **app.js:** `hitTestElements` (2984–3016) iterates `['above-text','above-screenshot','behind-screenshot']`, reversed within each.
- **React:** `hitTestElement` (CanvasArea 261–280) iterates the flat array last→first, ignoring `layer`.
- **Fix:** Replicate layer-priority iteration.

### B9. Canvas drag has no popout hit-test priority (High)
- **app.js:** mousedown (3060–3119) hit-tests popouts first (`hitTestPopouts` 2955), then elements; popout drag switches to Popouts tab.
- **React:** `handleElementPointerDown` (CanvasArea 261–303) only hit-tests elements; no popout dragging on canvas.
- **Fix:** Add popout hit-test priority (or document popout canvas-drag as unsupported).

### B10. Snap guides erased by store-driven re-render (Medium)
- **app.js:** `applyDragMove` (3018–3049) calls `updateCanvas()` then `drawSnapGuides()` as an overlay pass.
- **React:** `handleElementPointerMove` (CanvasArea 322–346) draws guides synchronously before the async `useCanvas` repaint wipes them → flicker/invisible.
- **Fix:** Draw guides as part of the render pipeline.

### B11. Icon colorization also recolors `fill` (Medium)
- **app.js:** `colorizeLucideSVG` (464–468) replaces only `stroke="currentColor"`/`stroke-width`, never `fill`.
- **React:** `getIconDataUrl` (ElementsPanel 61–64) also replaces `fill="currentColor"`.
- **Fix:** Remove the fill replacement.

### B12. Icon picker eager-fetches all icons as `<img>` with `filter:invert(1)` (Medium)
- **app.js:** `renderIconGrid`/`loadIconPreview` (8607–8643) lazy-load via IntersectionObserver, inline colorized SVG, 200ms debounced search over `LUCIDE_ALL`.
- **React:** `IconPicker` (AllModals 686–756) eager `<img src=unpkg…>` for the whole list, `invert(1)` approximation, hard-coded 90-icon fallback, no debounce.
- **Fix:** Use bundled `LUCIDE_POPULAR/ALL`, lazy loading, debounced search, consistent colorize.

### B13. Crop resize-from-left/top clamp math differs (Medium)
- **app.js:** `moveCropDrag` (3601–3616) pins the opposite edge at the 5% floor.
- **React:** `clampCrop` (PopoutsPanel 109–120) floors width before compensating `cropX`, landing a different rectangle near the minimum.
- **Fix:** Port the legacy edge-pinning logic.

### B14. Popout property values shown unformatted after drag (Medium)
- **app.js:** `updatePopoutProperties` renders via `formatValue` (1-decimal).
- **React:** PopoutsPanel (306–330) renders raw floats; drag writes unrounded values.
- **Fix:** Round displayed values to 1 decimal.

### B15. Crop preview / thumbnails / Add-Popout use hardcoded `'en'` image (High)
- **app.js:** `updateCropPreview`/`updatePopoutsList`/hit-tests use `getScreenshotImage(screenshot)` (current-language resolution).
- **React:** `PopoutsPanel.tsx` (54–56) uses `localizedImages['en']` only; for non-English-first projects the preview is blank and Add-Popout can be wrongly disabled while the canvas crops a different image.
- **Fix:** Use `getScreenshotImage(currentScreenshot, currentLanguage, projectLanguages)`; add `currentLanguage` to effect deps.

### B16. OpenAI text translation omits `max_completion_tokens` (Medium)
- **app.js:** `translateWithOpenAI` (5900–5905) sends `max_completion_tokens: 16384`.
- **React:** `callTextProvider` OpenAI branch (AllModals 42–50) omits it.
- **React:** Large Translate-All responses may be truncated → JSON parse failures.
- **Fix:** Add `max_completion_tokens: 16384`.

### B17. OpenAI error handling drops body/status detail (Medium)
- **app.js:** `translateWithOpenAI` (5907–5917) parses the error body and includes it in the thrown message.
- **React:** throws `AI_UNAVAILABLE` (401/403) or bare `API request failed: ${status}`.
- **Fix:** Parse and include the error body.

### B18. Per-field "Apply Translations" doesn't enable subheadline / sync inputs (Medium)
- **app.js:** `applyTranslations` (5263–5301) sets `subheadlineEnabled = true`, updates the visible input, and syncs element text.
- **React:** `TranslateModal.handleApply` (AllModals 133–158) writes maps but never sets `subheadlineEnabled`.
- **Fix:** Set `subheadlineEnabled = true` for the subheadline path.

### B19. Per-field translate modal uses wrong language set & default source (Medium)
- **app.js:** `openTranslateModal` (5192–5245) uses `headlineLanguages`/`subheadlineLanguages` for those targets, default source = first language, target label "Element Text".
- **React:** `TranslateModal` (AllModals 98–262) always uses `projectLanguages`, default source = `currentLanguage`, title "Translate Element".
- **Fix:** Use per-field language arrays, default source to first language, fix labels.

### B20. AI translate prompts use language codes, not names; abbreviated (Medium)
- **app.js:** `aiTranslateAll` (5366–5384) / `translateAllText` (5732–5780) prompts use language **names**, full constraints, example JSON.
- **React:** AllModals (188–196, 304–312) use codes and shorter instructions.
- **Fix:** Port full prompts using a `languageNames` map.

### B21. Gradient stop delete affordance differs (Medium)
- **app.js:** `updateGradientStopsUI` (6930) shows delete only for `index > 1` (first two stops locked).
- **React:** `BackgroundPanel.tsx` (204) shows delete on every stop when `stops.length > 2`, allowing deletion of the first stop.
- **Fix:** Gate per-row by `i > 1`.

### B22. `loadProjectState` spread order defeats scalar fallbacks (Medium)
- **app.js:** `loadState` (1943–1950) applies per-field `parsed.X || fallback`.
- **React:** `projectStore.ts` (401–411) builds fallbacks then spreads `...result` after, overwriting them with raw (possibly corrupt/empty) stored scalars.
- **Fix:** Apply scalar fallbacks after the spread (or per-field `||`).

### B23. `loadProjectState` doesn't backfill `defaults.elements`/`defaults.popouts` (Low)
- **app.js:** `loadState` (1956–1957) ensures `defaults.elements = []`.
- **React:** projectStore (394–400) only patches `defaults.background.image`.
- **Fix:** `defaults.elements ||= []; defaults.popouts ||= []`.

### B24. 3D model reload has no "same device already loaded" guard (Medium)
- **three-renderer.js:** `switchPhoneModel` (534–543) early-returns if the requested device is already current.
- **React:** `useThreeJS.loadPhoneModel` (343–380) guards only on `phoneModelLoading`; a redundant call disposes and rebuilds the pivot → blank/black flash, lost frame color/texture until re-applied.
- **Fix:** Add the same-device early return.

### B25. 3D frame color doesn't default to the first preset (Medium)
- **app.js:** `updateFrameColorSwatches` (2263–2264) defaults `activeColorId` to `presets[0].id` when unset.
- **React:** `DevicePanel` (118–137) / `applyFrameColor` (194) — `frameColor` is `undefined` by default, so no swatch highlights and the GLB keeps raw imported colors.
- **Fix:** Default `frameColor` to the first preset per device on entering 3D / switching device.

### B26. `wrapText` doesn't strip `\r` (CRLF) (High)
- **app.js:** `wrapText` (8173) splits on `/\r?\n/`.
- **React:** `renderer.ts` `wrapText` (79–101) splits on `'\n'` only → trailing `\r` measured/rendered for Windows-pasted text.
- **Fix:** Split on `/\r?\n/`.

### B27. Google font loading lacks shared cache, multi-weight load, stylesheet await (Medium)
- **app.js:** `loadGoogleFont` (798–857) — module-level `loaded`/`loading` sets, awaits `<link>` load, loads weights `400`+headline+subheadline via `Promise.all`.
- **React:** `FontPicker.loadGoogleFont` (90–100) — per-component cache, no link await, loads only weight `400`.
- **React:** Selected heavy weights may render as faux-bold/fallback differing from legacy.
- **Fix:** Hoist cache to module scope, await link load, load active weights.

### B28. Live-preview text resolved by `currentLanguage`, not field language (High — cross-cutting)
- **app.js:** `drawText` (8018–8027) / `drawTextToContext` (7488–7496) resolve strictly from `currentHeadlineLang`/`currentSubheadlineLang`; exports temporarily set those fields per language.
- **React:** `renderer.ts` `drawText` (437–457) prefers `currentLanguage` and falls back through `currentHeadlineLang` → `en`.
- **React:** Switching app language changes both image and text (legacy decoupled them); the `|| en` fallback can substitute English where legacy renders empty.
- **Fix:** Decide the model. To match legacy: resolve text from the field-language pointers and set them per language during export. **Document the decision regardless** — this affects preview and export output across the app.

---

## UI / Visual Differences

### U1. Default theme is `dark`, not legacy `auto` (High)
- **app.js:** `initTheme` (5963) defaults to `auto`; Settings "Auto" active by default.
- **React:** `main.tsx:22` / `Modals.tsx:109` default to `dark`.
- **Fix:** Default to `auto` and resolve via `matchMedia`.

### U2. `applyTheme('auto')` writes `data-theme` instead of deleting it (Low)
- **app.js:** `applyTheme` (5955) deletes `data-theme` for auto, letting the CSS media query drive theme.
- **React:** `main.tsx:25-27` / `Modals.tsx:137-139` always set `data-theme`, making the `@media (prefers-color-scheme)` block dead.
- **Fix:** Delete `data-theme` for auto.

### U3. About modal rewritten; missing Live Version / GitHub links (Medium)
- **index.html:** info icon, "vibe coded" copy, "Created by Stefan from yuzuhub.com", MIT line, **Live Version · GitHub Repo** links (1785–1802).
- **React:** `Modals.tsx` (27–56) — different attribution ("YuzuHub … Düsseldorf"), adds a Credits list not in legacy, **omits the live/repo links** and the icon.
- **Fix:** Restore original copy + links + icon; reconcile the credits list.

### U4. Modal styling diverges (radius/padding/alignment/animation/buttons) (Medium)
- **styles.css:** `.modal` radius 16px, padding 32px, centered, scale-in entrance; equal-width buttons; red destructive `.modal-btn-confirm`.
- **src/styles.css:** override block (3427–3499) — radius 12px, padding 24px, left-aligned, no entrance animation, right-aligned compact buttons, accent-only primary (no destructive red).
- **Fix:** Align values; add destructive variant.

### U5. Language menu labels show codes, not full names (High)
- **app.js:** `updateLanguageMenu` (4906) renders `flag + languageNames[lang]`.
- **React:** LeftSidebar (693) renders `flag + lang.toUpperCase()`; the `languageNames` map isn't ported.
- **Fix:** Port `languageNames` and use it everywhere languages are listed.

### U6. Language menu active class mismatch (Medium)
- **app.js:** adds class `active` (4905).
- **React:** adds class `selected` (LeftSidebar 691); CSS targeting `.active` won't match.
- **Fix:** Use `active`.

### U7. Settings provider/theme labels, order, and Save text (Low–Medium)
- **index.html/llm.js:** radio labels "Anthropic (Claude)/OpenAI (GPT)/Google (Gemini)"; theme order Auto/Light/Dark; button "Save Settings"; Anthropic name "Anthropic (Claude)"; Gemini order Flash-preview before Pro-preview.
- **React:** `Modals.tsx` — "Claude/OpenAI/Google" btn-group; theme order Dark/Light/Auto; "Save"; "Claude (Anthropic)"; Gemini order/labels differ.
- **Fix:** Match labels, order, and button text.

### U8. Languages modal title "Edit Languages" vs "Project Languages" (Low)
- **index.html:** "Project Languages".
- **React:** `Modals.tsx:360` "Edit Languages".

### U9. Language menu item order, icons, dividers (Low)
- **index.html:** Edit Languages then Translate All, both with icons, two dividers (84–104).
- **React:** Translate All then Edit Languages, no icons, one divider (LeftSidebar 698–703).

### U10. Snap guide visual style differs (Low)
- **app.js:** `drawSnapGuides` (3200–3203) `rgba(120,170,255,0.45)`, width `max(1,1.5*w/400)`, dash `[12,8]` scaled.
- **React:** CanvasArea (330–332) `rgba(10,132,255,0.85)`, different width/dash.

### U11. Element list text-thumbnail uses 📝 emoji vs SVG icon (Low)
- **app.js:** `updateElementsList` (2535–2539) inline SVG.
- **React:** ElementsPanel (248) `<span>📝</span>`.

### U12. Gradient stop delete glyph: `✕` text vs SVG (Low)
- **app.js:** SVG X (6930–6934). **React:** `✕` (BackgroundPanel 212).

### U13. Screenshot thumbnail language flags / completeness checkmark differ (Low)
- **app.js:** `updateScreenshotList` (6504–6512) shows flags only for languages with images (gated on `projectLanguages.length>1`) plus a `✓` when complete.
- **React:** LeftSidebar (800–804) renders a flag per `localizedImages` key unconditionally, no `✓`.

### U14. Thumbnail / `getScreenshotImage` fallback chain truncated (Low)
- **app.js:** full chain (current → each project language → any localized → legacy image).
- **React:** LeftSidebar (790–792) current → `en` → legacy; `useCanvas.getScreenshotImage` (175–178) returns first key even if its image is null.
- **Fix:** Loop to first truthy image, mirroring legacy.

### U15. Export language dialog & progress show raw codes, not flag+name (Medium)
- **app.js/language-utils.js:** `showExportLanguageDialog` (410–416) and progress detail use `flag + languageNames[lang]`.
- **React:** LeftSidebar (944–953, 414, 455) show bare/upper code.

### U16. Export progress modal title/timing (Low–Medium)
- **app.js:** status "Complete!", lingers 1500ms (8327, 8401).
- **React:** static header "Exporting Screenshots", status "Complete", 500ms dismiss (AllModals 75–91; LeftSidebar 426/428/462/464).

### U17. Popout toggle rows lack `collapsed` class (Low)
- **app.js:** `updatePopoutProperties` (3360–3378) toggles `collapsed` on `.toggle-row`.
- **React:** PopoutsPanel (402–462) toggles only `active`.

### U18. Project create/duplicate modal text & "(Copy)" auto-fill (Low)
- **app.js:** duplicate-from first option "None (empty project)"; selecting a source auto-fills "<name> (Copy)" (3858–3893).
- **React:** "— New empty project —"; no auto-fill (LeftSidebar 908–929).

### U19. Crop handle hit radius & cursor feedback (Low)
- **app.js:** `hitTestCropHandle` (3521) `hitR=12`; per-handle resize cursors.
- **React:** PopoutsPanel (93) `hs=14`; static `crosshair`.

### U20. No hover cursor feedback over draggable elements (Low)
- **app.js:** window mousemove (3122–3130) toggles `element-hover`.
- **React:** CanvasArea only acts while dragging; no hover affordance.

---

## Interaction / Workflow Differences

### W1. Far-left/far-right side previews are clickable in React (legacy: display-only) (Medium)
- **app.js:** only near previews have click handlers (7075, 7103); far previews none.
- **React:** CanvasArea (368, 430) far previews jump ±2.
- **Fix:** Remove far-preview onClick (or document).

### W2. Modals/menus close on Escape — React adds behavior legacy lacked (Low)
- **app.js:** only one keydown listener (project-name Enter, 3944–3948); no Escape/Delete/arrow/Ctrl+S.
- **React:** `useEscapeKey` (Modals 14–21) and LeftSidebar (80–92) close modals/menus on Escape.
- **Note:** Improvement; document as intentional deviation. (There are otherwise **no keyboard shortcuts to port** — legacy had none.)

### W3. Tauri/undetected-language upload defaults to current language, not `en` (Medium)
- **app.js:** `detectLanguageFromFilename` returns `'en'` fallback; images filed under `'en'`.
- **React:** returns `null`; callers default to `currentLanguage || 'en'` (LeftSidebar 235, 288) → same file lands in a different slot depending on UI language.
- **Fix:** Default to `'en'`.

### W4. Languages modal is a different interaction model (Critical/High UX)
- **app.js:** current-languages list with "Current" badge + per-row remove (disabled at one language) + separate "Add a language…" select (4948–4998).
- **React:** flat checklist of all 26 languages, committed on "Done" (Modals.tsx 246–393); no current badge, no per-row remove, no add dropdown.
- **Fix:** Rebuild to the two-section legacy layout with cascading add/remove actions.

### W5. `switchProject`/`createProject`/`deleteProject` responsibilities scattered (Medium)
- **app.js:** `switchProject` (2098) is atomic: saveState → set id → saveMeta → resetState → loadState → refresh; `createProject` switches (saving outgoing first); `deleteProject` guards "only project" with an alert and switches.
- **React:** `projectStore.switchProject` (352) only sets id+meta; save/reset/load duplicated per call site (LeftSidebar 726–736); `createProject` (311) doesn't save outgoing; `deleteProject` (321) doesn't load next.
- **Fix:** Make these store actions atomic (using `useAppStore.getState()`), so all call sites behave like legacy and no unsaved edits leak.

### W6. Autosave debounced 800ms vs legacy save-on-every-render; no flush on unload (Medium)
- **app.js:** `saveState()` runs at the top of every `updateCanvas()` (6977).
- **React:** App.tsx (77–86) debounces 800ms; some handlers call `saveState` immediately, creating inconsistent timing; no `beforeunload` flush.
- **Fix:** Add an unload/visibilitychange flush; ensure project switch/create/delete flush first.

### W7. Translate-All applies silently with no count / progress / success alert (High)
- See M7. Loss of staged progress and "Successfully translated N text(s)!".

---

## Data / State / Side Effect Differences

### D1. Style-transfer data loss (C1, C2, C3) — see Critical.
### D2. Background image lost on edit (C4, C5) — see Critical.
### D3. Legacy migration missing (C11) + migration prompt (M-prompt) — see Critical.
### D4. Add-language / switch-language cascades missing (C8, C9) — see Critical.
### D5. Per-language layout storage diverges (C10, M10) — see Critical/Missing.

### D6. `loadProjectState` scalar fallbacks shadowed; defaults arrays not backfilled (B22, B23).

### D7. Backup import partial rehydrate vs reload (M9).

### D8. Icon element persistence contract differs (Medium)
- **app.js:** icon `el.src = null`; image is a runtime Blob URL; reconstructed from `iconName`/`iconColor`/`iconStrokeWidth` (`updateIconImage` 483).
- **React:** stores a baked colorized data URL in `el.src` (ElementsPanel 168–191).
- **Fix:** Confirm projectStore round-trip; either keep `src:null` + reconstruct, or document the deviation.

### D9. 3D texture not explicitly refreshed after import/selection (Medium — verify)
- **app.js:** `processImageFile` (6344–6348) & selection (6651–6654) call `updateScreenTexture()` when 3D.
- **React:** relies on `useThreeJS` effects; verify the texture re-keys on screenshot image / selection / language change, else the 3D device shows a stale screenshot.

### D10. Emoji picker fallback data diverges from `EMOJI_DATA` (Low–Medium)
- **app.js:** `renderEmojiGrid`/search use global `EMOJI_DATA` (name+keywords) (8474–8500).
- **React:** `EmojiPicker` (AllModals 618–643) falls back to an in-component map where `name`=glyph, empty keywords, duplicate entries (🔥/❤️), search matches glyph only.
- **Fix:** Ensure `EMOJI_DATA` is bundled/loaded; if a fallback stays, mirror categories + names/keywords and dedupe.

### D11. `updateScreenshotCount` re-renders on every save even when unchanged (Low)
- **React:** `projectStore.updateScreenshotCount` (422–430) calls `set` + `saveProjects` every debounced save.
- **Fix:** Skip when count unchanged.

### D12. Per-file `saveState` granularity in Tauri import (Low)
- **app.js:** `addLocalizedImage` saves per file.
- **React:** `handleTauriImport` saves once after the loop (338). Cosmetic.

### D13. Default project id hardcoded `'default'` (Medium — verify)
- **React:** projectStore (259–261) hardcodes id `'default'`.
- **Note:** Verify against the legacy fresh-install default id; mismatched ids mean the two apps don't share the same fresh project / meta.

### D14. Live preview render rebuilds 3D screen texture every frame (Low, perf)
- **React:** `renderForScreenshotInternal` (useThreeJS 617–632) creates/disposes a new texture+material per frame vs legacy's persistent `customScreenPlane`. Output identical; efficiency only.

### D15. Noise amplitude: React preview matches legacy *export* (×255), not legacy *preview* (×50) (Medium)
- **app.js:** preview `drawNoise` (8148) `/100*50`; export `drawNoiseToContext` (7370) `/100*255` (legacy is internally inconsistent).
- **React:** `renderer.drawNoise` (254) uses `×255` everywhere → preview noisier than legacy preview (export parity preserved).
- **Fix:** Decide canonical amplitude; document.

---

## File-by-File Findings

### `src/stores/appStore.ts`
- C1/C2/C3 style transfer (517, 533, 507–537); C4/C5 background `image:null` normalize (47, 366, 372–394, 409); C8/C9 missing language cascade actions (455); B1 addScreenshot selection (298–302); B7 duplicate copies elements/popouts (323–345); M10 normalizeTextSettings seeding (147–160); setTextSetting persistence wiring (440–450).

### `src/stores/projectStore.ts`
- C11 missing old-format migration (379–420, 147–198); B22 spread-order fallbacks (401–411); B23 defaults arrays backfill (394–400); W5 non-atomic switch/create/delete (311–355); D11 redundant count writes (422–430); D13 hardcoded default id (259–261).

### `src/App.tsx` / `src/main.tsx`
- W6 debounced autosave / no unload flush (App 77–86); U1/U2 theme default/auto handling (main 22, 25–27); M1 no global drop wiring. `setupSliderResetButtons` port verified equivalent (App 95–112).

### `src/components/Layout/LeftSidebar.tsx`
- C3 transfer direction (637–650, 760); M1 drag-drop import; M2 Replace Screenshot; M3 apply-to-all confirm (658–662); M9 backup import reload (555–577); B2 blanked text (359); B3 device type (356); B4 filename match (128–139); B5 sequential import (234); B6 drag reorder (602–611); M12 disabled/transfer-mode UI; M13 output-size dropdown (862–903); U5/U6 language menu labels/class (691–693); U9 menu order/icons (698–703); U13/U14 thumbnail flags/fallback (790–804); U15 export dialog codes (944–953, 414, 455); U18 project modal text (908–929); W3 undetected-language default (235, 288); custom alert/confirm not styled (180–224).

### `src/components/Layout/CanvasArea.tsx`
- C7 element selection not shared (286–303); M4 slide animation (58–79); M5 3D side previews; B8 hit-test layer order (261–280); B9 popout hit-test priority; B10 snap guides erased (322–346); U10 snap guide style (330–332); U20 hover cursor; W1 far-preview clicks (368, 430).

### `src/canvas/renderer.ts`
- B26 wrapText CRLF (79–101); B28 text language resolution (437–457); B11 icon fill (n/a — see ElementsPanel); M10 getEffectiveLayout seeding (398–419); D15 noise amplitude (254); background/gradient/image/popout/2D math verified matching.

### `src/hooks/useCanvas.ts`
- C6 3D export gating (112, 141–144); U14 getScreenshotImage first-key (175–178); render does not save (50–78, by design — verify call sites, W6).

### `src/hooks/useThreeJS.ts`
- C6 engine init only when selected (324–331); B24 same-device guard (343–380); B25 frame color default (194); D14 per-frame texture rebuild (617–632); device configs/lighting/camera/material verified matching.

### `src/components/Controls/BackgroundPanel.tsx`
- B21 gradient delete affordance (204); U12 delete glyph (212); stale-closure image upload (279–289); gradient/image math verified matching.

### `src/components/Controls/DevicePanel.tsx`
- B25 frame color default highlight (118–137); slider ranges & presets verified matching.

### `src/components/Controls/TextPanel.tsx`
- C10 layout language storage + "Layout for" selector (70–78, 336–356); M10 seeding; U-text language selector iterates projectLanguages not headlineLanguages (105, 202); saveState imported but unused (32).

### `src/components/Controls/ElementsPanel.tsx`
- B11 icon fill recolor (61–64); B12 icon picker (via AllModals); D8 icon persistence (168–191); U11 text thumbnail emoji (248).

### `src/components/Controls/PopoutsPanel.tsx`
- B13 clamp math (109–157); B14 unformatted values (306–330); B15 hardcoded `en` image (54–56, 266); M14 hex inputs (446–485); U17 collapsed class (402–462); U19 hit radius/cursor (93, 341); F7 interdependent slider maxes (304–328).

### `src/components/UI/FontPicker.tsx` / `fontCatalog.ts`
- B27 google font load (90–100); M15 no API/popularity/`googleFontsApiKey` (108–128); missing loading indicator.

### `src/components/Modals/Modals.tsx`
- U1/U2 theme (109, 137–139); U3 About rewrite (27–56); M8 Settings show-key/links/status/icons (107–239); U7 labels/order/Save text (89–94, 179, 191–196, 234); U8 Languages title (360); W4 Languages modal model (246–393).

### `src/components/Modals/AllModals.tsx`
- M6 Magical Titles (416–501); M7/W7 Translate-All (268–360); B16/B17 OpenAI body (42–50); B18 apply subheadline (133–158); B19 translate modal (98–262); B20 prompts; B12 icon picker (686–756); D10 emoji picker (618–643); U16 export progress (75–91); ScreenshotTranslations modal labels/thumbnails (507–603).

### Legacy reference (source of truth)
- `app.js`, `three-renderer.js`, `language-utils.js`, `magical-titles.js`, `llm.js`, `index.html` (git `45086a5^`), `styles.css`.

---

## Recommended Fix Order

**Phase 1 — Data-loss & broken core (Critical):**
1. C1/C2/C3 — fix style transfer (direction, preserve text, transfer elements) + M3 add confirm.
2. C4/C5 — stop nulling the background image; restore span feature.
3. C6 — render 3D in batch/all-language exports.
4. C7 — lift element selection into the store (restore click-to-edit).
5. C11 — port legacy project migration (+ migration prompt).

**Phase 2 — Language & persistence correctness (Critical/High):**
6. C8/C9/C10/M10 — language cascades, global-switch propagation, per-language layout storage + seeding.
7. B22/B23/M9/W5/W6 — load fallbacks, defaults backfill, backup reload, atomic project actions, autosave flush.
8. B28 — decide & implement the text-language resolution model; document it.

**Phase 3 — Missing primary workflows (High):**
9. M1 drag-drop import; M2 Replace Screenshot; B2/B3/B4/B5/B6 import correctness.
10. M4/M5 slide animation + 3D side previews; B8/B9/B10 canvas interaction.
11. M6/M7 AI feature prompts + progress/alerts; B16–B20 translation correctness.

**Phase 4 — UI/Settings parity (Medium):**
12. M8 Settings affordances; U1/U2 theme default; U3 About; U4 modal styling; W4 Languages modal; M13 output dropdown; U5/U15 language naming.
13. B11/B12/B13/B14/B15/B24/B25/B26/B27 rendering & control correctness.

**Phase 5 — Cosmetic & cleanup (Low):**
14. U6–U20, W1/W2/W3, D8/D10/D11/D12/D14/D15, M11/M12/M14, B7/B21 (decide & document deliberate deviations).

---

## Detailed Checklist

### Critical
- [x] C1 Preserve target `headlines`/`subheadlines` in `transferStyle` + `applyStyleToAll`.
- [x] C2 Clone `source.elements` (fresh ids, preserved image refs) in both transfer actions.
- [x] C3 Fix transfer direction + labels/hints to "copy style from".
- [x] C4 `normalizeBackgroundSettings` keep `image: bg.image || null`.
- [x] C5 Restore span on/off propagation (match `applyBackgroundImage`).
- [x] C6 Initialize/await Three.js engine for batch/all-language export.
- [x] C7 Lift `selectedElementId` into the store; wire canvas drag → selection.
- [x] C8 `addProjectLanguage` cascade onto screenshots + defaults.
- [x] C9 `switchGlobalLanguage` propagate per-field pointers + saveState.
- [x] C10 Write headlineSize/subheadlineSize/layout to correct language keys; remove/justify "Layout for".
- [x] C11 Port old-format migration + migration prompt + `convertProject`.

### High
- [x] M1 Sidebar drag-and-drop import + `drop-active`.
- [x] M2 Replace Screenshot menu action.
- [x] M3 Apply-style-to-all confirmation modal.
- [x] M4 `slideToScreenshot` directional animation + pre-render + model gating.
- [x] M5 3D rendering + adjacent model preload in side previews.
- [x] M6 Magical Titles: full prompt, language name, project-language image scan, conditional enable, progress/alerts, tooltip.
- [x] M7 Translate-All: stats/guards, grouped prompt + JSON, progress/alerts, applied count.
- [x] M8 Settings: show-key toggle, API-key links, on-open status, section icons/descriptions.
- [x] M9 Backup import reload + export/import error feedback.
- [x] M10 `getTextLanguageSettings` create-on-read + source-copy seeding.
- [x] B2 New screenshots deep-clone `defaults.text`.
- [x] B3 Detect device type from image aspect ratio.
- [x] B4 Filename match only on localized image names.
- [x] B9 Popout hit-test priority on canvas.
- [x] B15 Popout crop preview/thumbnails use localized current-language image.
- [x] B26 `wrapText` split on `/\r?\n/`.
- [x] B28 Decide + implement text-language resolution; document.
- [x] U1 Default theme `auto`.
- [x] U5 Port `languageNames`; use full names in all language UI.

### Medium
- [x] B5 Sequential multi-file import.
- [x] B6 Drag-reorder selection + before/after indicators.
- [x] B7 Decide duplicate elements/popouts behavior.
- [x] B8 Hit-test by layer order.
- [x] B10 Render snap guides in the pipeline.
- [x] B11 Don't recolor icon `fill`.
- [x] B12 Icon picker: bundled lists, lazy load, debounced search.
- [x] B13 Crop resize edge-pinning math.
- [x] B14 Format popout values (1 decimal).
- [x] B16 OpenAI `max_completion_tokens: 16384`.
- [x] B17 OpenAI error body detail.
- [x] B18 Apply subheadline → enable subheadline.
- [x] B19 Per-field translate modal language set/default/labels.
- [x] B20 Full AI prompts with language names.
- [x] B21 Gradient delete only `i > 1`.
- [x] B22 Apply scalar load fallbacks after spread.
- [x] B24 3D same-device load guard.
- [x] B25 Default 3D frame color to first preset.
- [x] B27 Google font shared cache + multi-weight + link await.
- [x] D8 Icon persistence contract decision.
- [x] D9 Verify/refresh 3D texture on import/selection/language.
- [x] D13 Verify default project id vs legacy.
- [x] D15 Decide noise amplitude; document.
- [x] M13 Custom output-size dropdown (or document).
- [x] M14 Popout hex color inputs.
- [x] U3 Restore About copy + links + icon.
- [x] U4 Align modal styling + destructive variant.
- [x] U6 Language menu `active` class.
- [x] U15 Export dialog/progress flag+name.
- [x] U16 Export progress title/timing.
- [x] W1 Remove far-preview clicks (or document).
- [x] W3 Undetected-language default to `en`.
- [x] W4 Rebuild Languages modal interaction model.
- [x] W5 Atomic switch/create/delete project actions.
- [x] W6 Autosave unload flush.

### Low
- [x] B23 Backfill `defaults.elements`/`popouts`.
- [x] B1 addScreenshot selection only when empty.
- [x] D10 Emoji picker data parity + dedupe.
- [x] D11 Skip redundant count writes.
- [x] D12 Tauri per-file save granularity.
- [x] D14 Reuse persistent 3D texture in preview.
- [x] M11 First-screenshot Magical Titles tooltip.
- [x] M12 Disabled/transfer-mode UI states.
- [x] M15 Google Fonts API + key (or document offline-first).
- [x] U2 `auto` theme deletes `data-theme`.
- [x] U7 Settings labels/order/Save text.
- [x] U8 Languages modal title.
- [x] U9 Language menu order/icons/dividers.
- [x] U10 Snap guide style.
- [x] U11 Element list SVG thumbnail.
- [x] U12 Gradient delete SVG glyph.
- [x] U13 Thumbnail flags + completeness checkmark.
- [x] U14 Full `getScreenshotImage` fallback chain.
- [x] U17 Popout `collapsed` row class.
- [x] U18 Project modal text + "(Copy)" auto-fill.
- [x] U19 Crop handle radius + resize cursors.
- [x] U20 Hover cursor over draggable elements.
- [x] W2 Document Escape-to-close as intentional.

---

### Note on deliberate deviations to document in `REACT_REFACTOR_PARITY_AUDIT.md`
Several React behaviors appear to be intentional improvements rather than bugs (Escape-to-close, duplicate copying elements/popouts, preview==export noise, decoupled save-from-render, the "Layout for" selector). Each should be explicitly recorded as an accepted deviation **or** reverted for strict 1:1 parity — not left ambiguous.
