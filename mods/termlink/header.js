// Telemetry bar: HERDR TERMLINK ── LINK ESTABLISHED ── MISSION 01 / ORBIT ──── T+ 03:12  [_][□][x]

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, machines, run, window as win, nextCommand, shared, setShared } from "herdr";
import { C, MONO, own, upper, neonLine, RAIL_PX } from "./kit.js";

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

export default class Header {
  init(_p, cx) {
    this.start = Date.now();
    // Key commands for the layout: "termlink.side_size" here; side.js takes "termlink.sidebar".
    cx.spawn(async () => {
      for (;;) {
        if ((await nextCommand()) === "side_size") toggleSideSize();
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
