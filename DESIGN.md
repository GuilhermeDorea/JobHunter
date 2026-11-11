---
name: JobHunter
description: Vagas de estágio, trainee e júnior ranqueadas como uma torre de cronometragem de F1.
colors:
  asphalt: "#050506"
  pit-panel: "#0D0D10"
  tower-row: "#121216"
  tower-row-hover: "#1A1A20"
  grid-line: "#24242B"
  chalk: "#F4F4F5"
  chalk-dim: "#A1A1AA"
  chalk-faint: "#71717A"
  fastest-purple: "#B15CFF"
  sector-green: "#1FE074"
  race-control-yellow: "#FFD60A"
  red-flag: "#FF3B30"
  applied-blue: "#4C7DFF"
  interview-orange: "#FF8A00"
  saved-gray: "#C7C7CF"
  withdrawn-gray: "#8A8A93"
  tile-white: "#FFFFFF"
typography:
  display:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: 0.85
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.01em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Saira Semi Condensed, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  row: "4px"
  control: "5px"
  tile: "6px"
  panel: "8px"
spacing:
  row-gap: "3px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  gutter: "20px"
  page: "28px"
components:
  button-primary:
    backgroundColor: "{colors.tile-white}"
    textColor: "{colors.asphalt}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#DADADF"
  button-secondary:
    backgroundColor: "{colors.pit-panel}"
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.tower-row-hover}"
  tab:
    textColor: "{colors.chalk-faint}"
    padding: "8px 18px"
  tab-active:
    backgroundColor: "{colors.tile-white}"
    textColor: "{colors.asphalt}"
  tower-row:
    backgroundColor: "{colors.tower-row}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.row}"
    height: "58px"
  tower-row-selected:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.asphalt}"
  company-logo:
    backgroundColor: "{colors.tile-white}"
    textColor: "{colors.asphalt}"
    rounded: "{rounded.tile}"
    size: "36px"
  input:
    backgroundColor: "{colors.pit-panel}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  panel:
    backgroundColor: "{colors.pit-panel}"
    rounded: "{rounded.panel}"
    padding: "18px"
---

# Design System: JobHunter

## Overview

**Creative North Star: "The Timing Tower"**

JobHunter reads like an F1 broadcast graphic, not a SaaS dashboard. Jobs are drivers in a ranking tower on a near-black track; the selected one opens in a telemetry panel that shows exactly why it scored. Applications then run a race board where every stage owns a color. Density is high and scannable: thin rows, tabular numbers, condensed caps.

The material is broadcast overlay: flat dark panels, white slanted tiles for "on air" states, thin hairline borders, and color used only as data (sector bars, tyre rings, stage colors, the one purple best score). Nothing glows, nothing floats.

**Key Characteristics:**
- Near-black ground with three tonal steps (asphalt, pit panel, tower row) and 1px grid lines.
- Saira Semi Condensed uppercase for every label, number and title; Barlow for reading text.
- White slanted parallelogram tiles mark the active tab, stage names, NEW tags and the race-control flag.
- Color is semantic only: purple = best, green = matched, yellow = race control/focus, stage colors on the board.
- Selection inverts (light row, black text), it never outlines.

## Colors

A dark broadcast palette where every saturated hue carries one meaning.

### Primary
- **Fastest Purple** (fastest-purple): the single best score on screen (tower points, telemetry big number). Nothing else is purple.
- **Race-Control Yellow** (race-control-yellow): race-control banner, NEW tag, focus rings, text selection, the Teste/Case stage and radar demand bars.

### Secondary
- **Sector Green** (sector-green): matched skills (sector bars, `ok` chips, skills bar), success messages, Oferta stage.
- **Red Flag** (red-flag): errors, destructive buttons, Reprovada stage, the rejected dot, the Estágio tyre ring.

### Tertiary (stage colors, race board only)
- **Saved Gray** (saved-gray) Salva · **Applied Blue** (applied-blue) Aplicada · **Race-Control Yellow** Teste/Case · **Interview Orange** (interview-orange) Entrevista · **Sector Green** Oferta · **Red Flag** Reprovada · **Withdrawn Gray** (withdrawn-gray) Desisti. Columns tint their background at 6% and border at 22% of the stage color; cards tint at 12%.

### Neutral
- **Asphalt** (asphalt): page ground. **Pit Panel** (pit-panel): panels, inputs, dialogs, buttons. **Tower Row** / **Row Hover**: ranking rows and hover. **Grid Line** (grid-line): every 1px border and divider.
- **Chalk** / **Chalk Dim** / **Chalk Faint**: primary text, secondary text and labels, inactive tabs and metadata.
- **Tile White** (tile-white): company logo tiles, active tab, primary button, toggles pressed.

### Named Rules
**The One Purple Rule.** Purple marks only the best score in view. No top-3 highlight, no purple accents, no purple hover.

**The Color-Is-Data Rule.** A saturated color must mean something (match, stage, alert, best). Companies get a white logo tile, never a per-company or per-area color.

## Typography

**Display Font:** Saira Semi Condensed (with system-ui) — weights 500–800
**Body Font:** Barlow (with system-ui) — weights 400–600

**Character:** Condensed, slightly technical caps for the timing graphics; a plain humanist grotesk for anything read as sentences.

### Hierarchy
- **Display** (800, 64px, 0.85): the telemetry score number only.
- **Headline** (800, 34px / 28px mobile, 1, uppercase): page titles.
- **Title** (700, 15–20px, 1.15–1.2, uppercase): job titles in rows, telemetry, dialogs and cards (13px).
- **Body** (Barlow 400, 15px, 1.5): descriptions, sub-lines, notes; long text capped at 75ch.
- **Label** (700, 11–14px, 0.08–0.12em tracking, uppercase): tabs, buttons, section headings (Chalk Dim), field labels, pager.

### Named Rules
**The Tabular Numbers Rule.** Every number (positions, points, counts, salaries) uses the display face with tabular figures, so the tower columns never jitter.

## Layout

Sticky 64px top bar (brand, tabs, search) with a blurred translucent ground; page padding 28px (16px mobile). The home screen is a two-column grid: fluid ranking tower plus a 380px sticky telemetry panel (20px gap); detail pages flip it (380px panel left, description right). Tower rows are 58px tall with a 3px gap, a fixed column grid (position, logo, who, tyre, sectors, points). The race board is five equal columns (min 210px, 10px gap) with Reprovada/Desisti in a separate DNF strip below.

Below 1100px all two-column grids stack and the telemetry panel stops being sticky. Below 760px tabs move to a fixed 60px bottom bar, sectors fold under the job title, titles clamp to two lines, and the board scrolls horizontally with snap (80vw columns).

## Elevation & Depth

Flat. Depth comes from tonal steps (asphalt → pit panel → row → row hover) and 1px grid-line borders. The only blur is the sticky top bar; the only scrim is the dialog backdrop (72% black). Kanban cards lift 1px on hover; buttons press 1px down.

### Named Rules
**The Broadcast Overlay Rule.** No drop shadows. Separate surfaces with tone and hairlines.

## Shapes

Small, tight radii: rows 4px, controls 5px, tiles and cards 6px, panels and dialogs 8px. The signature shape is the slanted parallelogram cut (8px skew, 4–5px on small tags), used on the active tab, stage-name tiles, NEW tags and the analyze tag. Tyre badges are the only circles besides the avatar and the rejected dot.

## Components

### Buttons
- **Shape:** gently squared (5px), 1px grid-line border, uppercase label type.
- **Primary:** white tile, black text ("Salvar na corrida"); one per view. Hover to #DADADF; active presses 1px.
- **Secondary:** pit-panel background, chalk text; hover to row-hover.
- **Danger:** red text with a red-tinted border; confirmed destructive action fills red with black text.
- **Link button:** underlined uppercase label in Chalk Dim.

### Chips
- **Style:** 3px radius, 1px border, 12px label type. `ok` (matched skill) is green text with 45% green border; `no` (missing) is Chalk Dim with a grid-line border.
- **Toggles:** pit-panel buttons; pressed state becomes a white tile with black text.

### Cards / Containers
- **Panels** (telemetry, description, notes, auth form): pit panel, 1px grid line, 8px radius, 18px padding, blocks divided by hairlines.
- **Kanban cards:** stage-tinted background, 6px radius, a 3px progress strip on top filled in the stage color, logo tile + uppercase title.

### Inputs / Fields
- **Style:** pit-panel fill, 1px grid line, 5px radius, 9px 12px padding.
- **Focus:** 2px race-control-yellow outline. All keyboard focus in the app is this yellow ring.

### Navigation
- **Tabs:** uppercase 14px label, Chalk Faint; hover gets row-hover background; current tab is a white slanted tile with black text. Mobile: fixed bottom bar.

### Ranking Tower Row (signature)
Position block (darker cell), company logo tile, uppercase title + company, tyre-ring level badge (E red, T yellow, J white ring), five sector bars (green = matched, purple = best, gray = not), points right-aligned. **Selected row inverts:** chalk background, black text, black position block with white number, darker green/purple for contrast. New rows slide in (0.5s) when motion is allowed.

### Telemetry Panel (signature)
Logo + company, uppercase title, meta line, 64px score (purple when best) out of 100, horizontal score bars (Skills green, Salário white), "Você tem / Falta" chips, footer with the primary save button.

### Race-Control Banner
Pit-panel strip with a yellow flag shape and a yellow uppercase message title; carries "what's new since your last visit".

### Rejected Marker
A 6px red dot plus "caiu em X" in Chalk Faint. Rejection is quiet, never a red card.

## Do's and Don'ts

### Do:
- **Do** keep purple for the single best score in view.
- **Do** invert the selected row (chalk background, black text) to show focus.
- **Do** show companies with a white logo tile (initials fallback in black display caps).
- **Do** show scores as points only (e.g. 78 /100), in tabular display numerals.
- **Do** color race-board columns by stage: Salva gray, Aplicada blue, Teste/Case yellow, Entrevista orange, Oferta green, Reprovada red, Desisti gray.
- **Do** use the yellow 2px outline for every focus state.

### Don't:
- **Don't** highlight a top 3 (podium colors, medals, special rows) in rankings.
- **Don't** mark selection with an outline or border; invert the row.
- **Don't** assign colors per company or per area.
- **Don't** convert scores to percentages, grades or stars.
- **Don't** use side-stripe borders (colored left/right edge bars) on rows, cards or panels.
- **Don't** add drop shadows or glows to surfaces.
- **Don't** render a rejection as a red card or red text block; use the red dot and "caiu em X".
