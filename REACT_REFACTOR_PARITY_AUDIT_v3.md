# React Refactor Parity Audit

> **Audit date:** 2026-06-28 (v3)
> **Source of truth:** `app.js` (7568 lines) plus `three-renderer.js`, `language-utils.js`, `magical-titles.js`, `llm.js`, and the original `index.html`/`styles.css`. The original `index.html` was recovered from git (`45086a5^:index.html`) and staged as `legacy_index_reference.html`; the root `styles.css` is the legacy stylesheet (the React stylesheet is `src/styles.css`).
> **Subject under audit:** the React + TypeScript refactor under `src/`.
> **Method:** Seven parallel area-focused passes (state/persistence, 2D+3D rendering, canvas interaction, left sidebar, control panels, modals/AI, UI/CSS/DOM). The React version was **not** assumed correct; every previously-reported item was re-verified against the *current* code, since a structural refactor commit (`1e5e610`) landed after the v2 audit.

---

## Implementation Status

> **Started:** 2026-06-28. Status is tracked inline in the Detailed Checklist (`[ ]` → `[x]`). This log records what changed per phase. Validation: `npx tsc -b` after each phase.

- **Phase A — store/state foundation:** ✅ done
- **Phase B — rendering, control panels, modals/AI (logic):** ✅ done
- **Phase C — canvas interaction & sidebar:** ✅ done
- **Phase E — CSS/visual:** ✅ done
- **Final validation:** ✅ `npx tsc -b` clean after every phase; `npm run build` (tsc + Vite) succeeds. Remaining build output is two pre-existing, non-blocking warnings (the `projectStore → appStore` dynamic-import notice and the >500 kB bundle-size hint).

> **Overall:** every Critical/High/Medium finding is fixed or resolved-by-existing-code. A small set of Low items are recorded below as **accepted deviations** (intentional improvements kept on purpose) or **residual partials** (implemented to a pragmatic degree, with the remainder documented). See the Detailed Checklist for per-item status.

### Implementation Log
- **Phase A (appStore.ts / types):** DS-1 `setCurrentLanguage` sets only per-screenshot field pointers (no `currentLayoutLang`, no seeding, no defaults mutation), keeps `saveState`. DS-2 `addProjectLanguage` extends arrays + empty strings only (lazy layout seeding). DS-3 `normalizeTextSettings` declares languages strictly from `headlineLanguages ∪ subheadlineLanguages`, no back-add from map keys, seeds only `languageSettings`. DS-4 style transfer preserves only target `headlines`/`subheadlines`. DS-6 store initial/reset dimensions → `1320×2868`. IB-1 added `selectedPopoutId` + `setSelectedPopoutId` (mutually exclusive with element selection); cleared on select/add/delete/duplicate/reorder/load. CR-2 added `removeProjectLanguage` store action (any language removable, ≥1 remains, repoints current). Replaced `ensureTextLanguage` with `addLanguageToText`/`removeLanguageFromText`.
- **Phase B (renderer.ts):** IB-3 `getEffectiveLayout` now seeds an un-set per-language layout from the active source language (`currentLayoutLang || currentHeadlineLang || currentSubheadlineLang || 'en'`), not `['en']`. IB-4 `drawText` layout-language uses the full `getTextLayoutLanguage` precedence. IB-15 kept the dimension fallback with a comment (accepted safety addition).
- **Phase B (useThreeJS.ts):** IB-5 active preview model frame color is restored after a per-screenshot render. IB-6 frame color (default first preset) + screen texture applied synchronously at end of `finishModelLoad`. IB-16 `screenPlane.rotation` set to `-modelRotation` in both build paths (latent no-op today).
- **Phase B (PopoutsPanel.tsx):** IB-1 reads/writes shared store `selectedPopoutId`. IB-8 `formatValue` strips `.0`; list crop label uses `Math.round`. IB-7 crop preview ported to the legacy letterbox layout (`getCropPreviewLayout` + `drawX/drawY/drawW/drawH` offsets in draw, hit-test, drag-delta).
- **Phase B (ElementsPanel.tsx):** IB-10 icon stroke 0.5–4/0.25, element font-size number 12–300, icon shadow blur max 100. MF-8 added validated hex inputs for icon/frame/icon-shadow colors. UV-11 text thumbnail "T" glyph. UV-12 "Circle Badge"/"Shield Badge" labels.
- **Phase B (TextPanel.tsx):** IB-2 removed the non-legacy per-language flag selector rows. UV-13 inline `magic-translate-btn` wand. UV-14 per-language-layout toggle moved/relabeled.
- **Phase B (AllModals.tsx):** CR-3 restored verbatim legacy prompts (Magical Titles, Translate-All grouped + numeric-index contract, per-field) using language names. IB-9 per-field apply writes all targets unconditionally + enables subheadline. IB-12 alert/error strings + Failed-to-fetch/SyntaxError branches. IB-11 icon picker: 200 ms debounce + `loading="lazy"` + theme-aware coloring (residual below). MF-4 phased progress overlay. UV-15 static export heading. UV-16 translations copy. DS-9 emoji dedupe across categories.
- **Phase B (Modals.tsx):** CR-2/UV-4 Languages modal rebuilt (any language removable, live add/remove via store, "Project Languages" title, `.languages-modal` markup). MF-5 Settings eye-toggle, on-open `'✓ API key is saved'`, provider help-link text, "Appearance" label, header close. MF-7 live theme preview on click. UV-3 About restored (copy, `/en` link, Live/GitHub links, removed fabricated credits). IB-13 Gemini "(Preview)" labels.
- **Phase C (CanvasArea.tsx):** CR-1 `#threejs-container` forced `display:none` (3D composites onto the 2D canvas; container no longer covers it or intercepts pointer events). IB-1 popout drag sets shared `selectedPopoutId`. IW-1 slide gated to adjacent (±1) navigation + `isSliding` re-entrancy guard.
- **Phase C (LeftSidebar.tsx):** CR-4 new screenshots `popouts: []`. IW-3 transfer-target class/hint/`length>1` gate. MF-1 custom output-size dropdown. MF-2 duplicate-comparison modal. UV-7 menu SVG icons/order/items. UV-8 export modal. UV-9 apply-style modal. UV-10 delete-project copy. UV-14 project modal copy. IB-12 tooltip 500 ms delay.
- **Phase C (DevicePanel.tsx):** UV-5/CR-5 position presets rebuilt with legacy `.preset-positions`/`.position-preset` SVG cards (stops using `.preset-grid`). MF-8 shadow color hex input. UV-14 corner-radius-before-rotation + "Tilt / Rotation" label.
- **Phase C (FontPicker.tsx):** UV-14 tab order Popular/System/All. MF-6 per-option "Loading…" indicator.
- **Phase E (styles.css):** UV-17 `--accent-color` → `--accent`. CR-1 `#threejs-container` z-index 0 + `pointer-events:none`. CR-5 removed the colliding 3-col `.preset-grid` override (gradient swatches back to 5-col). UV-1 modal overlay fade-in animation.
- **MF-3:** already satisfied — the migration modal renders in `App.tsx`.

### Accepted deviations (intentional, documented — not bugs)
- **CR-4 (duplicate):** `duplicateScreenshot` keeps elements + popouts. A duplicate shares the same source image, so popout crops remain valid; preserving the full visual is the safer editor behavior. (The real bug — new *uploaded* screenshots inheriting `defaults.popouts` — is fixed.)
- **UV-2:** standardized on the React `.modal-btn .primary/.secondary/.danger` system (equal-width, destructive red available) instead of the legacy `.modal-btn-confirm/-cancel/-primary`. Functionally equivalent; legacy classes left in the sheet.
- **UV-6:** the refreshed screenshot-list item/thumbnail sizing + hover-actions row is kept as an intentional visual enhancement.
- **MF-6:** offline-first font catalog kept (no live Google Fonts API / `googleFontsApiKey` / popularity sort) per the standing CLAUDE.md decision; only the loading indicator + tab order were aligned.
- **IB-14:** export settle delay stays `0 ms` — the React export path `await`s `renderScreenshotToCanvas` (which awaits the 3D render), so frames are settled before `toDataURL`; the legacy 100 ms was for its non-awaited path.
- **IB-15:** `getCanvasDimensions` keeps a safety fallback for unknown device ids (legacy would throw).
- **DS-5 / DS-7 / DS-8:** pure store getters, debounced autosave (+ unload flush), and baked icon data-URL persistence are intentional React-architecture choices.
- **IW-5 / W2:** Escape-to-close for modals/menus kept as a usability improvement.
- **MF-9:** no separate list-region "no screenshots" placeholder — the canvas already shows an "Upload screenshots to get started" empty state.

### Residual partials (implemented pragmatically; remainder documented)
- **IB-11 (icon picker):** debounce (200 ms), `loading="lazy"`, and theme-aware coloring are done. Full legacy parity (IntersectionObserver + inline `currentColor` SVG fetch/injection instead of `<img>`+filter) is NOT implemented; deferred as a non-functional refinement.
- **IW-1 (slide):** gated to adjacent navigation with an `isSliding` guard; the legacy async pre-render of adjacent previews + per-frame model-await is NOT replicated — the existing adjacent-model preload effect already suppresses most 3D flashing. Deferred.
- **IW-2 / IW-4:** side-preview skip-during-slide not added (low); adjacent (±1) preview clicks now animate via the gated slide, matching legacy feel.
- **DevicePanel position presets:** rendered as an always-expanded `.preset-positions` grid; the legacy collapsible `.preset-dropdown` open/close toggle is not wired (cosmetic).
- **Stylesheet dead selectors:** the now-dead legacy selectors (`.output-size-*` native variant, `.modal-btn-confirm/...`, `.preset-btn`, etc.) are left in place; a full dead-CSS sweep is deferred (no runtime effect).

---

## Summary

This is a fresh, independent audit. Two facts frame it:

**1. Most v2 critical/data-loss bugs are genuinely fixed in the current code.** Re-verification confirms the following are now correct and at parity: style-transfer direction and target-text preservation; background-image preservation in `normalizeBackgroundSettings` (`image: bg.image || null`); the legacy old-format migration + `migrate3DPosition`; the `addProjectLanguage` cascade; shared `selectedElementId` between canvas and Elements panel; element hit-testing by layer order; popout-before-element hit priority; snap guides drawn as an overlay that survives the async repaint; `wrapText` CRLF handling; the full `getScreenshotImage` fallback chain; popout crop using the localized current-language image; popout hex inputs + `collapsed` row class + crop cursors; FontPicker shared cache / multi-weight / stylesheet-await / portaled dropdown; OpenAI `max_completion_tokens`; the Magical-Titles onboarding tooltip; export complete-timing (1500 ms); 2D transform/shadow/perspective/gradient/noise math; and the 3D batch/all-language export path (3D is rendered, not flattened). These should be marked as resolved rather than re-opened.

**2. A new class of regressions and a long tail of remaining gaps exist.** The biggest risks now, in order:

1. **3D mode breaks canvas interaction (regression).** The visible `#threejs-container` is positioned `absolute; inset:0; z-index:2; pointer-events:auto` on top of `#preview-canvas`. The legacy app keeps that container `display:none` and composites the 3D phone onto the 2D canvas. In React, while any 3D screenshot is selected, the WebGL overlay swallows every pointer event, so element drag, popout drag, hover cursor, **and** 3D drag-to-rotate all stop working — and the overlay shows a bare 3D phone (no background/elements/popouts/text), not the composited preview. (Critical — corroborated by both the canvas and CSS passes.)
2. **The Languages modal forbids removing English.** Legacy lets you remove any language down to the last one; React hard-codes English as non-removable and changed the live-apply model to staged-commit. (High behavioral divergence.)
3. **All three AI prompts were rewritten away from the source-of-truth text/contract** (Magical Titles, Translate All, per-field Translate). Constraints changed from hard "maximum N words" to soft "ideally," examples and CONTEXT blocks were dropped, and the Translate-All response key contract changed from numeric indices to `index:field` strings. This changes both AI output quality and parsing. (High.)
4. **New screenshots inherit `defaults.popouts`, and `duplicateScreenshot` copies elements+popouts**, where legacy uses `popouts: []` for new screenshots and drops elements/popouts on duplicate. Popout crop regions are source-image-specific, so they apply to the wrong image. (High.)
5. **Large UI/DOM regression surface.** `src/styles.css` copies the legacy sheet then re-overrides it, so many legacy selectors are dead or shadowed and two definitions collide. The most damaging collision: `.preset-grid` was redefined from 5 columns (gradient swatches) to 3 columns (position presets), so the gradient-preset swatch grid is now wrong. The output-size custom dropdown, modal entrance animation, modal button system, the Duplicate-Screenshot comparison modal, the Settings and Languages modal markup, and the position-preset SVG cards were all rebuilt with different structure.
6. **A set of control-panel range/type mismatches** (icon stroke width, element font-size input type/range, icon shadow blur, missing hex inputs on device/element color controls) and **a non-legacy per-language flag selector added to the Text panel**.

A recurring theme: the refactor often **rebuilt** legacy UI with new markup/classes/labels rather than porting it, and left the original CSS in place underneath. Strict 1:1 parity requires either reverting to legacy markup or formally recording each as an accepted deviation.

A note carried from v2 that remains a live design decision: text is resolved by the field-language pointers (`currentHeadlineLang`/`currentSubheadlineLang`) in the current renderer — this part now matches legacy — but `getEffectiveLayout` does **not** replicate legacy's create-on-read per-language layout seeding from the active layout language; it falls back to `['en']`/flat globals. This affects exported sizes/offsets for un-seeded languages.

---

## Critical Issues

### CR-1. 3D container overlay blocks all canvas pointer interaction and shows a non-composited preview
- **Severity:** Critical
- **app.js / three-renderer.js:** `three-renderer.js` `showThreeJS` (1135–1146) forces `#threejs-container { display:none }` and keeps `#preview-canvas` visible; the 3D phone is rendered offscreen and composited onto the 2D canvas. `setup3DCanvasInteraction` (1221–1244) binds rotate to `#preview-canvas` and deconflicts with the `element-dragging` class. Legacy `styles.css:963–971`: container is static, no z-index.
- **React:** `src/styles.css:972–986` — `#threejs-container { position:absolute; inset:0; width/height:100%; z-index:2; pointer-events:auto }`, canvas forced `100% !important`. The live `renderer.domElement` is appended into that container (`useThreeJS.ts:300–308`) and the container is rendered with `display: showThreeJS ? 'block' : 'none'` (`CanvasArea.tsx:489–493`). 3D rotate (`setupDragRotate`) is bound to the 2D canvas *underneath* (`CanvasArea.tsx:165–174`).
- **Original:** The only visible/interactive surface is the 2D `#preview-canvas`, which shows the full composite (background → behind-elements → 3D phone → above-elements → popouts → text → above-text). Element drag, popout drag, hover, and 3D rotate all work.
- **React:** With any 3D screenshot selected, the WebGL overlay (no pointer handlers of its own) sits on top with `pointer-events:auto` and swallows every pointer event meant for the 2D canvas. Element drag (`handleElementPointerDown`), popout drag, hover cursor, and `setupDragRotate` all stop receiving events. The overlay also displays only a bare 3D phone render — none of the 2D layers — so the visible preview is wrong.
- **Why a parity problem:** Two core capabilities (editing overlays/popouts on canvas, rotating the device) silently break in 3D mode, and the preview itself is visually incorrect. This is a regression from a working legacy behavior.
- **Recommended fix:** Match legacy — keep `#threejs-container` hidden (or `pointer-events:none`) and rely on the existing composite-to-2D path (`useThreeJS.renderForScreenshotInternal` already draws into `#preview-canvas`). If the overlay must remain visible, set `pointer-events:none` and bind both 3D rotate and element/popout hit-testing to the topmost interactive layer, replicating the legacy `element-dragging`-vs-rotate arbitration.

### CR-2. Languages modal forbids removing English; uses staged-commit instead of legacy live-apply
- **Severity:** Critical (behavioral)
- **app.js:** `removeProjectLanguage` (5036) guards only on `state.projectLanguages.length <= 1`; the remove button is disabled only when a language is the sole one (4959). Add/remove mutate state and `saveState()` **immediately**; removing the current language calls `switchGlobalLanguage` at once (5044). English is freely removable.
- **React:** `Modals.tsx` `removeLanguage` (378–381) → `if (code === 'en' || languages.length <= 1) return;`; `canRemove = code !== 'en' && languages.length > 1` (457). Adds/removes mutate **local** state and are committed only on "Done" (`handleDone`, 389–443); Cancel discards.
- **Original:** Any language removable down to one; changes apply live.
- **React:** English can never be removed; changes are staged and committed/discarded as a transaction, and the switch-on-remove of the current language happens only at Done.
- **Why a parity problem:** A core list operation is blocked, and the transaction model differs (a user who removes the current language then cancels gets a different end state than legacy).
- **Recommended fix:** Change the guard to `languages.length <= 1` only and `canRemove = languages.length > 1`; remove the `'en'` special-casing. Adopt legacy live-apply (or formally document the staged-commit model as an accepted deviation, but at minimum match the current-language switch-on-remove).

### CR-3. All three AI prompts rewritten away from the source-of-truth text and contract
- **Severity:** High (grouped as Critical-tier because it changes feature output and breaks the response-parsing contract)
- **app.js / magical-titles.js:** Magical Titles prompt (`magical-titles.js:318–346`) includes app-analysis points, a CRITICAL value-prop rule for screenshot 1, a hard LENGTH REQUIREMENTS block (headline max 2–4 words, subheadline max 4–8), a UNIQUENESS block, concrete examples, and a two-entry JSON schema. Translate-All (`app.js:5758–5780`) builds a CONTEXT paragraph, an IMPORTANT brevity directive, screenshot-grouped source text, and keys the JSON by **numeric text indices**. Per-field translate (`aiTranslateAll`, 5366–5384) uses a brevity bullet list + IMPORTANT block + `Translate to these language codes:` footer.
- **React:** Magical Titles prompt (`AllModals.tsx:513–527`) is a condensed rewrite (soft "ideally", no examples, single-entry JSON). Translate-All (`AllModals.tsx:348–360`) uses a flat per-line list and keys JSON by `"0:headline"` strings, dropping CONTEXT/IMPORTANT and the screenshot pairing. Per-field (`AllModals.tsx:222–234`) is a rewritten 4-bullet "Rules:" prompt missing the IMPORTANT block and code-list footer.
- **Why a parity problem:** Prompts are the load-bearing behavior of these AI features. Soft vs hard length limits and missing examples change output; the Translate-All key contract change (numeric index → `index:field`) changes parsing/distribution.
- **Recommended fix:** Restore the exact legacy prompt text for all three flows, and switch the Translate-All response contract back to numeric indices matching the legacy `textsToTranslate` ordering.

### CR-4. New screenshots inherit `defaults.popouts`; `duplicateScreenshot` copies elements+popouts (legacy drops them)
- **Severity:** High
- **app.js:** `createNewScreenshot` (6388) sets `popouts: []` for every new screenshot. `duplicateScreenshot` (2200–2250) builds the clone from `name/deviceType/screenshot/text/overrides/background/localizedImages/image` only — it never copies `elements` or `popouts`.
- **React:** `createDefaultScreenshot` (`LeftSidebar.tsx:488`) clones `defaults.popouts`; `appStore.duplicateScreenshot` (490–513) copies both `elements: cloneElements(...)` and `popouts: clonePopouts(...)`.
- **Original:** New and duplicated screenshots start without popouts (crop regions are tied to a specific source image), and duplicates start without elements.
- **React:** New uploads carry popouts from the default style; duplicates carry the source's elements and popouts.
- **Why a parity problem:** Popout crop rectangles reference image-specific coordinates; applying them to a different image is visually wrong. This is also a behavior change for duplicate.
- **Recommended fix:** Set `popouts: []` in `createDefaultScreenshot`. For `duplicateScreenshot`, either drop `elements`/`popouts` to match legacy or record carrying them as an intentional improvement (it was an accepted deviation in v2 — confirm and document, but the popouts-on-new-screenshot case is a clear bug).

### CR-5. `.preset-grid` CSS collision breaks gradient-preset swatch layout
- **Severity:** High (visual correctness)
- **styles.css (legacy):** `.preset-grid { grid-template-columns: repeat(5, 1fr) }` (1736) — used for the background gradient-preset swatches.
- **React:** `src/styles.css:3553–3558` redefines `.preset-grid { repeat(3, 1fr) }` for the Device position presets (`DevicePanel.tsx:192–207`). Because BackgroundPanel's gradient swatches also use `.preset-grid`, and the React block comes later in the cascade, the gradient swatch grid renders as **3 columns instead of 5**.
- **Why a parity problem:** A shared class name was reused for a different control, silently changing an unrelated panel's layout.
- **Recommended fix:** Rename the position-preset grid class (e.g. `.position-preset-grid`) so it stops clobbering the gradient `.preset-grid`.

---

## Missing Functionality

### MF-1. Custom output-size dropdown replaced by a native `<select>`
- **Severity:** High (visual/structural)
- **legacy index.html:** 200–281 — `.output-size-dropdown` with a two-line `.output-size-trigger` (name + dimensions), a slide-up `.output-size-menu`, grouped `.device-option` rows with `.selected` highlight and dividers, and inline `.custom-size-inputs`. CSS `styles.css:1011–1157`.
- **React:** `LeftSidebar.tsx:1043–1069` — native `<select className="output-size-select">` with `<optgroup>`s; ad-hoc inline W/H inputs (1073–1084).
- **Original:** Rich custom dropdown with two-line entries, dividers, slide-up animation.
- **React:** Plain native select; the legacy `.output-size-*`/`.device-option` CSS is now dead.
- **Recommended fix:** Rebuild using the legacy markup, or record as an accepted simplification (v2 accepted this as M13 — re-confirm).

### MF-2. Duplicate-Screenshot comparison modal reduced to a plain text dialog
- **Severity:** High
- **language-utils.js:** `showDuplicateDialog` (455–525) renders existing vs new thumbnails, both filenames, the language flag+name, and Replace / Create New / **Ignore** buttons; skip value is `'ignore'`. CSS `.duplicate-comparison`/`.duplicate-option` (`styles.css:2990–3102`).
- **React:** `showDuplicateUploadDialog` (`LeftSidebar.tsx:204–234`) builds a text-only modal "Duplicate Translation Image" with **Skip** / Create New / Replace buttons; skip value `'skip'`.
- **Original:** Side-by-side thumbnail comparison with language display.
- **React:** No thumbnails/filenames/language, different button wording; the comparison CSS is dead.
- **Recommended fix:** Reproduce the `duplicate-screenshot-modal` layout and the Replace/Create New/Ignore labels.

### MF-3. Migration modal ("Old Project Format Detected") has no React UI
- **Severity:** Medium
- **legacy index.html:** 1584–1600 — a dedicated migration modal surfaced when an old-format project loads.
- **React:** The migration *logic* exists (`projectStore` detection + `App.tsx:186–189` "Save Converted Project"), but no audit pass found the legacy-styled migration modal markup.
- **Recommended fix:** Verify a migration prompt actually renders; if not, port the modal.

### MF-4. Magical-Titles progress overlay & phased status missing
- **Severity:** Low–Medium
- **magical-titles.js:** 348–372 — a dedicated spinning-star overlay with phased status ("Sending screenshots to AI…", "Processing response…", "Applying titles…") and a "Using <provider>" line.
- **React:** `AllModals.tsx:509–545` sets inline status text only; no overlay, no phases, no provider line.
- **Recommended fix:** Add the overlay/phases or record as an accepted deviation.

### MF-5. Settings affordances partially missing (eye-icon toggle, section structure, link/label copy)
- **Severity:** Medium
- **legacy index.html:** 1639–1782 — `.settings-section` cards, a radio provider selector, per-provider `.settings-show-key` **eye toggle**, `.settings-key-status` (`'✓ API key is saved'` on open), `.settings-model-select`, "Get your API key from Anthropic Console/OpenAI Platform/Google AI Studio" links, an "Appearance" row, and a header with a close (×) button.
- **React:** `Modals.tsx:171–336` — button-group provider selector (not radios), a text "Show/Hide" button (not the eye icon), link text "Get your API key from Claude/OpenAI/Google", "Theme" label (not "Appearance"), on-open status `'API key saved'` (not `'✓ API key is saved'`), no header close (×). Provider names/order, theme order, and default `auto` are correct.
- **Recommended fix:** Restore the eye-icon toggle, section titles ("Claude API Key"), exact link text, "Appearance" label, on-open status string, and the header close button — or rebuild with the legacy `.settings-*` markup.

### MF-6. "All" font tab does not call the Google Fonts API / popularity sort / API-key setting
- **Severity:** Medium
- **app.js:** `fetchAllGoogleFonts` (860–1103) fetches the live popularity-sorted list (optionally with `settings.googleFontsApiKey`), with a curated offline fallback. Per-option "Loading…" indicator (1260, 1268–1269).
- **React:** `FontPicker.tsx:50, 202–206` uses a static alphabetical `ALL_FONT_FALLBACKS`; no API, no key setting, no per-option loading indicator.
- **Note:** v2 accepted offline-first (M15). Re-confirm the decision; the popularity order, API-key setting, and loading indicator are still missing.

### MF-7. Live theme preview on Settings theme-button click
- **Severity:** Medium
- **app.js:** 4209 — theme buttons call `applyTheme(...)` immediately (live preview), independent of Save.
- **React:** `Modals.tsx:255–259` theme buttons only set local state; the theme is applied only in `handleSave`.
- **Recommended fix:** Apply the theme to `document.documentElement` on click.

### MF-8. Device/Element color controls missing hex text inputs
- **Severity:** Medium
- **legacy index.html:** Shadow color hex (`shadow-color-hex`, 717–722); element icon color hex (1156–1159), frame color hex (1303–1306), icon shadow color hex (1184–1186), validated by `/^#[0-9a-fA-F]{6}$/` (app.js 2892–2906).
- **React:** `DevicePanel.tsx:258–263` (shadow) and `ElementsPanel.tsx:380, 398, 448` (frame/icon/icon-shadow) use only `<input type="color">`.
- **Recommended fix:** Add validated hex text inputs (mirror the pattern already in PopoutsPanel).

### MF-9. Empty-state "no screenshots" placeholder in the list region
- **Severity:** Low
- **app.js:** `updateScreenshotList` (6405–6406) toggles a dedicated empty-state element.
- **React:** `LeftSidebar.tsx` renders nothing when the list is empty.
- **Recommended fix:** Add the placeholder if the legacy list region showed one.

---

## Incorrect or Broken Functionality

### IB-1. Popout selection not shared between canvas drag and the Popouts panel
- **Severity:** High
- **app.js:** Canvas popout mousedown (3078–3089) sets global `selectedPopoutId`, refreshes the list/properties, and activates the Popouts tab; the list highlights `p.id === selectedPopoutId` (3255).
- **React:** `CanvasArea.tsx:361–376` switches to the Popouts tab and clears `selectedElementId` but never sets a shared popout id; `PopoutsPanel` keeps `selectedPopoutId` as local `useState` (47); the store has no `selectedPopoutId`.
- **Original:** Dragging a popout selects it in the panel and populates the crop editor.
- **React:** Dragging a popout only switches tabs; the panel's selection is unchanged.
- **Recommended fix:** Promote `selectedPopoutId` into `appStore` (as was done for `selectedElementId`) and wire both canvas and panel to it.

### IB-2. Non-legacy per-language flag selector added to the Text panel
- **Severity:** High
- **app.js:** `updateHeadlineLanguageUI`/`updateSubheadlineLanguageUI` (5171–5177) are explicit no-ops ("Language flag UI removed — translations now managed through translate modal"). The legacy Text panel has no inline language switcher.
- **React:** `TextPanel.tsx:137–156` (headline) and 234–253 (subheadline) render a `projectLanguages.map(...)` row of flag/lang buttons when `projectLanguages.length > 1`.
- **Original:** One language edited inline; others via the Translate modal.
- **React:** Adds a language-switch strip and per-field language-switch workflow not present in the source.
- **Recommended fix:** Remove the language-button rows (or document as an intentional addition).

### IB-3. `getEffectiveLayout` lacks create-on-read seeding from the active layout language
- **Severity:** Medium
- **app.js:** `getEffectiveLayout`/`getTextLanguageSettings` (223–250) create `languageSettings[lang]` on read by copying the source language (`currentLayoutLang || currentHeadlineLang || currentSubheadlineLang || 'en'`).
- **React:** `renderer.ts:398–419` does `languageSettings?.[lang] || languageSettings?.['en']` then flat globals — no source-language copy; falls back to `'en'` rather than the active layout language.
- **Original:** A newly-requested language inherits the user's tuned sizes/position from the current layout language.
- **React:** Un-seeded languages fall back to `en`/global defaults, so export of such a language can use wrong sizes/offset. (Mitigated for in-app languages because `normalizeTextSettings` pre-seeds headline∪subheadline languages, but not arbitrary project/export languages.)
- **Recommended fix:** Replicate create-on-read seeding from the active layout language, or seed `languageSettings[lang]` for every project/export language and change the fallback from `['en']` to the active layout language.

### IB-4. `getTextLayoutLanguage` precedence simplified in the renderer
- **Severity:** Low
- **app.js:** `getTextLayoutLanguage` (216) returns `currentLayoutLang`, else (headline enabled) `currentHeadlineLang`, else `currentSubheadlineLang`.
- **React:** `renderer.ts:440` uses `text.currentLayoutLang || headlineLang`.
- **React:** When `currentLayoutLang` is unset and the headline is disabled but the subheadline enabled, React picks the headline language for layout where legacy picks the subheadline language.
- **Recommended fix:** Replicate the full precedence.

### IB-5. 3D preview frame color not restored after a per-screenshot/side/export render
- **Severity:** High
- **three-renderer.js:** `renderThreeJSForScreenshot` (1117–1123) re-applies the *currently selected* screenshot's `frameColor` after rendering another screenshot, undoing the temporary recolor.
- **React:** `useThreeJS.renderForScreenshotInternal` (638–653) restores material/size/background/position/scale/rotation but never restores frame color on the active model.
- **React:** Exporting/side-previewing a screenshot whose `frameColor` differs leaves the live preview model recolored.
- **Recommended fix:** After restoring transforms, when `useCurrentModel`, re-apply the active screenshot's `frameColor`.

### IB-6. Frame color and screen texture not applied at the end of model load
- **Severity:** Medium
- **three-renderer.js:** `finishCurrentModelLoad` applies `ss.frameColor` (258–260) and calls `updateScreenTexture()` (262–264) synchronously on load completion.
- **React:** `useThreeJS.finishModelLoad` (390–433) does neither; frame color and texture arrive later via effects/polling.
- **React:** Brief flash of an un-colored model / placeholder `0x111111` screen on first 3D load; relies on the retry loop.
- **Recommended fix:** Apply `ss.frameColor` (defaulting to the first preset) and call `updateScreenTexture(currentImage)` at the end of `finishModelLoad`.

### IB-7. Crop preview reshapes the canvas instead of letterboxing
- **Severity:** Medium
- **app.js:** `updateCropPreview` (3412–3486) keeps a fixed-size canvas and letterboxes the image via `getCropPreviewLayout` (3392–3410), offsetting the crop rect by `drawX/drawY`; hit-testing and drag deltas use `drawW/drawH`.
- **React:** `PopoutsPanel.tsx:259–314` resizes the canvas to the image aspect and draws the image filling it; crop rect uses the full canvas.
- **React:** Visually similar when the canvas matches the image aspect, but the implementations are not equivalent (different rendered height and handle hit zones).
- **Recommended fix:** Port the legacy letterbox layout, or document the reshaped-canvas approach as a verified deviation.

### IB-8. `formatValue` always emits one decimal; legacy strips `.0`
- **Severity:** Medium
- **app.js:** `formatValue` (613–616) returns the integer string for whole numbers, else `toFixed(1)`.
- **React:** `PopoutsPanel.tsx:63` always `value.toFixed(1)`, so every popout value label shows `30.0%` instead of `30%`. The list crop label (334) uses `formatValue` where legacy uses `Math.round` (3276).
- **Recommended fix:** `const r = Math.round(v*10)/10; return Number.isInteger(r) ? String(r) : r.toFixed(1);` and use `Math.round` for the list crop label.

### IB-9. Per-field Translate "Apply" cannot clear a translation; element text sync differs
- **Severity:** Medium
- **app.js:** `applyTranslations` (5263–5301) writes the textarea value to **every** target language unconditionally (including empties), sets `subheadlineEnabled = true` for the subheadline path, resolves element text via `getElementText(el)`, and syncs inputs.
- **React:** `TranslateModal.handleApply` (`AllModals.tsx:166–191`) only writes where `if (text)` is truthy (so emptying a field is impossible) and resolves element text via a different fallback chain.
- **Recommended fix:** Write all target values unconditionally and resolve element `text` via the same logic as `getElementText`.

### IB-10. Control-panel input ranges/types diverge
- **Severity:** Medium (cluster)
- **Icon stroke width:** legacy `min 0.5 max 4 step 0.25` (index.html 1164) vs React `min 1 max 5 step 0.5` (`ElementsPanel.tsx:403`).
- **Element font size:** legacy `<input type="number" min 12 max 300>` (1265) vs React `<input type="range" min 10 max 200>` (`ElementsPanel.tsx:340`) — large sizes unreachable.
- **Icon shadow blur:** legacy `max 100` (1191) vs React `max 50` (`ElementsPanel.tsx:421`).
- **Recommended fix:** Align ranges/types to legacy.

### IB-11. Icon picker eager-loads via unpkg `<img>` with `filter:invert(1)`; legacy lazy-loads inline colorized SVG
- **Severity:** Medium
- **app.js:** `renderIconGrid`/`loadIconPreview` (8516–8643) lazy-load each icon via `IntersectionObserver`, inject inline `currentColor` SVG, debounce search 200 ms.
- **React:** `AllModals.tsx:835–840` eager `<img src="https://unpkg.com/...">` for the whole list, `filter:invert(1)` (breaks in light theme), debounce 150 ms.
- **Recommended fix:** Lazy-load, fetch+inline-colorize with `currentColor`, set debounce to 200 ms.

### IB-12. Various AI alert/status strings and branches differ
- **Severity:** Medium (cluster)
- Translate-All success/error: legacy `'Successfully translated N text(s)!'` (blocking alert) + a `Failed to fetch` → "Connection failed. Check your API key in Settings." branch + `'Invalid API key. Update it in Settings (gear icon).'` (app.js 5848–5860). React (`AllModals.tsx:380–383`) uses inline status, auto-closes at 700 ms, lacks the Failed-to-fetch branch, and uses different AI_UNAVAILABLE wording.
- Magical Titles pre-flight/success/error: legacy alerts "Please add some screenshots first." / "Please configure your AI API key in Settings first." and a success `Generated titles for N screenshots in <Language>!` plus a distinct `SyntaxError` message (magical-titles.js 244–274, 445–457). React (`AllModals.tsx:491–552`) uses different inline strings, no count/language in success, no SyntaxError branch.
- Per-field translate progress text lacks the "...with <provider>..." and the Failed-to-fetch branch.
- **Recommended fix:** Match the legacy strings/branches.

### IB-13. Gemini model display labels differ
- **Severity:** Low
- **llm.js:** 35–36 — `'Gemini 3 Flash (Preview) ($$)'`, `'Gemini 3 Pro (Preview) ($$$)'`.
- **React:** `Modals.tsx:102–103` — `'Gemini 3 Flash Preview ($$)'`, `'Gemini 3 Pro Preview ($$$)'` (missing parentheses). Model IDs/order are correct.
- **Recommended fix:** Match label strings exactly.

### IB-14. Export per-frame settle delay reduced (100 ms → 0 ms)
- **Severity:** Medium (verify)
- **app.js:** `exportAllForLanguage` (8304) / `exportAllLanguages` (8376) await `setTimeout(resolve, 100)` between frames so the canvas/3D render settles before `toDataURL`.
- **React:** `yieldToBrowser` (`LeftSidebar.tsx:506`) uses `setTimeout(resolve, 0)`.
- **React:** Faster, but if the render isn't fully awaited (especially 3D) it risks capturing an un-settled frame.
- **Recommended fix:** Confirm the 3D export render is fully awaited/synchronous; otherwise restore ~100 ms.

### IB-15. `getCanvasDimensions` adds an iPhone-6.9″ fallback the original lacks
- **Severity:** Low
- **app.js:** 6969 — no fallback for unknown device ids.
- **React:** `renderer.ts:34` falls back to `{1290, 2796}`.
- **Recommended fix:** Acceptable safety improvement; document, or drop for strict parity.

### IB-16. Screen-plane counter-rotation (`-modelRotation`) not applied (latent)
- **Severity:** Low (dormant)
- **three-renderer.js:** `createScreenOverlay` (739) / `buildCachedModel` (314) set `screenPlane.rotation = -modelRot`.
- **React:** `useThreeJS.finishModelLoad` (417) / `buildRenderableModel` (495) set only `screenPlane.position`. All current `modelRotation` are `{0,0,0}`, so this is a no-op today but would tilt the screen texture if a device gains a non-zero base rotation.
- **Recommended fix:** Set `screenPlane.rotation` to `-modelRot` (radians).

---

## UI / Visual Differences

### UV-1. Modal entrance animation and overlay fade removed
- **Severity:** Medium
- **styles.css:** `.modal-overlay` fades `opacity 0→1` + `visibility` via a `.visible` class; `.modal` scales `0.9→1` driven by the overlay (1199–1235).
- **React:** `src/styles.css:3431–3473` forces `.modal-overlay { display:flex !important; opacity:1 !important; visibility:visible !important }` (no fade) and uses a `modal-scale-in` keyframe; no overlay fade, no exit animation.
- **Recommended fix:** Restore the overlay fade (or add an opacity transition); keep scale at 0.2s ease.

### UV-2. Modal button class system replaced; default destructive red lost
- **Severity:** Medium
- **styles.css:** `.modal-btn-cancel` / `.modal-btn-confirm` (**red `#ff453a`** by default) / `.modal-btn-primary`, equal-width via `.modal-btn { flex:1 }` (1268–1309).
- **React:** `src/styles.css:3491–3533` uses `.modal-btn.primary/.secondary/.danger`; React JSX never emits `.modal-btn-confirm`. Destructive red is opt-in via `.danger`, chosen heuristically (`LeftSidebar.tsx:260` only when confirm text contains "delete").
- **Recommended fix:** Settle on one button system; ensure destructive confirms render red and primary confirms accent, matching each legacy modal. The legacy `.modal-btn-confirm/-cancel/-primary` selectors are now dead.

### UV-3. About modal: title, icon, body copy differ; fabricated Credits list; wrong yuzuhub link
- **Severity:** High
- **legacy index.html:** 1784–1802 — title "App Store Screenshot Generator"; `img/info.svg` icon on a purple gradient circle; "A free vibe coded tool…"; "Created by Stefan from yuzuhub.com" → `https://yuzuhub.com/en`; MIT line; **Live Version** + **GitHub Repo** links; **no** credits list.
- **React:** `Modals.tsx:27–67` — title "About App Store Screenshot Generator"; inline custom SVG (not `info.svg`); reworded body; link to `https://yuzuhub.com` (missing `/en`); **adds a Credits/3D-model attribution list** not in legacy; omits the Live/GitHub links.
- **Recommended fix:** Restore title/body/icon/links exactly (including `/en` and the Live/GitHub links); remove the Credits block (or confirm it as an intentional addition).

### UV-4. Settings & Languages modals rebuilt with non-legacy markup
- **Severity:** High
- See MF-5 (Settings) and CR-2 (Languages behavior). Visually: no header close (×), inline-styled cards instead of `.settings-section`/`.languages-modal`/`.language-item`/`.remove-btn`/`.current-badge`; Languages title "Languages" vs legacy "Project Languages"; description copy differs; Add via explicit button vs legacy add-on-select-change.
- **Recommended fix:** Rebuild with the legacy markup/classes/titles, or document each deviation.

### UV-5. Position presets: SVG-diagram cards → text buttons; wrong column count & placement
- **Severity:** High
- **legacy index.html:** 586–649 — `.preset-dropdown` containing a 4-column `.preset-positions` of `.position-preset` cards, each an SVG device-position diagram + label, with `.active` styling; placed above the scale/position sliders.
- **React:** `DevicePanel.tsx:192–207` — a 3-column `.preset-grid` of text-only `.preset-btn`, no SVG, no active styling, placed at the bottom of the 2D block (and colliding with the gradient `.preset-grid`, see CR-5).
- **Recommended fix:** Restore the `.position-preset` SVG cards in a 4-col dropdown above the sliders, and rename the colliding grid class.

### UV-6. Screenshot list item / thumbnail sizing redefined
- **Severity:** Low–Medium
- **styles.css:** `.screenshot-item` padding `6px 8px`, radius 6px, 2px border (301–321); `.screenshot-thumb` bare `24×42` img (323–329).
- **React:** `src/styles.css:3059–3098` overrides to padding `8px 12px`, radius 8px, 1px border, `min-height:82px`; thumb `36×64` framed wrapper. Also adds an always-present `.screenshot-actions` hover row (duplicate/more/delete) not in legacy (which had a single 3-dot menu button).
- **Recommended fix:** Reconcile the duplicate `.screenshot-item`/`.screenshot-thumb` blocks; decide whether the extra hover actions are an accepted enhancement.

### UV-7. Menu icons use emoji instead of legacy SVGs; menu ordering/labels differ
- **Severity:** Medium
- **Language menu:** legacy "Edit Languages…" then "Translate All…" each with a stroked SVG and dividers (index.html 90–103); React "✨ Translate All…" then "🌐 Edit Languages…" with emoji (`LeftSidebar.tsx:865–870`).
- **Screenshot context menu:** legacy `.screenshot-menu-item` with SVG icons and a fixed item set (Manage Translations…, Replace Screenshot…, Copy style from…, Apply style to all…, Duplicate, Remove); React uses emoji icons, renames items, adds a non-legacy "Set as Default Style", reorders, and gates "Screenshot Translations" on `projectLanguages.length > 1` (`LeftSidebar.tsx:997–1019`).
- **Recommended fix:** Use the legacy SVG icons, item set, labels, and order; remove "Set as Default Style"; don't gate Manage Translations on language count.

### UV-8. Export Language modal title/copy/icon differ
- **Severity:** Medium
- **legacy index.html:** 1860–1888 — title "Export Screenshots", message "Choose which language versions to export.", a modal icon, option descriptions "🇺🇸 English" / "Separate folder per language".
- **React:** `LeftSidebar.tsx:1129–1148` — title "Export Options", no message/icon, different descriptions.
- **Recommended fix:** Match title/message/icon/descriptions.

### UV-9. Apply-Style-to-All confirm is a generic dialog, not the legacy modal
- **Severity:** Medium
- **app.js / legacy index.html:** `apply-style-modal` (1542–1557) — icon, title "Apply Style to All?", message "This will copy the background, device, and text settings from this screenshot to all other screenshots. This cannot be undone.", buttons Cancel / Apply to All.
- **React:** `handleApplyStyleToAll` (`LeftSidebar.tsx:814–823`) uses a generic confirm with different copy and an "Apply Style" button.
- **Recommended fix:** Render the dedicated modal with the exact icon/title/message/button.

### UV-10. Delete-Project confirm copy/guard differ
- **Severity:** Low–Medium
- **app.js:** `delete-project-modal` message `Are you sure you want to delete "{name}"? This cannot be undone.`; single-project guard `"Cannot delete the only project"` (3906–3915).
- **React:** `LeftSidebar.tsx:637–645` generic confirm with shorter copy; guard `"At least one project must remain."`.
- **Recommended fix:** Match the legacy modal and strings.

### UV-11. Text-element fallback thumbnail uses the wrong glyph
- **Severity:** Low
- **app.js:** `updateElementsList` (2536–2538) uses a "T" type-tool SVG.
- **React:** `ElementsPanel.tsx:255–261` uses a list/paragraph SVG.
- **Recommended fix:** Use the legacy "T" paths.

### UV-12. Frame badge option labels swapped
- **Severity:** Low
- **legacy index.html:** 1295–1296 — "Circle Badge", "Shield Badge".
- **React:** `ElementsPanel.tsx:372–373` — "Badge Circle", "Badge Ribbon" (values match).
- **Recommended fix:** Rename labels.

### UV-13. Translate buttons are full-width labeled buttons vs legacy inline wand icon
- **Severity:** Low
- **legacy index.html:** 815–824, 938–945 — small `magic-translate-btn` icon on the textarea (`textarea-with-button`).
- **React:** `TextPanel.tsx:208–214, 312–318` — full-width "✨ Translate Headline/Subheadline" buttons.
- **Recommended fix:** Use the `textarea-with-button` + icon button markup.

### UV-14. Misc control labels/order
- **Severity:** Low
- Device control order: legacy corner-radius before rotation, "Tilt / Rotation" label, frame-color mid-panel; React swaps rotation/corner-radius and relabels (`DevicePanel.tsx`). FontPicker tab order legacy "Popular, System, All" vs React "System, Popular, All" (`FontPicker.tsx:232–234`). Per-language layout toggle placement/label (`TextPanel.tsx:358–369`). New-project: duplicate-from option labels omit "(N screenshots)" (`LeftSidebar.tsx:1108`), placeholder "Project name" vs legacy "My App Screenshots" with a "Project Name" label, duplicate-from group not hidden when no projects exist.
- **Recommended fix:** Align labels/order/placeholders.

### UV-15. Export progress heading vs status-line structure
- **Severity:** Low
- **legacy index.html:** 1961 — static `<h2>Exporting Screenshots</h2>`; the *status paragraph* toggles to "Complete!".
- **React:** `AllModals.tsx:104` changes the *heading itself* to "Complete!". Timing (1500 ms) and per-language detail strings match.
- **Recommended fix:** Keep the heading static; reflect "Complete!" in the status line.

### UV-16. Screenshot Translations modal description copy differs
- **Severity:** Low
- **legacy index.html:** 1846 — "Upload localized versions of this screenshot for each language."
- **React:** `AllModals.tsx:640–641` — "Manage language-specific images for this screenshot."
- **Recommended fix:** Use the legacy string.

### UV-17. `.add-btn:hover` references undefined `--accent-color` (bug in both)
- **Severity:** Low
- Both stylesheets reference `var(--accent-color)` (the real variable is `--accent`), so the hover border/text color falls back. Present identically in legacy and React (so technically at parity), but worth fixing in both.

---

## Interaction / Workflow Differences

### IW-1. Slide animation fires on every selection change (incl. left-list clicks) and lacks model-await/pre-render
- **Severity:** Medium
- **app.js:** Screenshot-list clicks (6644–6651) set `selectedIndex` and re-render with **no** slide; `slideToScreenshot` (7122–7219) runs only for side-preview clicks (7075/7103) and wheel-swipe, with directional full-width translate, adjacent-model await (`loadCachedPhoneModel` + `Promise.all`), pre-rendered adjacent previews, `skipSidePreviewRender`/`suppressSwitchModelUpdate` flicker suppression, and an `isSliding` re-entrancy guard.
- **React:** `CanvasArea.tsx:60–84` runs a CSS transform on *any* `selectedIndex` change with a fixed 320 ms timer; no direction logic for multi-step jumps, no model await, no pre-render, no flicker suppression, no `isSliding` guard. Adjacent preload exists but isn't synchronized with the slide (127–134).
- **React:** Animation appears where legacy jumps instantly (list clicks), and 3D screenshots can flash an unloaded model mid-slide.
- **Recommended fix:** Gate the slide to adjacent navigation initiated by swipe/side-preview; make it an async sequence that awaits adjacent model loads + animation, pre-renders adjacent previews, then commits the index; add the `isSliding` guard.

### IW-2. Side previews always re-render during transitions (no skip flag)
- **Severity:** Low
- **app.js:** Near previews skip re-render when `skipSidePreviewRender` is set during a slide (7071–7073, 7099–7101).
- **React:** `CanvasArea.tsx:253–264` always re-renders side previews (async for 3D), risking mid-transition repaint.
- **Recommended fix:** Add a skip flag as part of the IW-1 rework.

### IW-3. Transfer-mode UI: missing `transfer-target` class, hint text/label, and `length > 1` gate
- **Severity:** Medium
- **app.js:** `updateScreenshotList` adds the `transfer-target` class to the destination item (6429–6434), shows hint "Select a screenshot to copy style from" only when `transferTarget !== null && screenshots.length > 1` (6417), and changes the target row's device label to "Click source to copy style".
- **React:** `LeftSidebar.tsx:928–939` — never adds `transfer-target`; hint reads "Click a screenshot to copy its style into #N"; shows whenever `transferTarget !== null` (no length gate); doesn't swap the target-row label. (The transfer *direction* logic itself is correct.)
- **Recommended fix:** Add the `transfer-target` class, match the hint/label strings, and gate on `screenshots.length > 1`.

### IW-4. Multi-step jumps and near-preview "feel"
- **Severity:** Low
- Far side previews are correctly display-only in both (no regression). But near-preview clicks and swipe route through the instant `selectScreenshot` rather than the legacy animated `slideToScreenshot`, so the navigation feel differs (ties into IW-1).
- **Recommended fix:** Route adjacent navigation through the slide path.

### IW-5. Escape-to-close added (legacy had none)
- **Severity:** Low (accepted in v2 as W2)
- React adds Escape-to-close for modals/menus; legacy had only a project-name Enter handler and no keyboard shortcuts. Re-confirm as an intentional deviation.

---

## Data / State / Side Effect Differences

### DS-1. `switchGlobalLanguage` over-reaches: sets `currentLayoutLang`, seeds languages, mutates defaults
- **Severity:** Medium
- **app.js:** `switchGlobalLanguage` (4920–4934) sets only `currentHeadlineLang`/`currentSubheadlineLang` on each screenshot; it does not touch `currentLayoutLang`, does not seed `languageSettings`, and does not modify `defaults.text`.
- **React:** `appStore.setCurrentLanguage` (668–691) calls `ensureTextLanguage(...)` (adds languages, seeds empty headline/subheadline, copies a `languageSettings[lang]` layout) and sets `currentHeadlineLang`, `currentSubheadlineLang`, **and** `currentLayoutLang` on every screenshot and on `defaults.text`.
- **React:** Per-language layout edits after a switch land on the newly-switched language key; new `languageSettings` keys get persisted; `defaults` is mutated on a plain language switch.
- **Recommended fix:** Set only the two field pointers per screenshot; don't set `currentLayoutLang`, don't seed, don't mutate defaults.

### DS-2. `addProjectLanguage` eagerly seeds `languageSettings[lang]` and normalizes
- **Severity:** Medium
- **app.js:** `addProjectLanguage` (4998–5033) only extends `headlineLanguages`/`subheadlineLanguages` and seeds empty `headlines[lang]`/`subheadlines[lang]`; no `languageSettings[lang]`, no `normalizeTextSettings`, no source-layout copy (lazy seeding happens at read time via `getTextLanguageSettings`).
- **React:** `ensureTextLanguage` (164–184) calls `normalizeTextSettings` and creates `languageSettings[lang] = {...sourceLayout}` from `state.currentLanguage` (vs legacy's `currentLayoutLang || currentHeadlineLang || currentSubheadlineLang || 'en'` precedence).
- **Recommended fix:** Only extend the arrays and seed empty strings; defer `languageSettings[lang]` creation to read time with the legacy source precedence.

### DS-3. `normalizeTextSettings` back-adds languages from `headlines`/`subheadlines` map keys
- **Severity:** Low
- **app.js:** `normalizeTextSettings` (252–278) builds the language set strictly from `headlineLanguages ∪ subheadlineLanguages` (adds `'en'` only if empty).
- **React:** `appStore.ts:204–221` also unions `Object.keys(headlines)` + `Object.keys(subheadlines)` and back-adds those into the language arrays.
- **React:** A translation present for a language not in the arrays silently expands the project's declared language set.
- **Recommended fix:** Restrict the set to the two language arrays (plus `'en'` only when both empty).

### DS-4. Style transfer preserves extra target fields (language arrays/pointers)
- **Severity:** Medium
- **app.js:** `transferStyle` (6773–6779) / `applyStyleToAll` (6832–6838) restore **only** `headlines`/`subheadlines` from the target; everything else (incl. `headlineLanguages`, `subheadlineLanguages`, `currentHeadlineLang`, `currentSubheadlineLang`, `languageSettings`) comes from the source.
- **React:** `appStore.ts:790–804, 817–832` also preserves the target's `headlineLanguages`, `subheadlineLanguages`, `currentHeadlineLang`, `currentSubheadlineLang`.
- **React:** When source/target language sets differ, the transferred result keeps the target's arrays/pointers instead of the source's.
- **Recommended fix:** Preserve only `headlines`/`subheadlines`; take the rest from the source.

### DS-5. Pure getters don't write normalized shape back to the screenshot
- **Severity:** Low
- **app.js:** `getText`/`getBackground`/`getScreenshotSettings` (191–214) write the normalized object back onto the live screenshot (idempotent upgrade on read; lazy `languageSettings` seeding).
- **React:** `appStore.ts:717–739` returns a normalized copy without mutating the stored screenshot.
- **React:** Persisted shape can differ for screenshots that are viewed but not edited (mostly benign because load-time normalization runs, but the lazy seed in DS-2 doesn't occur on read).
- **Recommended fix:** Accept as a deliberate pure-getter design (document) or ensure load-time normalization reproduces the legacy lazy-seed result.

### DS-6. `customWidth`/`customHeight` defaults inconsistent (1290×2796 vs 1320×2868)
- **Severity:** Medium
- **app.js:** `loadState` fallback and `resetStateToDefaults` use `1320 × 2868` (1945–1946, 2008–2009); legacy HTML inputs default `1290 × 2796`.
- **React:** Store initial/reset use `1290 × 2796` (`appStore.ts:454–455, 751–752`); `projectStore.loadProjectState` falls back to `1320 × 2868` (643–644). So fresh/empty projects get `1290×2796` while loaded projects get `1320×2868`, and the two React sources disagree.
- **Recommended fix:** Pick one canonical value (legacy `resetStateToDefaults` uses `1320×2868`) and use it in both React locations.

### DS-7. Autosave debounce vs save-on-render
- **Severity:** Medium (accepted in v2 as W6)
- **app.js:** `saveState()` runs at the top of every `updateCanvas()` (6977).
- **React:** `App.tsx:93–102` debounces 800 ms, with `beforeunload`/`pagehide`/`visibilitychange` flush (109–132).
- **React:** A crash within 800 ms loses edits legacy would have saved. Documented as intentional; re-confirm.

### DS-8. Icon element persistence uses a baked data URL vs legacy blob URL
- **Severity:** Low (accepted in v2 as D8)
- **app.js:** `getLucideImage` (470–481) creates a transient blob URL; SVG reconstructed from metadata.
- **React:** `ElementsPanel.tsx:53–72` caches raw SVG in localStorage and stores a `data:image/svg+xml,...` URL on `el.src`.
- **Recommended fix:** Re-confirm the round-trip and keep documented.

### DS-9. Emoji picker data is a React-curated fallback (no `emoji-data.js` in repo)
- **Severity:** Low–Medium
- **app.js:** `renderEmojiGrid`/search (8474–8499) read a global `EMOJI_DATA` (rich names/keywords) and **return early** if it's undefined; search dedupes by emoji across all categories.
- **React:** `AllModals.tsx:693–727` defines its own categories with `name: '<cat> emoji'`, `keywords: [cat]`, dedupes within-category only, and the `popular` array has duplicates (🔥, ❤️). No `emoji-data.js` exists, so legacy would show an empty grid here.
- **Recommended fix:** Bundle the real `EMOJI_DATA` for parity, or document the curated fallback (and dedupe across categories).

### DS-10. Replace Screenshot — verified correct
- **Severity:** none
- `handleReplaceScreenshot` (`LeftSidebar.tsx:389–395`) sets both `image` and `localizedImages[currentLanguage]`, matching `replaceScreenshot` (6893–6900). No issue (prior concern resolved).

---

## File-by-File Findings

### `src/stores/appStore.ts`
- DS-1 `setCurrentLanguage` over-reach (668–691); DS-2 `ensureTextLanguage` eager seeding (164–184); DS-3 `normalizeTextSettings` back-adds languages (204–221); DS-4 transfer preserves extra fields (790–804, 817–832); DS-5 pure getters (717–739); CR-4 `duplicateScreenshot` copies elements/popouts (490–513); DS-6 custom dimension defaults (454–455, 751–752). Verified correct: background image preservation (`image: bg.image || null`), span propagation, `addScreenshot` selects only when empty, device-type detection, frame-color defaults/normalization (24–28, 341–342).

### `src/stores/projectStore.ts`
- DS-6 load fallback dimensions (643–644). Verified correct: old-format migration detection (619–623), `migrate3DPosition` (303–312), atomic switch/create/delete ordering (551–569), scalar fallbacks + defaults arrays backfill (624–647), single-project delete guard (503).

### `src/App.tsx` / `src/main.tsx`
- DS-7 debounced autosave + unload flush (93–132); MF-3 verify migration modal renders (186–189). Theme default `auto` and `applyTheme('auto')` deleting `data-theme` verified correct.

### `src/canvas/renderer.ts`
- IB-3 `getEffectiveLayout` seeding (398–419); IB-4 `getTextLayoutLanguage` precedence (440); IB-15 dimension fallback (34). Verified correct: orchestration order, `wrapText` CRLF (79), noise amplitude (254), shadow/perspective/gradient math, field-language text resolution.

### `src/hooks/useCanvas.ts`
- IB-14 export settle delay (via LeftSidebar 506). Verified correct: `getScreenshotImage` full fallback chain (223–246), 3D batch/all-language export renders 3D (172–213), snap-guide overlay style (33–54).

### `src/hooks/useThreeJS.ts`
- IB-5 frame color not restored after render (638–653); IB-6 frame color + texture not applied at load (390–433); IB-16 screen-plane counter-rotation (417, 495). Verified correct: same-device load guard (348), per-frame texture rebuild (602–639), 3D position/scale/rotation math (619–625, 707–727), init when *any* screenshot is 3D.

### `src/components/Layout/CanvasArea.tsx`
- CR-1 3D overlay blocks interaction & shows raw 3D (165–174, 489–493); IB-1 popout selection not shared (361–376); IW-1 slide on every change (60–84); IW-2 side-preview re-render (253–264). Verified correct: shared `selectedElementId` (381), hit-test layer order (316–319), popout-before-element priority (342–347), snap threshold/drag math, far-preview display-only, hover cursor (masked in 3D by CR-1).

### `src/components/Layout/LeftSidebar.tsx`
- CR-4 new-screenshot popouts (488); IW-3 transfer-mode class/hint/gate (928–939); MF-1 output dropdown (1043–1069); MF-2 duplicate dialog (204–234); IB-14 export delay (506); UV-7 menu emoji/order/items (865–870, 997–1019); UV-8 export modal (1129–1148); UV-9 apply-style modal (814–823); UV-10 delete modal (637–645); UV-14 project modal text (1093–1108); IB-12 magical-titles tooltip timing (130–152). Verified correct: drag-drop import, replace screenshot, sequential import, filename matching, device detection, undetected-lang default 'en', drag-reorder direction/drop math, backup import reload + error alerts, "(Copy)" auto-fill, far-preview non-click.

### `src/components/Controls/TextPanel.tsx`
- IB-2 non-legacy language-flag selector (137–156, 234–253); UV-13 translate button style (208–214, 312–318); UV-14 per-language-layout toggle placement/label (358–369). Verified correct: per-language layout storage keys (`setLangSetting` 99–112), `getTextLayoutLanguage` (67–72).

### `src/components/Controls/DevicePanel.tsx`
- MF-8 shadow hex input (258–263); UV-5 position presets type/placement (190–211); UV-14 control order/labels. Verified correct: frame-color default/highlight/device-switch reset, all slider ranges for scale/x/y/rotation/cornerRadius/3D rotations.

### `src/components/Controls/ElementsPanel.tsx`
- MF-8 icon/frame/icon-shadow hex inputs (380, 398, 448); IB-10 icon stroke range (403), font-size type/range (340), icon shadow blur (421); UV-11 text thumbnail glyph (255–261); UV-12 badge labels (372–373); DS-8 icon persistence (53–72). Verified correct: icon colorization touches stroke only (68–70).

### `src/components/Controls/PopoutsPanel.tsx`
- IB-7 crop-preview reshape vs letterbox (259–314); IB-8 `formatValue` decimals (63, 334). Verified correct: localized source image (59), hex inputs + validation (499–508, 548–557), `collapsed` row class (451, 516), crop cursors (116–129), interdependent maxes (352–376), edge-pinning (188–199).

### `src/components/Controls/BackgroundPanel.tsx`
- CR-5 gradient `.preset-grid` clobbered to 3 cols (CSS). Verified correct: gradient stop delete only `i > 1` with SVG glyph, add-stop, presets, angle, image upload + span, noise/overlay/blur.

### `src/components/UI/FontPicker.tsx` / `fontCatalog.ts`
- MF-6 no API/popularity/key + missing loading indicator (50, 202–206); UV-14 tab order (232–234). Verified correct: shared cache, multi-weight load, stylesheet await, portaled dropdown, font lists, 100-option cap.

### `src/components/Modals/Modals.tsx`
- CR-2 Languages remove-English/staged-commit (378–381, 389–443, 457); MF-5 Settings affordances (171–336); MF-7 live theme preview (255–259); UV-3 About modal (27–67); UV-4 settings/languages markup; IB-13 Gemini labels (102–103). Verified correct: provider names/order/storage keys/model IDs, theme order, default `auto`.

### `src/components/Modals/AllModals.tsx`
- CR-3 AI prompts (222–234, 348–360, 513–527); IB-9 per-field apply (166–191); IB-11 icon picker (835–840); IB-12 alert strings (380–383, 491–552); MF-4 magical-titles overlay (509–545); UV-15 export heading (104); UV-16 translations modal copy (640–641); DS-9 emoji data (693–727). Verified correct: OpenAI `max_completion_tokens` (16384/4096), export timing (1500 ms), AI_UNAVAILABLE mapping.

### Stylesheet (`src/styles.css`)
- CR-5 `.preset-grid` collision; UV-1 modal animation override (3431–3473); UV-2 button system (3491–3533); UV-6 screenshot item/thumb overrides (3059–3098); CR-1 `#threejs-container` overlay (972–986); UV-17 `--accent-color` typo. Dead/shadowed legacy selectors: `.output-size-*`, `.device-option`, `.modal-btn-confirm/-cancel/-primary`, `.duplicate-comparison/.duplicate-option`, `.settings-section/.settings-provider-option/.settings-show-key/.settings-model-select/.settings-link`, `.languages-modal/.language-item/.remove-btn/.current-badge`, `.position-preset/.preset-positions`. Conflicting double-definitions (later React block wins): `.preset-grid`, `.screenshot-item`, `.screenshot-thumb`, `.modal`, `.modal-overlay`, `.toggle`, `.element-item`, `.popout-item`, `.control-row`.

### Legacy reference (source of truth)
- `app.js`, `three-renderer.js`, `language-utils.js`, `magical-titles.js`, `llm.js`, `legacy_index_reference.html` (git `45086a5^`), root `styles.css`.

---

## Recommended Fix Order

**Phase 1 — Functional regressions (Critical/High):**
1. CR-1 — fix the 3D `#threejs-container` overlay so canvas interaction and the composite preview work in 3D mode.
2. CR-2 — allow removing English in the Languages modal; reconcile the live-apply vs staged-commit model.
3. CR-4 — `popouts: []` for new screenshots; decide/duplicate elements+popouts policy.
4. IB-1 — share `selectedPopoutId` between canvas and panel.
5. IB-5/IB-6 — restore 3D frame-color and texture application on render/load.

**Phase 2 — AI & data correctness (High/Medium):**
6. CR-3 — restore the three AI prompts and the Translate-All response contract.
7. IB-9, IB-12, IB-13 — per-field apply, alert strings/branches, Gemini labels.
8. DS-1/DS-2/DS-3/DS-4 — language-cascade/normalize/transfer field scope; DS-6 dimension defaults.
9. IB-3/IB-4 — per-language layout seeding + layout-language precedence in the renderer.

**Phase 3 — Control panels & interaction (Medium):**
10. CR-5 — rename the colliding `.preset-grid`; UV-5 restore position-preset cards.
11. MF-8, IB-10 — hex inputs + range/type fixes across Device/Element panels.
12. IB-7, IB-8 — crop letterbox + `formatValue` decimals.
13. IB-2 — remove the non-legacy Text-panel language selector.
14. IW-1/IW-2/IW-3 — slide animation gating + transfer-mode UI.

**Phase 4 — UI/modal parity (Medium):**
15. MF-1/MF-2/MF-3 — output dropdown, duplicate-comparison modal, migration modal.
16. MF-5/UV-4 — Settings & Languages modal markup; MF-7 live theme preview.
17. UV-3 — About modal copy/links/icon/credits.
18. UV-1/UV-2 — modal animation + button system; UV-8/UV-9/UV-10 modal copy.

**Phase 5 — Cosmetic & cleanup (Low):**
19. UV-6/UV-7/UV-11/UV-12/UV-13/UV-14/UV-15/UV-16/UV-17, IB-11, IB-14/IB-15/IB-16, MF-4/MF-6/MF-9, DS-5/DS-7/DS-8/DS-9, IW-4/IW-5. Decide/record accepted deviations (output dropdown, offline fonts, Escape-to-close, duplicate-copy policy, pure getters, autosave debounce, icon persistence).
20. Stylesheet cleanup: remove dead legacy selectors or consolidate the double-definitions.

---

## Detailed Checklist

### Critical
- [x] CR-1 Hide/`pointer-events:none` the `#threejs-container`; restore 3D canvas interaction + composited preview.
- [x] CR-2 Allow removing English (`languages.length <= 1` guard only); reconcile live-apply/staged-commit + switch-on-remove.
- [x] CR-3 Restore exact Magical-Titles, Translate-All, and per-field prompts; revert Translate-All JSON keys to numeric indices.
- [x] CR-4 `popouts: []` for new screenshots; duplicate elements/popouts kept (documented accepted deviation).
- [x] CR-5 Position presets use legacy `.preset-positions` markup; removed the colliding 3-col `.preset-grid` override (gradient swatches back to 5 cols).

### High
- [x] IB-1 Promote `selectedPopoutId` into the store; wire canvas ↔ panel.
- [x] IB-2 Remove the non-legacy Text-panel per-language flag selector.
- [x] IB-5 Restore active-model frame color after per-screenshot 3D render.
- [x] MF-1 Rebuild the custom output-size dropdown.
- [x] MF-2 Rebuild the Duplicate-Screenshot comparison modal (Replace/Create New/Ignore + thumbnails).
- [x] MF-5 Restore Settings eye-toggle, section markup, link/label copy, on-open status, header close.
- [x] UV-3 Restore About modal title/body/icon/links; remove fabricated Credits.
- [x] UV-4 Rebuild Settings & Languages modals with legacy markup/classes/titles.
- [x] UV-5 Restore position-preset SVG cards above the sliders (always-expanded; collapse toggle deferred).

### Medium
- [x] IB-3 Replicate per-language layout create-on-read seeding from the active layout language.
- [x] IB-4 Replicate full `getTextLayoutLanguage` precedence.
- [x] IB-6 Apply frame color + screen texture at end of `finishModelLoad`.
- [x] IB-7 Port crop-preview letterbox layout.
- [x] IB-8 Fix `formatValue` to strip `.0`; use `Math.round` for the list crop label.
- [x] IB-9 Per-field apply: write all target langs unconditionally; enable subheadline; resolve element text via `getElementText`.
- [x] IB-10 Align icon stroke (0.5–4/0.25), element font-size (number 12–300), icon shadow blur (max 100).
- [~] IB-11 Icon picker: 200 ms debounce + `loading="lazy"` + theme-aware color done; full inline `currentColor` SVG/IntersectionObserver deferred (residual).
- [x] IB-12 Match Translate-All/Magical-Titles/per-field alert strings + Failed-to-fetch/SyntaxError branches.
- [x] IB-14 Confirmed 3D export render is awaited — `0 ms` settle is correct (accepted).
- [x] MF-3 Migration modal already renders in `App.tsx`.
- [x] MF-7 Apply theme live on Settings theme-button click.
- [x] MF-8 Add hex inputs to Device shadow + Element icon/frame/icon-shadow colors.
- [x] DS-1 `setCurrentLanguage`: set only field pointers; don't touch `currentLayoutLang`/defaults/seeding.
- [x] DS-2 `addProjectLanguage`: extend arrays + empty strings only; defer `languageSettings` to read time.
- [x] DS-4 Style transfer: preserve only `headlines`/`subheadlines` from target.
- [x] DS-6 Reconcile `customWidth`/`customHeight` defaults to `1320×2868`.
- [~] IW-1 Slide gated to adjacent navigation + `isSliding` guard; async pre-render/model-await deferred (residual).
- [x] IW-3 Add `transfer-target` class, legacy hint/label, `length > 1` gate.
- [x] UV-1 Restore modal overlay fade animation.
- [x] UV-2 Consolidated modal button system (`.primary/.secondary/.danger`, destructive red) — accepted.
- [x] UV-7 Menu SVG icons + legacy order/items/ungated translations ("Set as Default Style" kept last as documented extra).
- [x] UV-8 Match Export Language modal title/message/icon/descriptions.
- [x] UV-9 Restore the Apply-Style-to-All modal (icon/title/message/button).
- [x] UV-10 Match Delete-Project modal copy + single-project guard string.

### Low
- [x] IB-13 Match Gemini display labels exactly.
- [x] IB-15 `getCanvasDimensions` fallback documented (accepted safety addition).
- [x] IB-16 Set screen-plane `-modelRotation` (latent).
- [x] DS-3 Stop back-adding languages from headline/subheadline map keys.
- [x] DS-5 Pure getters documented as intentional (accepted).
- [x] DS-9 Curated emoji fallback documented + deduped across categories.
- [x] MF-4 Added Magical-Titles progress overlay/phases.
- [x] MF-6 Offline-first fonts accepted; added loading indicator + tab order.
- [x] MF-9 Empty-state covered by the canvas "Upload screenshots" overlay (accepted).
- [x] UV-6 Screenshot list restyle + hover-actions kept as intentional enhancement (accepted).
- [x] UV-11 Text-element thumbnail "T" glyph.
- [x] UV-12 Frame badge labels "Circle Badge"/"Shield Badge".
- [x] UV-13 Inline wand `magic-translate-btn` instead of full-width buttons.
- [x] UV-14 Align device control order/labels, FontPicker tab order, per-language-layout toggle, project-modal copy.
- [x] UV-15 Static export heading + status-line "Complete!".
- [x] UV-16 Screenshot Translations description copy.
- [x] UV-17 Fix `--accent-color` → `--accent` in `.add-btn:hover`.
- [~] IW-2 Side-preview skip-during-slide deferred (residual, low).
- [x] IW-4 Adjacent (±1) navigation now animates via the gated slide.
- [x] IW-5 Escape-to-close documented as intentional (accepted).
- [x] DS-7 Autosave debounce + unload flush documented as intentional (accepted).
- [x] DS-8 Icon data-URL persistence documented as intentional (accepted).
- [~] Stylesheet: removed the colliding `.preset-grid` override; full dead-selector sweep deferred (no runtime effect).

### Verified resolved since v2 (do not re-open)
- [x] Style-transfer direction & target-text preservation; elements transfer.
- [x] `normalizeBackgroundSettings` preserves the in-memory image; span propagation.
- [x] Legacy old-format migration + `migrate3DPosition`.
- [x] `addProjectLanguage` cascade onto screenshots/defaults (modulo DS-2 seeding nuance).
- [x] Shared `selectedElementId` (canvas ↔ Elements panel).
- [x] Element hit-test by layer order; popout-before-element hit priority.
- [x] Snap guides drawn as a surviving overlay; legacy color/width/dash.
- [x] `wrapText` CRLF; full `getScreenshotImage` fallback chain.
- [x] Popout localized current-language image; hex inputs; `collapsed` class; crop cursors; edge-pinning.
- [x] FontPicker shared cache / multi-weight / stylesheet-await / portaled dropdown.
- [x] OpenAI `max_completion_tokens` (16384 text / 4096 vision); AI_UNAVAILABLE mapping.
- [x] Magical-Titles onboarding tooltip (gating, localStorage flag, 8 s auto-hide, copy).
- [x] Export complete timing (1500 ms) + per-language detail strings.
- [x] 3D batch/all-language export renders 3D (not flat 2D); init when any screenshot is 3D; same-device load guard.
- [x] Replace Screenshot sets both `image` and `localizedImages[currentLanguage]`.
- [x] Theme default `auto`; `applyTheme('auto')` deletes `data-theme`.
- [x] Atomic project switch/create/delete; load fallbacks + defaults arrays backfill.
- [x] 2D transform/shadow/perspective/gradient/noise math; render orchestration order.

---

### Note on deliberate deviations to record in `REACT_REFACTOR_PARITY_AUDIT.md`
The following appear intentional and should be explicitly recorded as accepted deviations **or** reverted for strict 1:1: Escape-to-close (IW-5), duplicate copying elements/popouts (CR-4 — but the new-screenshot popout inheritance is a bug regardless), pure getters (DS-5), autosave debounce + unload flush (DS-7), icon data-URL persistence (DS-8), offline-first Google Fonts (MF-6), the native output-size select (MF-1), and the extra screenshot hover-actions row (UV-6). Each should be either documented or reverted — not left ambiguous.
