// Shared palette, type and pieces for the TERMLINK layout.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";

export const C = {
  bg: "#1e1e2e",
  s100: "#26263a",
  s200: "#313244",
  line: "#89b4fa", // neon blue: every box and rule
  frame: "#2a2b3d", // pane frames: a faint dark grey
  frameFocus: "#45475a", // the focused pane: dark grey
  ink: "#cdd6f4",
  muted: "#5bb0b0",
  brand: "#82f2eb",
  onBrand: "#1e1e2e",
  yellow: "#fbd207",
  success: "#32f68a",
  warning: "#fbd207",
  danger: "#ff5a5c",
  dangerLine: "#f5090d",
};

export const MONO = "JetBrains Mono";

// The sidebar's width in its minimal state (the rail).
export const RAIL_PX = 64;

// Agent status → how it reads.
export const STATUS = {
  working: { tag: "[RUN]", label: "● RUNNING", color: C.success, sprite: "run", ms: 400 },
  blocked: { tag: "[WAIT]", label: "▲ WAITING", color: C.warning, sprite: "wait", ms: 800 },
  done: { tag: "[DONE]", label: "✓ DONE", color: C.ink, sprite: "done" },
  idle: { tag: "[IDLE]", label: "IDLE", color: C.muted, sprite: "done" },
};

// Idle agents wear their program's own color (Claude: its logo's clay red).
const IDLE_COLOR = { claude: "#d97757" };

// How a status reads for this program.
export function statusOf(status, program) {
  const st = STATUS[status];
  if (!st) return null;
  const own = status === "idle" && IDLE_COLOR[program?.key];
  return own ? { ...st, color: own } : st;
}

// 11×8 pixel sprites; animated ones have two frames.
const SPRITES = {
  run: [
    ["...XXXXX...", ".XXXXXXXXX.", "XX..XXX..XX", "XXXXXXXXXXX", "..XXX.XXX..", ".XX.X.X.XX.", "XX.......XX", "..........."],
    ["...XXXXX...", ".XXXXXXXXX.", "XX..XXX..XX", "XXXXXXXXXXX", "..XXX.XXX..", "..X.X.X.X..", "...X...X...", "..........."],
  ],
  wait: [
    ["X.........X", ".X.XXXXX.X.", "..XXXXXXX..", ".XX.XXX.XX.", ".XXXXXXXXX.", "..XXXXXXX..", "..X.....X..", ".XX.....XX."],
    ["...........", "...XXXXX...", "..XXXXXXX..", ".XX.XXX.XX.", "XXXXXXXXXXX", "X.XXXXXXX.X", "..X.....X..", ".XX.....XX."],
  ],
  err: [
    ["X...X...X..", ".X..X..X..X", "...X.X.....", "XX..X..X.XX", ".....X.X...", ".X..X..X...", "X...X....X.", "..X.....X.."],
  ],
  done: [
    ["...........", "...XXXXX...", ".XXXXXXXXX.", "XX.XXXXX.XX", "XXXXXXXXXXX", ".XX.XXX.XX.", "XXXXXXXXXXX", "..........."],
  ],
};

const row = (s) => s.replace(/X/g, "██").replace(/\./g, "  ");

// A pixel sprite drawn as block characters; animated sprites flip rows natively.
// px: one pixel's size (3 = 33×24, 2 = 22×16).
export function sprite(name, color, px = 3, ms = 0) {
  const frames = SPRITES[name] ?? SPRITES.done;
  const size = px / 1.2; // two glyphs of 0.6em make one pixel
  return div()
    .flex_none()
    .w(px * 11)
    .h(px * 8)
    .overflow_hidden()
    .font_family(MONO)
    .text_size(size)
    .line_height(`${px}px`)
    .text_color(color)
    .children(
      frames[0].map((_, i) => {
        const r = div().h(px).whitespace_nowrap();
        return frames.length > 1 && ms ? r.frames(frames.map((f) => row(f[i])), ms) : r.child(row(frames[0][i]));
      }),
    );
}

// A still, tiny sprite drawn as real pixels (1px cells: 11×8), for the minimal rail.
// Only the first frame: the rail doesn't animate.
export function pixels(name, color, px = 1) {
  const rows = (SPRITES[name] ?? SPRITES.done)[0];
  return div()
    .flex_none()
    .w(px * 11)
    .h(px * 8)
    .children(
      rows.map((r) =>
        h_flex().h(px).children([...r].map((ch) => div().flex_none().size(px).when(ch === "X", (el) => el.bg(color)))),
      ),
    );
}

// A control in a draggable bar keeps its own press.
export function own(el) {
  return el
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

// Neon: a bright 1px core with fading rings of the same color on each side.
// [offset from the core (px, + = outward), alpha suffix]
const HALO = [[3, "0a"], [2, "17"], [1, "33"], [0, "73"], [-1, "33"], [-2, "17"], [-3, "0a"]];

// A horizontal neon line, `HALO`'s rings stacked above and below its core.
export function neonLine(color = C.line, halo = HALO) {
  return div()
    .relative()
    .h(7)
    .min_w(0)
    .children(halo.map(([o, a]) => div().absolute().left(0).right(0).top(3 - o).h(1).bg(color + a)));
}

// The focused pane's glow: a full-strength core and bright rings.
export const GLOW = [[1, "1a"], [0, "80"], [-1, "1a"]];

// Light spilling inward from a border: rings fading away from the edge (top, going down).
export function innerGlow(color) {
  return div()
    .absolute()
    .top(0)
    .left(0)
    .right(0)
    .h(2)
    .children([["17", 0], ["0a", 1]].map(([a, y]) => div().absolute().left(0).right(0).top(y).h(1).bg(color + a)));
}

// A box with a legend sitting on its top border, like ┌─ SPACES ──┐.
// The border is neon: rings fade out from the core line both ways.
const INSET = 3; // room for the outer rings inside the block
export function box(id, legend, right, borderColor = C.line) {
  return div()
    .id(id)
    .relative()
    .size_full()
    .pt(8)
    .children(
      HALO.map(([o, a]) =>
        div()
          .absolute()
          .top(8 - o)
          .left(INSET - o)
          .right(INSET - o)
          .bottom(INSET - o)
          .border_1()
          .border_color(borderColor + a),
      ),
    )
    .when(Boolean(legend), (el) =>
      el.child(h_flex().absolute().top(0).left(14).px(6).h(16).items_center().bg(C.bg).child(legend)),
    )
    .when(Boolean(right), (el) =>
      el.child(h_flex().absolute().top(0).right(14).px(6).h(16).items_center().bg(C.bg).child(right)),
    );
}

export const upper = (s) => String(s ?? "").toUpperCase();

// Window geometry for the Files drawer (auto-hide), in layout px (zoom 1): the header reports
// winW (its width + the root's 24px side padding), the sidebar bodyH (the body row's height).
// Shared by the copies of this mod; written only when a size changes.
export const geo = { winW: 0, bodyH: 0 };
