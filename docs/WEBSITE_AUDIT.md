# Website review: Aeris

Reviewed: 25 September 2026  
Scope: home page, map, weather screen, settings, navigation, localization behavior, map/weather loading states, and visible interaction affordances. Preview: local Vite app at `http://127.0.0.1:5175/`.

## Findings

### P1 — “Good conditions” can sit beside an explicit prohibited-zone result

**Where:** Map → select Berlin → location airspace check.  
**Observed:** The result says the point intersects three official zones, the first listed as “Prohibited zone”. In the same card, the combined summary reads “72/100 · Good conditions · 9 km/h wind · 10% rain”. The warning to verify the official map appears lower in the card, but the overall “Good conditions” wording is easy to read as an assessment of the flight rather than meteorology.  
**Impact:** This can imply that flying is advisable at a point the same card labels prohibited. It is the highest-priority wording issue because it concerns a flight decision.  
**Next step:** Label the score explicitly as “Weather score”, keep airspace status visually separate and dominant, and show an unmistakable “Prohibited zone intersects selected point” status adjacent to any weather result. Ensure score color/tone cannot imply legal or operational clearance.

### P2 — Selected-location card header controls overlap

**Where:** Map → Berlin location result.  
**Observed:** The floating “Plan a route” button overlaps the source/status chip in the result card header, obscuring the end of “DIPUL” and crowding the zone count.  
**Impact:** The source and zone count are important context and become harder to read at the inspected desktop viewport.  
**Next step:** Reflow the route action outside the result-card header or reserve a dedicated row; verify narrow widths as well.

### P2 — Dense zone styling competes with weather and basemap detail

**Where:** Map, Berlin at approximately 2 km scale with zones and weather overlay enabled.  
**Observed:** A broad mix of saturated yellow, orange, green, and blue zone/weather fills covers much of the street map. The green route geometry and point marker remain visible, but underlying road and place detail is substantially muted. The lower-right attribution control also appears clipped to a narrow “Forecast field” label in the screenshot.  
**Impact:** It takes effort to separate airspace categories, weather, route, and street geography; the clipped attribution affordance is not self-explanatory.  
**Next step:** Test category colors and opacity against the basemap, clarify the visual distinction between airspace and weather, and ensure the attribution control can expand without clipping at the supported viewport sizes. The best balance may depend on the selected country and enabled layers.

### P1 — Language selection does not translate most of the website

**Where:** Settings → Language, then Home and Map.  
**Observed:** The language selector offers 25 languages, but `screenCopy.ts` only defines full-page dictionaries for German, Spanish, French, and Italian; the other 20 supported choices fall back to English for those screens. The Home page's three-step story, promise cards, photo captions, about text, and disclaimer are hard-coded English in `src/App.tsx`. Map directory, planner, map controls, source descriptions, and several status messages are likewise hard-coded. Even the four translated screens mix localized copy with fixed English.  
**Impact:** The advertised localization is inconsistent and can make the product feel unfinished or machine-translated.  
**Next step:** Centralize all visible strings in locale dictionaries; show only languages with complete coverage or clearly mark incomplete languages. Have a fluent speaker review phrasing.  
**Evidence:** `src/languages.ts` advertises 25 locales; `src/screenCopy.ts` contains partial dictionaries; `src/App.tsx` hard-codes Home and Map copy.

**Concrete wording examples to review:** French `Le contexte de vol sans deviner` reads as an unnatural literal rendering of “without the guesswork”; German `Wähle, wie viel Aeris rendert` and Spanish `Elige cuánto renderiza Aeris` describe rendering rather than a user benefit; Italian `finestra tranquilla` is an awkward phrase for a useful flying-weather window. Several English fallbacks remain inside otherwise translated screens. These are editorial flags, not native-speaker corrections.

### P2 — Settings checkboxes look unstyled and out of place

**Where:** Settings modal, AI copilot, 3D terrain, Reduce motion.  
**Observed:** The three unchecked inputs render as small white square browser-default checkboxes against the dark glass panel, unlike the carefully styled green slider and primary button. The screenshot shows all three squares bright white and visually disconnected from their labels.  
**Impact:** The settings panel looks unfinished and the toggle state is harder to scan.  
**Next step:** Style these as accessible switches or themed checkboxes, including checked, focus, hover, and disabled states.  
**Evidence:** `src/App.tsx` Settings inputs; Settings screenshot.

### P2 — Weather’s no-location state looks partly like a forecast

**Where:** Weather tab before choosing a location.  
**Observed:** Before selecting a location the page shows `—° AFTER DARK`, along with “LIVE 36H MODEL” and “UPDATED FOR THE SELECTED POINT”, while a “Choose where you want to fly” prompt and search appear lower down. With Berlin selected, the forecast cards and 24-hour timeline populated as expected. Source inspection confirms an error panel is implemented for a selected location when no forecast is available.  
**Impact:** The no-location state can be mistaken for an empty nighttime forecast or current live data.  
**Next step:** Make the no-location state distinct from a forecast and avoid live/update claims until a location and forecast are loaded.

### P2 — Weather status labels and location state are ambiguous

**Where:** Weather page header.  
**Observed:** Before location selection, “LIVE 36H MODEL” and “UPDATED FOR THE SELECTED POINT” still show while the value is `—` and the timezone label is “LOCAL TIME”. After selecting Berlin, the timezone updates to `Europe/Berlin`, but the status remains “LIVE” without a visible forecast update timestamp.  
**Impact:** The interface does not distinguish forecast-provider/model freshness from live radar, and initially implies point-specific data before there is a point.  
**Next step:** Use state-aware labels, identify forecast model/provider versus radar, and show an actual update time where available.  
**Evidence:** Browser accessibility state before and after choosing Berlin; `src/App.tsx` WeatherPage header.

### P3 — Terminology and tone are inconsistent or overly technical

**Where:** Settings and feature copy.  
**Observed examples:** “Choose how much Aeris renders” is developer-facing/technical phrasing; “Liquid glass transparency” exposes an implementation aesthetic as a preference; “grounded copilot” and “Flight score” suggest a level of authority or scoring methodology that should be explained. Spanish `Comprobar IA` is unnatural for an AI feature, and some locales use inconsistent “live” loanwords.  
**Impact:** The product voice shifts between polished aviation guidance and internal implementation terminology.  
**Next step:** Use user outcomes (“Map detail”, “Panel transparency”, “AI assistant”), define what the flight score means and does not mean, and obtain native-language review.

### P3 — Map attribution is hard to scan and may be clipped

**Where:** Map attribution control.  
**Observed:** Accessibility content exposes one very long attribution line covering numerous countries/sources, dates, prototype labels, and caveats. In the selected Berlin screenshot, the lower-right control is visibly narrow and its text reads only “Forecast field”.  
**Impact:** Users may not be able to discover or read source information on the map itself.  
**Next step:** Check provider attribution requirements, make the control legible at the tested viewport, and group expanded credits in a scrollable, readable source panel.

### P3 — Home page has duplicated promises and excessive long-form copy

**Where:** Home page.  
**Observed:** The page repeats “official source”, “36-hour forecast”, privacy, and “before takeoff” claims across the hero, three-step story, feature cards, promise section, final CTA, about copy, and disclaimer. The desktop view exposed a long, multi-section narrative before the bottom navigation.  
**Impact:** Repetition dilutes the strongest product message and makes the main action less prominent.  
**Next step:** Keep the hero and one concise workflow explanation; consolidate overlapping features and promises; retain source/authorization caveats near the relevant actions.

## Functionality reviewed

- Home navigation and location/search affordances rendered.
- Search returned several Berlin suggestions; selecting Berlin loaded street-map tiles, a marker, three official-zone matches (including a prohibited zone), weather overlay data, and a national-source handoff link.
- Weather tab rendered populated Berlin readings and a 24-hour strip: 15°C, 9 km/h wind, 23 km/h gusts, 10% rain probability, 98% cloud, 38 km visibility, and a score of 72. Best-window cards ranked later hours at 89–90. These are an observed snapshot, not a forecast accuracy assessment.
- Weather tab’s no-location and missing-forecast states were checked in UI/source. The missing-forecast error panel is implemented; the no-location top-line labels remain misleading as noted above.
- Switching to the street basemap rendered OSM detail with airspace and weather overlays. Moving the forecast from `Now` to `+1` updated the overlay label to `+1H`, changed the score from 72 to 71 and rain from 10% to 8%, and correctly changed the radar note to “live radar is available at Now only”.
- Route planner opened and displayed a pre-existing two-waypoint route plus an out-of-radius warning; its original 20 km radius was restored after inspection. The route itself was not edited or saved.
- Settings modal opened and exposed language, map detail, AI, terrain, transparency, reduced-motion, and save controls. Only visual behavior was inspected; preferences were not changed.
- Saved section showed its empty place/route state, source directory (37-country catalog, active entries labeled), and locally stored offline-package list. The inspected browser profile showed 21 offline records with “Update available”; duplicate full-country package entries were also present. This may be existing profile data rather than a default-state product defect, and no package data was changed.
- The optional AI page is disabled by default. It was not enabled and its chat was not submitted; its user-facing strings are visibly English-only in `src/App.tsx`.
- Saving a place, route creation/export, offline download/update/delete, location permission behavior, and weather/data-provider failure paths were not exercised end to end. The AI page remains hidden by its default-off setting and was not opened.

### Additional close-zoom weather map finding

**P2 — Weather overlay breaks into conspicuous grid-like blobs when zoomed in.** On the map at closer zoom, the weather layer appears as scattered square/speckled patches across the basemap, with visible circular/soft-edged cells rather than a continuous, legible weather field. The screenshot showed this while the live radar and forecast overlay were enabled; it is visually noisy and can be mistaken for precise local conditions.

**Likely cause from implementation:** `src/MapCanvas.tsx` samples forecast values at a regular latitude/longitude grid (balanced detail is 7×5 points across the current viewport) and renders those samples as overlapping heatmap kernels (`weather-clouds` and `weather-rain`). At the same time, the live RainViewer raster is enabled only for “Now” and declares `maxzoom: 7`; beyond that it must be enlarged from its coarser source tiles. Together, sparse forecast samples and upscaled radar can produce blobs/blockiness at close zoom. The visible map inspection does not establish which of these two layers contributes most to each individual patch, so isolate them with layer toggles during a fix.

**Impact:** The overlay reads as arbitrary marks rather than a dependable weather surface; the level of visual detail implies more spatial precision than a sparse viewport sample can support. It competes with airspace zones, route markers, and labels.

**Recommended follow-up:** Inspect at several zoom levels with forecast-only and radar-only modes. Either render each sampled value as an explicitly bounded, subdued cell (with a legend and coarser zoom behavior), or use a genuinely continuous/interpolated field with documented resolution. For radar, fade or hide beyond its useful source zoom instead of letting low-resolution tiles dominate. Add a clear layer legend and keep colors/opacity subdued enough that airspace restrictions remain primary.

**P2 — Wind initially read as scattered dashes rather than a usable forecast.** The attached close-zoom map screenshot showed pale cyan strokes over satellite imagery. The initial linework had no high-contrast outline and the speed colors had no on-map key, so it was hard to read direction or speed. The dashed line animation changed its pattern but did not strongly convey flow.

**Implementation update:** Wind vectors now have longer strokes, dark outlines for satellite/street contrast, visible arrowheads, a 0–65+ km/h color key, and a denser weather sample grid at Balanced and Maximum detail. The forecast timeline still selects the hour shown by the vector data; the directional dash animation now runs only while Wind is enabled and stops for reduced motion. Remaining review: compare wind-only and combined layers at close and regional zoom, and confirm the denser Open-Meteo sample remains responsive on slower connections.

## Color, UI/UX & motion review

### Palette assessment

The existing forest-dark background and lime accent fit an outdoor aviation product and create a recognizable identity. I would refine the existing palette before exploring a full rebrand. Current design tokens include `--ink: #07110f`, `--panel: #11241fce`, `--lime: #b7ff9c`, `--mint: #74f2a1`, and `--muted: #a9b9b2` in `src/redesign.css`; `src/styles.css` also sets `#08110f`, while UI rules repeat many near-duplicate lime values such as `#b6ff94`, `#78ff43`, `#7dff48`, and `#76ff3f`. This makes the accent intensity vary from one screen/component to another.

**Color recommendations:**

- Keep dark forest surfaces and lime as the brand cue, but reserve the brightest lime for primary action, selected navigation, and one clear active state. Reduce glow and lime on decorative labels/icons so a green “good” cue cannot compete with an airspace warning.
- Normalize UI color tokens across `styles.css`, `redesign.css`, `hud.css`, and `flight-tools.css`. Keep *data* colors (airspace categories and radar/weather precipitation) semantically separate from brand colors.
- Make prohibited/no-fly status red or otherwise unambiguously hazardous and restricted/caution amber. The inspected “Prohibited zone” label currently uses the same amber family as caution, while the adjacent result summary is lime/green. Pair each status color with a word/icon/pattern so meaning never depends on hue alone.
- Use the report’s starter palette only as a candidate to contrast-test, not a finished replacement:

  | Role | Candidate | Use |
  | --- | --- | --- |
  | Page background | `#07110F` | Keep current deep forest ink |
  | Raised surface | `#11241F` | Panels and map controls |
  | Primary accent | `#B7FF9C` | One main action and selected state |
  | Secondary accent | `#74F2A1` | Subtle highlights, less often |
  | Main text | `#F4F5EE` | Headlines and body text |
  | Muted text | `#A9B9B2` | Supporting labels, after contrast checks |
  | Informational weather | `#8DDCFF` | Rain/wind information, not airspace legality |
  | Caution | `#F0C778` | Warnings/restricted status |
  | Prohibited / danger | `#FF7777` | Prohibited-zone status and urgent alerts |

The logo/photo color world already supports this direction. The key refinement is a stricter semantic system, especially on the map: brand accent ≠ permission, green weather score ≠ clear airspace.

### Contrast and UI/UX findings

**P2 — Some microcopy is likely below text contrast targets.** `src/hud.css` uses 7 px mono text in `#71887c` for starter-prompt captions. That color on the solid raised-surface token `#11241f` is approximately 4.26:1, below WCAG AA’s 4.5:1 target for normal text; the glass transparency means the rendered result must be checked against the actual background under it. Raise the contrast and/or size, then check every glass/map/photo combination. The brighter core text and lime-on-dark pairing are strong. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)

**P2 — Search field removes its keyboard focus outline without a clear replacement.** The global search input has `outline: 0` in `src/styles.css`, but the stylesheet has a visible `:focus` replacement for `.languageSearch` and no corresponding `.searchWrap:focus-within` treatment. Add a consistent focus-visible ring to the search field/container and other keyboard controls; verify focus is not hidden by the fixed dock/overlays.

**P2 — The Settings modal’s native checkboxes do not match the dark theme.** As noted above, they rendered as white squares. Apply a styled switch/checkbox with a clear focus ring and visible checked state while preserving a large label hit target.

**P2 — Map overlay hierarchy needs semantic color separation.** Saturated zone fills, weather colors, lime marker/route, and the amber prohibited label are all visible at once. Use a consistent zone-category legend with distinct shapes/line patterns and reserve weather’s blue→yellow→red scale for weather only. Show high-risk zone status in text and in the result-card hierarchy, as well as by color.

**P3 — Control styles vary from playful rounded glass to dense HUD microtype.** The site’s glass panels and forest background are coherent, but 6–9 px labels, frequent glow, and lots of bespoke icon/edge treatments make settings, source directory, and map overlays harder to scan than the Home hero. Keep hierarchy in the map: selected place and prohibition first; time controls and weather second; attribution and technical status third.

### Motion review

| Current behavior | Suggested adjustment | Why |
| --- | --- | --- |
| Bottom navigation selector uses `--selector-duration: 515ms` and animates both `transform` and `width` (`src/redesign.css:17`). | Bring the frequent navigation response down to roughly 180–220 ms; animate position/opacity only where possible and avoid animating width. | The long, layout-affecting selector makes routine page changes feel slow. |
| Every page entrance uses `pageIn .55s`, moving 10 px while animating `filter: blur(4px)` (`src/redesign.css:3,14`). | Use a short opacity/translate transition (about 180–220 ms) or remove it for routine navigation; drop the blur. | The current 550 ms entrance repeats often and animates a costly visual effect. |
| Global buttons begin with `transition: .22s ease` (`src/styles.css:1`); when no property is specified, CSS applies the transition broadly. Button-specific overrides list properties but use 320 ms (`src/redesign.css:4`). | Explicitly list only intended properties and keep routine hover/press feedback around 100–180 ms. | Avoid unintended transitions and make frequent controls respond immediately. |
| Ambient drift, radar rotation, and live-dot pulse repeat continuously; the hero/photo also has a 1.4 s entrance (`src/redesign.css:3,14,20`). | Keep only motion that communicates state; lower decorative activity on repeat visits and consider a shorter hero entrance. | The map already carries lots of changing information, so background movement competes with it. |

The site honors `prefers-reduced-motion` globally in `src/redesign.css:79`, and offers a reduced-motion preference; that is a good foundation. Keep state changes understandable when movement is removed, especially loading/playing states.

### Motion re-review for the requested liquid-glass feel

I rechecked the motion implementation against the Apple Design principles of immediate feedback, direct manipulation, interruptible transitions, spatial consistency, and restraint. The target should be **quiet, tactile, and spatially clear**, with the glass material carrying the polish and motion explaining state. That does not require every panel to float or bounce.

| Area | What the code does now | Review and direction |
| --- | --- | --- |
| **Search → map camera** | Selecting a location triggers MapLibre `flyTo()` to its coordinates and raises zoom to at least 11 (`src/MapCanvas.tsx:951–959`). This is the globe rotation/flight the user specifically likes. | **Keep this signature transition.** It makes the chosen search result spatially understandable and gives useful context. Maintain a smooth curved camera path; cancel/re-target cleanly if a new result is chosen mid-flight. The current call sets `essential: true`, however, so it may override reduced-motion behavior. Honor the app’s reduced-motion setting with a no/short transition there, while keeping the full globe flight as the default. |
| **Liquid-glass materials** | The `.liquid` surface already uses translucent layered gradients, a fine border, inset highlight, deep shadow, `backdrop-filter: blur(26px) saturate(140%)`; dock and search have their own blurred materials. A glass opacity preference is also present. | **Keep and refine the existing base.** Make foreground panels feel like one consistent family: controlled transparency, a soft top-edge reflection, restrained depth, and a slightly clearer active/focused edge. Keep map labels and weather/airspace data crisp beneath/around glass; avoid stronger blur or more glow as a substitute for hierarchy. Prefer material/light shifts on interaction over broad panel movement. |
| **Page changes** | `.pageTransition` runs `pageIn` for 550 ms with opacity, 10 px translation, and 4 px blur on every page. | The blur and repeated page-wide movement make frequent navigation feel staged. Use a brief opacity/very small position change (or no page transition) and let the selected glass dock indicator show wayfinding. Keep page content stable for reduced motion. |
| **Bottom navigation glass selector** | The dock highlight stretches/squashes with Web Animations API, and also transitions transform *and width* for 440–740 ms; the active icon tilts/scales. | This already has the closest thing to tactile glass motion, but takes too long for routine navigation and has two mechanisms animating the same selector. Keep a compact, directional glide with a subtle stretch and settle; shorten it to roughly 250–350 ms, animate position with a spring-like/interruptible response, and avoid width animation unless adapting to a changed layout. Preserve immediate pressed feedback. |
| **Hero illustration and floating labels** | A seven-second radar sweep, three-second drone bob, five-second floating cards, 12-second ambient blobs, and 1.4-second photo reveal run on the landing screen. Feature cards rise in over 600 ms with delays. | Keep a small amount of ambient movement on the first visit if it supports the aviation/weather metaphor; reduce or remove repeated idle motion and stagger. The radar sweep is the most legible illustration of “live”; the floating text cards and drone bob currently compete with the main headline/search. Avoid parallax or extra shine on the map itself. |
| **Status pulses / empty states** | The live dot pulses every 1.8 s; the optional AI ring pulses every 2.2 s; saved/weather empty-state rings rotate over 8–12 s. | Reserve pulsing for a state that is truly live or waiting. A static status label plus a quiet color cue is sufficient for persistent “live” decoration; remove continuous rotation from empty states where nothing is actively happening. |
| **Map/weather transitions** | Weather grid values interpolate via `requestAnimationFrame` over 720 ms; wind dashes animate continuously; enabling terrain uses `easeTo` over 850 ms, while disabling it stops and immediately `jumpTo`s a flat camera. | Keep weather value interpolation if it helps people track forecast changes, but verify updates can be interrupted/re-targeted and do not flicker as grid samples change. Reduce/stop wind animation when it adds no actionable information. Make terrain on/off spatially consistent: use matching camera paths, and respect the app reduced-motion setting both directions. |
| **Result sheet, controls and imagery** | Result cards use a 450 ms entrance; buttons globally lift on hover and scale on press with broad 320 ms transitions; accordions rotate an icon over 200 ms; mission photos zoom/filter over 900 ms on hover. | Keep small material feedback and the 200 ms accordion cue. Make button press feedback immediate and specific to color/transform, not a delayed shadow/lift on every control. The result card should emerge from the selected map point or use a short fade/settle to explain the link. A 900 ms photo hover is leisurely; keep it subtle and avoid animating filters if it causes repaint or feels slow. |
| **Reduced motion** | OS `prefers-reduced-motion` disables CSS animation and transitions globally; the app preference gates weather interpolation, wind animation, and terrain-on movement, and stops forecast playback. Search camera flight is marked essential; terrain-off jumps instantly. | The two preference paths are inconsistent. Make the in-app setting disable the same decorative/page/dock motion as the OS preference, preserve understandable state feedback, and ensure map search and both terrain directions honor it. Reduced motion should use a short fade or direct camera update, not remove focus, selected, loading, or completion state. |

**Recommended motion language:** use immediate press feedback; use short, critically damped movement for controls that move between states; add stretch/overshoot only where a gesture or momentum calls for it; let the search camera flight remain the one expressive, longer transition. Build the glass feel through consistent layered material, edge light, and depth, rather than adding more continuous motion. The search-driven globe rotation is explicitly a keeper.

### Palette generation tools and prompt

- [Adobe Color accessibility tool](https://color.adobe.com/create/color-accessibility) is the best first stop for this task because it combines palette creation, contrast checking, and color-vision simulation. Its workflow supports starting from a color or image, generating color harmonies, previewing variants, and checking palette contrast.
- [Coolors](https://coolors.co/) is a fast alternative for generating options and previewing palettes on sample layouts; use its contrast checker/visualizer to screen candidates, then verify actual components and overlays in the app.
- The generators propose color combinations; they do not know whether lime means “selected”, “good weather”, or “safe to fly” in Aeris. Keep zone semantics and text contrast as explicit design constraints. WCAG AA contrast guidance calls for 4.5:1 for normal text (3:1 for large text), and the rendered pair must be measured over its actual background.

**Prompt to paste into a palette generator or design assistant:**

> Refine the existing color system for Aeris, a calm, trustworthy drone-airspace and weather map. Preserve its deep forest background and fresh lime brand accent, but reduce the neon/glow effect and remove near-duplicate accent greens. Propose a compact dark UI palette with page/surface/elevated-surface, primary and secondary accent, high-contrast text, muted text, informational weather, caution, and prohibited/danger roles. Lime must mean brand/action/selected only; it must never imply legal permission or safe airspace. Keep weather precipitation colors distinct from airspace-category colors. Pair every risk state with a label/icon/pattern so meaning is not color-only. Include hex values, foreground/background pairings, WCAG AA contrast ratios, and color-vision-deficiency simulations. Preview the palette on a dense map with street labels, translucent zone polygons, a weather timeline, a warning card, and a dark glass panel. Prefer legibility and calm hierarchy over extra decoration.

## Follow-on design implementation

The subsequent design pass added `src/frontend-liquid-glass.css` as a cohesive spruce-and-mineral glass layer with a restrained mint brand accent, weather blue, and semantic caution/danger colors. It applies shared translucent surfaces, clearer edges, more consistent buttons/focus states, a calmer page entrance and reduced idle motion, and a shorter dock-selector glide. The Home hero and closing CTA use existing locally credited Pexels photography; `docs/AERIS_HERO_IMAGE_PROMPT.txt` provides a prompt if a custom image is commissioned. The map search-to-location globe flight remains intact and is skipped when reduced motion is enabled. The coexisting `src/aeris-glass.css` map dock styles were preserved.

The follow-on pass also lengthened and outlined wind arrows, added the speed key, and increased forecast sampling from 7×5 to 8×6 at Balanced detail and from 9×7 to 10×8 at Maximum detail. The live preview now exposes the wind direction in the point readout (for example, “SE”), a forecast-hour timeline, and the wind-speed key. Wind animation originally depended on a selected point, so the map overview could display weather without animated wind. It now requests the viewport forecast grid whenever the Wind layer is active, even before a point is selected; streak density, travel distance, and contrast were increased. The local preview rendered the forecast grid and selected-location card after a Berlin search. Continue to compare wind-only and combined layers at regional and close zoom, especially at low wind speeds.

### Search camera freeze report

The user subsequently reported that searching could leave the map stuck away from the selected place. The screenshot showed a Dubai result while the map remained over the Atlantic/North Africa. The location-selection state and result card were updating, so the failure was in map camera timing/feedback rather than search result selection. I changed the map to begin at its overview, wait for its style to load before starting a location flight, cancel any previous camera transition, and use a bounded 1.8-second globe flight. Wind animation pauses during map movement to reduce competing map-render work. The current local preview was also used to search Berlin; it centered the map on Berlin, loaded its marker and local conditions, and showed the three matching official zones. The production build passes. 

## Overall assessment

The visual direction is more consistent on Home, map, weather, and Saved after the glass pass, while retaining the recognizable forest identity and search globe flight. The highest-priority product issue remains the ambiguous “Good conditions” summary next to a prohibited-zone match. Localization coverage remains broadest quality issue. The zoomed weather field still needs a focused visual pass with zones hidden and the radar and forecast layers isolated, because the initial screenshot combines several map layers and does not identify which creates every patch. The report includes palette-generation links, a starter palette, editorial examples, and an image prompt; these are a working review, not native-speaker localization or a full accessibility certification.
