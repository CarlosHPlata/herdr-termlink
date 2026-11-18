# Termlink

A retro NASA-punk mission-control layout for Herdr: a dark navy window with neon blue
box borders, a yellow `HERDR TERMLINK` telemetry bar, a sidebar of machines → spaces
above pixel-sprite agents, square monospace pane headers (`┤ ▒ CLAUDE ├`), and a footer
of tab chips with live agent counts. Everything is JetBrains Mono and every corner is square.
The sidebar has three states: full, a minimal 64px rail, and hidden.

![Termlink](preview.png)

## What you see

Top to bottom, inside 24px side padding on a `#1e1e2ecc` window (blurred where the system can):

- **Header, 44px** (drags the window). `HERDR TERMLINK` bold `#fbd207` · `──` ·
  `LINK ESTABLISHED` muted `#5bb0b0`, or `LINK DEGRADED · N OFFLINE` in `#ff5a5c` while a
  machine's layout is unavailable · `──` · `MISSION 02 / <SHOWN SPACE>` · a neon line filling
  the rest · `T+ 00:12` (hours:minutes since the layout started, value in `#cdd6f4`) ·
  `[_] [□] [x]` window buttons where the system draws none (Windows, Linux).
- **Body**, a row with 16px gap and 6px vertical padding:
  - **Sidebar, 260px** (resizable 56–420). A box whose border is neon: a 1px `#89b4fa` core
    with fading rings 3px out and in. Legend on the top border: `SPACES` (yellow and bold while the box holds the keyboard);
    `[+]` (new space) on the top border's right.
    - Spaces half: per machine a row `▾ LOCAL ───── ` (11px, muted, uppercase; folds on
      click). On hover a `[+]` appears at its right (new space on that machine); an offline
      machine shows `▸ NAME ──── OFFLINE` in red and opens Settings → Machines on click.
      Under it its spaces, 30px rows, lowercase names indented 28px, a 7px clay `#d97757`
      square at the right when any tab in it runs an agent. The shown space: `#313244`
      background, `#82f2eb` bold text.
    - `── AGENTS ──` rule (28px), the drag handle between the halves.
    - Agents half: 40px rows, a 33×24 pixel sprite (11×8 cells), `CLAUDE` and
      `SPACE · TAB` under it, a `[RUN]` / `[WAIT]` / `[DONE]` / `[IDLE]` tag at the right.
    - Foot: a dashed `#45475a` rule, then key hints `^␣0 focus  ⏎ open  n new space  m machine  ? keys`
      (keys yellow; clicking a hint does the same).
  - **Panes**: the shown tab, 16px gap, square, `#2a2b3d` 1px border (`#45475a` focused),
    transparent background. Each pane has a 28px header: `┤ [sprite] NAME ├` (bold when
    focused), its folder (`~/…`), and its status (`● RUNNING` green, `▲ WAITING` yellow,
    `✓ DONE`, `IDLE`). The focused pane's header has a soft inner glow and a glowing rule
    under it; the others a faint dashed rule.
- **Footer, 32px**. A neon line on top. The shown space's tabs as chips (shown one: `#82f2eb`
  fill, dark bold text), a small status square on chips whose agents aren't idle, `[+]` new
  tab; at the right `RUN n · WAIT n · DONE n` in their status colors.

Colors (theme `termlink`): background `#1e1e2e`, surfaces `#26263a` / `#313244`, lines
`#89b4fa`, ink `#cdd6f4`, muted `#5bb0b0`, brand `#82f2eb`, yellow `#fbd207`, green
`#32f68a`, red `#ff5a5c`, Claude clay `#d97757`.

### The minimal rail (sidebar small)

64px wide, no legend, no `[+]`, no key hints. Machines are 3-letter tags (`LOC`, `WSL`,
12px, 75% opacity; offline ones red at 50%) with a dimmed `#5bb0b02e` rule above every
machine but the first. Spaces are 44×30 two-letter buttons (`notes-vault` → `NV`, 8px,
`#cdd6f4`), the shown one raised with cyan bold text, a 3px muted dot top-right when an agent
runs inside. A short `──` handle splits it. Agents are still 11×8 sprites (1px cells) at 60%
opacity; the focused and any waiting agent at full. Names show as tooltips.

## How it behaves

- **Agent status**: working: green sprite that walks (two frames, 400 ms) and `[RUN]`;
  blocked: yellow sprite that waves (800 ms) and `[WAIT]`; done: white still sprite, `[DONE]`;
  idle: still sprite in the program's color (clay for Claude), `[IDLE]`. In the rail nothing
  animates.
- **Clicks**: a space selects it; an agent focuses it; a footer chip selects its tab
  (middle-click closes it); machine rows fold; pane-header hover shows `[│] [─] [+] [x]`
  (split right, split down, zoom, close).
- **Split**: spaces and agents share the sidebar 50/50; drag the `── AGENTS ──` rule to
  change it (each half at least 60px), double-click it for 50/50 again. Remembered per copy.
  Each half scrolls on its own; its scrollbar shows only while scrolling.
- **Keys** (`keys.json`):
  - `ctrl-space 0`: the sidebar takes the keyboard (its border and legend turn yellow).
    Then `↑↓` / `j k` move a yellow cursor through the spaces, `⏎` opens one and gives the
    keyboard to its pane, `n` new space, `m` add a machine, `?` help, `esc` back.
  - `ctrl-space b`: hide / show the sidebar. Showing it brings back the size it had.
  - `ctrl-space shift-b`: switch between full and the rail (and show it if hidden). The size
    is kept in shared state (`termlink.side.mode`), the full width as last dragged in
    `termlink.side.full`, so both survive restarts.

## Built from

- `layouts/termlink.json`: a column: `header` block (44px, `window_drag`), `body` row
  (`sidebar` block 260px, min 56, max 420; `main` block with `{ "tab": "active" }` and its
  pane frames), `footer` block (32px). Root: `titlebar: "none"`, `theme: "termlink"`,
  JetBrains Mono for terminals and mods, `window_blur`, `terminal_opacity: 0`, transparent
  `background`/`canvas`/`chrome` colors.
- `themes/termlink.json`: the palette above.
- `mods/termlink/`, one mod in roles (`props.role`): `header`, `side`, `pane` (the tab
  block's pane header, 28px, top), `footer`. `main.js` picks the role; `kit.js` holds the
  palette, the neon `box()` and `neonLine()`, `sprite()` (block characters, animated with
  `.frames()`), `pixels()` (1px divs for the rail), `RAIL_PX`.
- Herdr functions: `spaces`, `agents`, `panes`, `machines`, `run`, `hc(["machine","ls","--json"])`
  (only when `machines()` changes, never on a timer), `openOverlay` (the shipped
  `machine-add` dialog), `shared` / `setShared`, `nextCommand`, `focused`, `settings`,
  `setAgentOrder`, `window()`. Commands: `space.select`, `space.new`, `tab.select`,
  `tab.new`, `tab.close`, `agent.focus`, `pane.split|zoom|close|focus`, `layout.resize`,
  `layout.show`, `app.settings`, `app.help`, `window.minimize|maximize|close`.
- Shipped mods used: `machine-add`.

## Watch out

- Every copy of a mod gets every `<mod>.<command>`; each role ignores what isn't its own.
  A hidden sidebar gets none, so the header (always shown) handles `side_size`.
- `FocusHandle.focus()` can't run during render: focus from the `nextCommand()` task.
- `on_size_change` reports zoomed pixels; layout sizes are at zoom 1. Divide by
  `settings().zoom` before storing the full width, or it grows by the zoom on every switch.
- Rows that fill the box must stay inside its border's rings (about 6px): the body is inset
  7px, or a highlighted row covers the neon edge.
- The clock redraws once a minute, and only while the window is focused. Don't animate with
  timers; sprites use `.frames()`.
- The sidebar's `min` must be ≤ 64 for the rail; the full sidebar can then be dragged that
  narrow too.
- Spaces' agent squares come from `panes()` (any pane of any tab with an agent program or a
  status), not `agents()`, so a space with an idle shell-started agent still shows one.

## Done when

- `herdr-app check mods/termlink` passes and `layout.switch {name: "termlink"}` shows the
  header, sidebar box, panes and footer as above, with no `layout.error`.
- With another machine added and offline, the header reads `LINK DEGRADED · 1 OFFLINE` and
  the sidebar lists it as `OFFLINE`; clicking it opens Settings → Machines.
- A running Claude shows a walking green sprite and `[RUN]` in the sidebar, `● RUNNING` in
  its pane header, and `RUN 1` in the footer.
- `ctrl-space shift-b` turns the sidebar into the 64px rail; `ctrl-space b` twice hides and
  shows it still as the rail; `ctrl-space shift-b` brings back the full sidebar at its
  previous width.
- `ctrl-space 0` (or clicking `^␣0 focus`) turns the sidebar border yellow; `↓` then `⏎` opens the next space.
- Dragging `── AGENTS ──` changes the split, and it is the same after reloading the mod.
