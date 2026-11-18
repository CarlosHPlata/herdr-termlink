// Footer: the shown space's tabs as BUILD / TESTS / REVIEW chips, [+], then agent counts.

import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, run } from "herdr";
import { C, MONO, STATUS, upper, neonLine } from "./kit.js";

function tabChip(t) {
  const st = t.status && t.status !== "idle" ? STATUS[t.status] : null;
  return h_flex()
    .id(`tl-tab-${t.id}`)
    .flex_none()
    .h(20)
    .px(10)
    .gap(8)
    .items_center()
    .cursor_pointer()
    .when(t.active, (el) => el.bg(C.brand).text_color(C.onBrand).font_weight(700))
    .when(!t.active, (el) => el.text_color(C.muted).hover((s) => s.bg(C.s200).text_color(C.ink)))
    .on_click(() => run("tab.select", { id: t.id }))
    .on_mouse_down("middle", () => run("tab.close", { id: t.id }))
    .child(upper(t.name))
    .when(Boolean(st), (el) => el.child(div().text_color(t.active ? C.onBrand : st.color).child("■")));
}

export default class Footer {
  render() {
    const space = spaces().find((s) => s.active);
    const tabs = (space?.tabs ?? []).filter((t) => !t.settled || t.active);
    const count = (s) => agents().filter((a) => a.status === s).length;
    const stat = (label, n, color) => div().text_color(n ? color : C.muted).child(`${label} ${n}`);
    return h_flex()
      .id("tl-footer")
      .size_full()
      .gap(16).pt(4)
      .items_center()
      .relative()
      .child(neonLine().absolute().top(0).left(0).right(0))
      .font_family(MONO)
      .text_size(11)
      .child(
        h_flex()
          .flex_1()
          .min_w(0)
          .gap(6)
          .overflow_x_scroll()
          .children(tabs.map(tabChip))
          .child(
            div()
              .id("tl-tab-new")
              .flex_none()
              .h(20)
              .px(6)
              .flex()
              .items_center()
              .text_color(C.muted)
              .cursor_pointer()
              .hover((s) => s.text_color(C.yellow))
              .on_click(() => run("tab.new", space ? { space: space.id } : {}))
              .child("[+]"),
          ),
      )
      .child(
        h_flex()
          .flex_none()
          .gap(6)
          .text_color(C.muted)
          .child(stat("RUN", count("working"), C.success))
          .child("·")
          .child(stat("WAIT", count("blocked"), C.warning))
          .child("·")
          .child(stat("DONE", count("done"), C.ink)),
      );
  }
}
