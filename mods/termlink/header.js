// Telemetry bar: HERDR TERMLINK ── LINK ESTABLISHED ── MISSION 01 / ORBIT ──── T+ 03:12  [_][□][x]

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, machines, run, window as win, nextCommand, shared, setShared, layout, openOverlay, settings } from "herdr";
import { C, MONO, own, upper, neonLine, RAIL_PX, geo } from "./kit.js";

const pad = (n) => String(n).padStart(2, "0");

// Hours and minutes since the layout started.
function clock(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function winButton(id, label, command) {
  return own(
    div()
      .id(id)
      .flex_none()
      .px(4)
      .h(22)
      .flex()
      .items_center()
      .text_color(C.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(C.yellow))
      .on_click(() => run(command))
      .child(label),
  );
}

// The sidebar's size: "full" (the box, its width as last dragged) or "small" (the rail).
// ctrl-space shift-b flips it and shows the sidebar if it was hidden; ctrl-space b only
// hides and shows, so showing it again brings back whichever size it had.
// The header handles it because it is always shown (a hidden sidebar gets no commands).
function toggleSideSize() {
  const next = shared("termlink.side.mode") === "small" ? "full" : "small";
  setShared("termlink.side.mode", next);
  run("layout.resize", { id: "sidebar", px: next === "small" ? RAIL_PX : shared("termlink.side.full") ?? 260 });
  run("layout.show", { id: "sidebar" });
}

// ctrl-space e: show the panel on Files and give it the keyboard. A hidden panel gets no
// commands, so the header shows it and termlink-files takes the keyboard when it sees the stamp.
function showFiles() {
  if (filesMode() === "auto-hide-drawer") return openDrawer();
  run("layout.show", { id: "panel" });
  run("layout.select", { stack: "panel-body", child: "files" });
  setShared("termlink.files.focus", Date.now());
}

// The Files panel's mode, from its block in layouts/termlink.json: content.props.mode,
// "pinned" (default), "auto-hide" (the column shows and hides) or "auto-hide-drawer" (it slides
// over the terminals instead). termlink-files reads the same prop.
function filesMode() {
  const find = (n) => {
    if (!n || typeof n !== "object") return null;
    if (n.id === "files" && n.content) return n;
    for (const c of n.children ?? []) { const hit = find(c); if (hit) return hit; }
    return null;
  };
  const m = find(layout())?.content?.props?.mode;
  return m === "auto-hide" || m === "auto-hide-drawer" ? m : "pinned";
}

// ctrl-space o: pinned toggles the panel; auto-hide has nothing to keep open, so it does what
// ctrl-space e does (show Files with the keyboard; it hides again when the keyboard leaves).
function togglePanel() {
  if (filesMode() === "pinned") run("layout.toggle", { id: "panel" });
  else showFiles();
}

// auto-hide-drawer: Files is a drawer over the terminals instead of a column beside them, so nothing
// resizes. A frameless window holding a termlink-files copy (props { mode: "drawer" }) that slides
// itself in and out (keys.js). It sits where the panel column would: right edge of the panes,
// from below the header to above the footer. While it's up it holds "termlink.drawer"; then
// ctrl-space e only gives it the keyboard back.
const DRAWER_W = 340;
function openDrawer() {
  if (shared("termlink.drawer")) return setShared("termlink.files.focus", Date.now());
  const top = 44 + 6 + 8; // header, body padding, panel padding
  // width/height are layout px (Herdr zooms them); `at` is window px, so it's zoomed here.
  const z = settings()?.zoom || 1;
  setShared("termlink.drawer", { at: Date.now() });
  openOverlay({
    kind: "window", mod: "termlink-files", frame: "none", props: { mode: "drawer" },
    width: DRAWER_W, height: geo.bodyH > 100 ? geo.bodyH - 16 : 0.85,
    at: { x: Math.round(Math.max(0, geo.winW - 24 - DRAWER_W) * z), y: Math.round(top * z) },
  });
}

export default class Header {
  init(_p, cx) {
    this.start = Date.now();
    setShared("termlink.drawer", null); // shared.json outlives the window: no drawer is up at start
    // Key commands for the layout: "termlink.side_size" and "termlink.files" here; side.js takes
    // "termlink.sidebar".
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "side_size") toggleSideSize();
        else if (c === "files") showFiles();
        else if (c === "panel") togglePanel();
      }
    });
    // The clock counts minutes: redraw once a minute, on the minute, and only while the
    // window is focused. Unfocused or minimized, ticks skip the redraw; window() is live,
    // so coming back re-renders at once with the current time.
    const tick = (cx) => {
      if (win()?.active) cx.notify();
    };
    const elapsed = (Date.now() - this.start) % 60000;
    cx.timer.after(60000 - elapsed, (cx) => {
      tick(cx);
      cx.timer.every(60000, tick);
    });
  }

  render() {
    const list = spaces();
    const i = list.findIndex((s) => s.active);
    const space = list[i];
    const down = machines().filter((m) => m.layout === "unavailable").length;
    const sep = () => div().flex_none().text_color(C.muted).child("──");
    const w = win();
    return h_flex()
      .id("tl-header")
      .size_full()
      .on_size_change((size) => { geo.winW = Math.round(size.width / (settings()?.zoom || 1)) + 48; })
      .gap(14)
      .items_center()
      .font_family(MONO)
      .text_size(12)
      .text_color(C.muted)
      .child(div().flex_none().font_weight(700).text_color(C.yellow).child("HERDR TERMLINK"))
      .child(sep())
      .child(
        div()
          .flex_none()
          .text_color(down ? C.danger : C.muted)
          .child(down ? `LINK DEGRADED · ${down} OFFLINE` : "LINK ESTABLISHED"),
      )
      .child(sep())
      .child(div().flex_none().truncate().child(`MISSION ${pad(i + 1)} / ${upper(space?.name ?? "STANDBY")}`))
      .child(neonLine().flex_1().min_w(40))
      .child(
        h_flex()
          .flex_none()
          .gap(6)
          .child("T+")
          .child(div().text_color(C.ink).child(clock(Date.now() - this.start))),
      )
      .when(Boolean(w?.buttons), (el) =>
        el.child(
          h_flex()
            .flex_none()
            .gap(2)
            .pl(8)
            .child(winButton("tl-min", "[_]", "window.minimize"))
            .child(winButton("tl-max", w.maximized ? "[▫]" : "[□]", "window.maximize"))
            .child(winButton("tl-close", "[x]", "window.close")),
        ),
      );
  }
}
