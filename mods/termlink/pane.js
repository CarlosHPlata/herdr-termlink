// A pane's header: ┤ ▒ CLAUDE ├ on the left, its status (or folder) on the right.
// Hover shows split / zoom / close.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, home, spaces } from "herdr";
import { C, MONO, statusOf, sprite, upper, neonLine, innerGlow, GLOW } from "./kit.js";

function folder(cwd) {
  if (!cwd) return "";
  const h = home().replace(/\\/g, "/");
  const c = cwd.replace(/\\/g, "/");
  return c === h ? "~" : c.toLowerCase().startsWith(h.toLowerCase() + "/") ? "~" + c.slice(h.length) : c;
}

export default class PaneHead {
  init() {
    this.hovered = false;
  }

  button(id, label, command, args) {
    return div()
      .id(id)
      .flex_none()
      .px(3)
      .text_color(C.muted)
      .cursor_pointer()
      .hover((s) => s.text_color(C.yellow))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(label);
  }

  render(cx) {
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const pane = p.pane;
    const st = p.status ? statusOf(p.status, p.program) : null;
    // A file viewer pane (termlink-viewer) is named after its tab, which is the file's name.
    const viewerTab = p.mod === "termlink-viewer" ? spaces().flatMap((s) => s.tabs ?? []).find((t) => t.id === p.tab) : null;
    const name = viewerTab?.name
      ? upper(viewerTab.name)
      : upper(((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell").replace(/ CODE$/, "");
    const edge = p.focused ? C.ink : C.muted;
    return h_flex()
      .id(`tl-ph-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .relative()
      .when(!p.focused, (el) => el.border_b(1).border_dashed().border_color(C.frame + "80"))
      .when(p.focused, (el) =>
        el
          .child(innerGlow(C.frameFocus))
          .child(neonLine(C.frameFocus, GLOW).absolute().left(0).right(0).bottom(-3)),
      )
      .font_family(MONO)
      .text_size(11)
      .on_hover((h, cx) => {
        this.hovered = h;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane }))
      .child(
        h_flex()
          .flex_none()
          .gap(8)
          .items_center()
          .text_color(edge)
          .when(p.focused, (el) => el.font_weight(700))
          .child("┤")
          .when(Boolean(st), (el) => el.child(sprite(st.sprite, st.color, 2, st.ms)))
          .child(div().max_w(260).truncate().child(name))
          .child("├"),
      )
      .child(div().flex_1().min_w(0).truncate().text_color(C.muted).child(folder(p.cwd)))
      .when(this.hovered, (el) =>
        el
          .child(this.button(`tl-r-${pane}`, "[│]", "pane.split", { direction: "right", pane }))
          .child(this.button(`tl-d-${pane}`, "[─]", "pane.split", { direction: "down", pane }))
          .child(this.button(`tl-z-${pane}`, p.zoomed ? "[-]" : "[+]", "pane.zoom", { pane }))
          .child(this.button(`tl-x-${pane}`, "[x]", "pane.close", { pane })),
      )
      .when(Boolean(st), (el) => el.child(div().flex_none().text_color(st.color).child(st.label)));
  }
}
