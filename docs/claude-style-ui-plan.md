# Claude-style UI plan (2026-10-29)

Status (2026-10-30): approved and implemented except the items listed under "Not yet done" in [react-ui.md](react-ui.md#claude-style-layout-2026-10-30). Restyles the React workspace (`ui/`) in the Claude visual style (warm neutrals, one terracotta accent, quiet chrome, light and dark) and borrows data-presentation patterns from the [BG3 5.5e data browser](https://yoonmoonsik.github.io/bg3dnd/#lang=en). Visual style only: the app keeps its own name (Feature Forge) and wizard-die icon; no Anthropic or Claude branding, and nothing from the reference site's content.

## 1. Current UI

Checked in the running dev build (Starter Set party loaded) and in source.

**Shell.** `App.tsx` (1,414 lines) renders a fixed left sidebar (brand, six workspace links with glyph icons, a scrolling "Your characters" list, save status) beside a top bar (collapse toggle, centred page title, System select, filled "+ New character"). The sidebar takes ~240px on every page and duplicates navigation the Characters page already provides.

**Styling.** One global stylesheet, `ui/src/styles/app.css` (3,662 lines, ~219 class rules). Only three custom properties exist (`--green`, `--muted`, `--line`); about 150 colour literals are written inline in rules (13× `#fffefa`, 6× `#253930`, many near-duplicate creams and greens). Fonts are Inter (not loaded, so it falls back) with Georgia for headings. No dark mode. No inline `style={{}}` in components, which makes a token swap tractable.

**Pages.**
- Characters: large serif hero, action buttons, character cards in a grid.
- Classes / Races / Features: card grids with long description excerpts. Twelve Classes need two screens of scrolling to compare; there is no tabular view, count, or filter chips. Features has search, tag filter and sort but still renders cards.
- Class detail: guide with sticky section navigation and an advancement table (already good structure).
- Character sheet: header (name, race · class, Valid badge), rest buttons, six separately boxed stat cards (HP, AC, Initiative, Speed, Proficiency, Passive perception), a row of ten text tabs, then large cards per section. Spells render one big card per spell with a nested disclosure, so even a level-1 Wizard needs a lot of scrolling.
- Loading: `LoadingOverlay` is a modal `<dialog>` that blocks the whole app, used for startup, navigation, tab changes and System loads (documented as intentional in `docs/react-ui.md`).

**Strengths to keep.** Hash routes, skip link, visible focus, native dialogs, explicit calculation disclosures, System-authored tabs and terminology, sortable skill tables, custom tab order.

## 2. What the reference does well

The BG3 browser already uses a warm dark palette very close to Claude's dark tokens with a terracotta accent, so it shows how this data looks in that style:

- **Dense filterable tables per catalogue** (Classes, Spells, Feats…): one search box, a Filters panel of pill chips grouped by facet (level, class, school, casting time, damage type, source), a "16 of 16 classes" count, Reset.
- **Expand-in-place rows**: clicking a Class row opens proficiencies, description, subclass links and a Level | Features table directly below, so comparison and detail live on one page.
- **Small state badges** ("New", "Revised") beside names, and colour reserved for meaning (action types, damage types).
- **Home page as a stat index**: one card per catalogue with its count and a one-line description.
- Weak spot: its Build Simulator is plain stacked forms; Feature Forge's builder should keep its own structure and only take the styling.

## 3. Target design

Follows the `claude-style-ui` skill (tokens, top bar, text tabs, hairline cards, pill badges, ring spinner, refresh icon, light/dark from the system setting).

- **No sidebar.** Top bar: wizard-die icon + "Feature Forge" left; right side a System select, a save-status chip ("Saved" / "Not saved" with an `--ok`/`--error` dot) and the accent "New character" button. Below it, text tabs: Characters · Classes · Races · Features · Systems · System data (System terminology preserved). The per-character list moves to the Characters page and to a character switcher (dropdown) in the character header.
- **Content column**: ~760px for reading pages (Feature detail, notes); catalogue tables and the character sheet use a wider ~1100px column.
- **Catalogue tables** (BG3 pattern): Classes, Races and Features become tables with a search box, a collapsible chip filter panel (facets from data the engine already exposes: tags, content level, hit die, spellcasting, primary ability), an "N of M" count and Reset. Rows expand in place to the existing detail content (`ClassDetail`, `FeatureDetail`); the full detail route and "Open in new tab" remain. Filters persist in the hash route as today.
- **Character sheet**: name in the serif, race · class line muted, validity as a pill badge; rest buttons as secondary buttons; the six stat boxes become one bordered strip divided by hairlines; sheet tabs keep the accent underline. Skills/saves as hairline-row tables. Spells as a compact table (name, level, casting time, range, attack/save, cost/Use) with the description expanding beneath the row; spell slots as a small strip of pills above it. Roll history as a record list (name, result badge, time right-aligned, details on expand).
- **Badges**: draft/finalized, valid/invalid, inactive/unmet, concentration/ritual, and Feature category tags all use the one pill style; failures use `--error`.
- **Feedback**: ring spinner + label next to whatever is loading; "Reload System" uses the refresh icon with an "Updated hh:mm:ss" line.

## 4. Implementation phases

Each phase is shippable on its own and ends with `npm run lint`, `npm run test:all` and `npm run ui:build`, plus a browser check at 1400px and 375px in light and dark.

1. **Tokens and fonts (no layout change).** Add the skill's full light/dark token block to `:root` in `app.css`. Map old variables (`--green` → `--accent`, `--line`, `--muted`) and replace every colour literal with a token, merging the near-duplicate creams/greens. System font stacks; serif only for page and dialog titles. Accent focus ring, `prefers-reduced-motion`. Add a check to `tools/lint.mjs` that rejects colour literals outside the token block so they don't creep back.
2. **Shell.** Remove the sidebar and `ttrpg-sidebar-collapsed` preference handling from `App.tsx`; extract `TopBar` and `MainTabs` components (keeps `App.tsx` from growing). Move the character list to the Characters page and add the switcher. Delete the old sidebar rules (35 references) rather than overriding them.
3. **Shared primitives.** Small components in `ui/src/components/`: `Badge`, `FilterChips`, `DataTable` (sortable header, expandable row, empty note), `Spinner`, `RefreshButton`, `StatStrip`. Collapsible sections use the single rotating CSS triangle on a flex `<summary>`.
4. **Catalogues.** Classes, Races and Features pages switch to `DataTable` + `FilterChips` with expand-in-place rows. Column data comes from existing engine queries (`getClassLevels`, `getFeature`, tag display names); no new rules logic in React.
5. **Character sheet.** Implements section 7 (rail + panel layout, vitals strip, compact Actions/Spells/Inventory tables, details drawer, phone layout). Keep calculation disclosures, custom tab order and all engine-driven actions unchanged.
6. **Builder and System pages.** Restyle `CharacterBuilder` selection cards and System cards with the same card/badge/button styles; no flow changes.
7. **Polish and docs.** Dark-mode pass on tables and badges, 375px pass (no horizontal scroll, 16px inputs), update `docs/react-ui.md` and the README screenshots/wording. UI version bump: minor (0.13.0 → 0.14.0) when the first visible phase ships.

## 5. Decisions needed

- **Full-screen loading lock.** `docs/react-ui.md` records a requirement that loading blocks all input; the Claude style locks only the part that is waiting. Proposal: keep the modal lock for System load/replace (where it protects data) and use local spinners for navigation and tab changes.
- **Removing the sidebar.** The character list moves to the Characters page and a header switcher; confirm that is acceptable.
- **Phase order.** Phase 1 alone gives the Claude look (including dark mode) with minimal risk; phases 4–5 carry the BG3-style data presentation.

## 6. Risks

- The stylesheet allows repeated selectors and descending specificity, so old rules can silently beat new ones; delete replaced rules and check computed styles, not only screenshots.
- Component tests server-render pages and assert on rendered markup; they don't reference the sidebar today, but table conversions in phases 4–5 will change the markup they check.
- Large catalogues (hundreds of spells as Features) in a table may need pagination to stay as it is today; keep the existing paging before considering virtualisation.

## 7. Character sheet: D&D Beyond review (2026-10-29)

Reviewed read-only in the signed-in browser pane: a level 12 Cleric 10 / Druid 2 at 0 HP and a level 7 Sorcerer, at 1400px and 375px. No dice were rolled (both characters are in campaigns, where rolls post to the game log) and nothing was edited. Only layout and interaction patterns are taken; not its ornate frames, art, colours, branding or rules text.

### What D&D Beyond does

- **Everything core is on screen at once.** Desktop is three columns under the header: ability tiles with saving throws, passive senses and proficiencies on the left; the full skills list in the middle; a tabbed panel on the right (Actions, Spells, Inventory, Features & Traits, Background, Notes, Extras). Skills and saves never need a tab switch.
- **Header and vitals band.** Name, species · class levels and level on the left; Share, Short rest, Long rest and campaign controls on the right. One band of tiles below: six abilities (modifier large, score small), Proficiency, Speed, Heroic Inspiration, and HP.
- **HP widget.** Current / Max / Temp with an amount box between Heal and Damage. At 0 HP the whole widget becomes Death Saves (three failure and three success pips).
- **Initiative, AC, Defenses and Conditions** sit together above the tab panel; Conditions shows "Add Active Conditions" when empty.
- **Actions tab.** Filter chips (All, Attack, Action, Bonus Action, Reaction, Other, Limited Use) and "Attacks per Action". Attacks are table rows: name with source line, Range, Hit/DC, Damage, Notes. Limited-use features show checkbox pips with the reset ("/ Long Rest").
- **Spells tab.** A summary line per caster (modifier, spell attack, save DC); search plus level chips (All, 0–9, concentration/ritual); one group per level whose header carries the slot checkboxes; rows of Time, Range, Hit/DC, Effect, Notes with a Cast button.
- **Details drawer.** Clicking a spell opens a right-side drawer over the sheet: source, school, a Cast with spell slot button and level stepper for upcasting, damage options per element, properties (casting time, range, components, duration, source page) and the description. The sheet keeps its scroll position.
- **Features & Traits** grouped by Class / Species / Feats (filter chips), each with a source citation and nested choices.
- **Inventory**: weight carried and encumbrance, currency, search, chips (Equipment, Backpack, Attunement…), an Active (equipped) checkbox column, Weight, Qty, Cost, Notes.
- **Phone.** A compact sticky header: name, species · class, level, an HP button, then Proficiency, Speed, Initiative and AC with Defenses and Conditions buttons. The page shows **one section at a time**: the floating grid button (bottom right) opens a menu of sections (Abilities/Saves/Senses, Skills, Actions, Inventory, Spells, Features & Traits, Proficiencies & Training, Background, Notes, Extras), and choosing one replaces the content below the header. Each section keeps its desktop controls, minus less important columns (Actions drop Notes; Spells keep Time, Range, Hit/DC, Effect).
- **Phone drawer.** The » button beside it opens the shared side drawer full screen. With nothing selected it reads "Select elements on the character sheet to display more information"; it is the same drawer that shows spell, item and feature details. Tapping HP opens **HP Management** in it (Current / Max / Temp, separate Healing and Damage inputs with a "New HP" preview before applying, max HP modifier and override). The header's log button opens the **Game Log** there (each roll's total, dice and time, with a "send to" audience). A floating dice button (bottom left) opens a free dice roller (not opened).

### Where our sheet differs

- Skills, saves and abilities are behind tabs, so using a skill during play means switching away from Actions or Spells.
- HP is one of six equal boxes; the damage/heal controls are inside an expanded view rather than on the tile.
- Spells are one large card per spell with a nested disclosure; slots are separate cards; no table columns to scan.
- Details navigate away from the sheet (or open a new tab) instead of a drawer that keeps context.
- No conditions/defenses area, no death-save state at 0 HP.
- Strengths to keep: calculation disclosures, System-authored tabs and terminology, sortable skill tables, explicit resource costs, roll history with separate apply, custom tab order.

### Recommended sheet design (Claude style)

1. **Header**: name (serif), race · class levels muted, validity pill, character switcher; System reset buttons (Short rest, Long rest, Dawn) as secondary buttons on the right.
2. **Vitals strip**: one bordered strip with hairline dividers: HP (Current / Max / Temp, amount input with Damage and Heal on the tile), AC, Initiative, Speed, Proficiency, Passive perception. At 0 HP the HP cell switches to death saves where the System defines them.
3. **Rail + panel body** (≥1100px): a left rail (~320px) with ability tiles (existing score/modifier toggle), saving throws, senses and proficiencies; skills as a second rail column or below the abilities; the tabbed panel fills the rest. Under 1100px the rail sits above the panel; phones get one column.
4. **Panel tabs**: Actions, Spells, Inventory, Features & traits, Notes, Roll history, Build choices, in the character's saved order.
   - **Actions**: filter chips from `sheetDisplay.actions.categories` plus Limited use; hairline table rows (name + source, Range, Hit/DC, Damage/Effect, Notes, Use); limited-use pips with their reset name.
   - **Spells**: per-source summary (modifier, attack, DC; already computed); search and level chips; level groups with slot pips in the header; rows of Time, Range, Hit/DC, Effect, Notes, Use spell; description opens in the drawer.
   - **Inventory**: currency strip, search and category chips, Equipped column, weight/qty columns.
   - **Features & traits**: grouped by source progression (Class, Race, Feats), chips to filter, nested children as today.
5. **Details drawer**: right-side panel (full screen on phones) for spells, Features and items; holds Use/cast controls with the casting-level picker, roll controls, properties and source text. Keeps sheet scroll and tab; "Open in new tab" remains.
6. **Status area**: conditions and defenses next to the vitals, shown only when the System defines them (engine/System work, item 8 of the October proposals).
7. **Phone**: sticky compact header (name, race · class, HP button, AC, initiative, speed, proficiency) and one section at a time, as D&D Beyond does. The rail sections (Abilities & saves, Skills) join the panel tabs, and the section switcher is a sticky, horizontally scrolling text-tab row under the header rather than a floating grid button, so the current section is always visible. Narrow tables drop secondary columns (Notes) into the drawer. The drawer opens full screen and also hosts HP management (damage/heal with a resulting-HP preview before applying) and roll history, reached from the HP button and a header icon.

### Data and System changes needed

- Rail placement must stay System-driven: add a placement (for example `sheetTabs[].placement: "rail"`) so DnD5e pins abilities, saves, senses and skills while other Systems keep plain tabs. Changing the bundled System JSON triggers the content-version hook.
- Conditions/defenses and death saves need System-defined mechanics before the UI can show them; until then the strip omits them.
- Spell row columns use existing spell metadata (casting time, range, attack/save); check each column against the bundled data before building it.

### Decisions needed

- Rail + panel layout (skills always visible) instead of skills as its own tab.
- Details drawer instead of navigating to Feature pages from the sheet.
- Whether to include conditions/death saves now (needs engine/System work) or leave them for later.

## 8. Nested Features and choices (2026-10-29)

Reference: the BG3 browser's class rows (Classes → Cleric → Life Domain). Each line is a small source tag ("Cleric", "Life Domain"), a bold name and an inline one-line description; grants that are just lists read as one line ("Spells: Aid, Bless, …"; "Resources: Level 1 spell slot +2"); a choice reads "▸ Choose 1: Divine Order" and expands to an inline list of its options. Its limit: nesting stops after one or two levels; an option inside a choice is only a link, never a node with its own contents.

Our tree uses the same row anatomy with no depth limit:

- **One recursive row component** for every node the engine reports (`instance.parent` links): Feature, choice slot, picked option, resource, use/roll. A picked option is a full node, so it can contain further choices, which contain further options, to any depth.
- **Row anatomy**: disclosure triangle, source tag (owning Class/subclass/race, or Resource/Use/Roll), name, "— " one-line description, and muted meta on the right (level gained, "N inside", or a state: Inactive, Unmet requirements, Needs a choice in `--error`).
- **Indentation**: each level indents 14px with a 1px `--line` guide on the left. To keep phones readable, indentation stops growing after four levels (desktop) or two (375px); deeper rows keep their guide lines and show the parent path ("Spellcasting › Cantrips › Sacred Flame") above the first row of that level.
- **Leaf grants collapse to one line**, as in BG3: spell lists, proficiencies, languages, resources with pips. Each linked name opens the details drawer.
- **Choices** show "Choose N: Name — k of N chosen". Chosen options are child rows; the remaining options appear as one muted line ("Other options: …") on the sheet. In Build choices, an unfilled choice ends with a dashed "Choose 1 more" row that opens the picker in the drawer (search, paging and engine eligibility as today).
- **Rules text** is not printed in full in the tree: the one-line description stays inline, and the full source text opens on expand or in the drawer, so deep trees stay scannable.
- **Controls**: search filters the tree but keeps each match's ancestors visible; Expand all / Collapse all; open state is remembered per character.
- **Uses**: the same component renders the Features & traits tab, Build choices and class progression rows on the catalogue pages, so the three views nest identically.
