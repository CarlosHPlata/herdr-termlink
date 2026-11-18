// HERDR TERMLINK: a retro NASA-punk mission-control layout, in roles.
// The layout gives each copy props { role }:
//   header  the telemetry bar: brand, link state, mission, clock, window buttons
//   side    spaces and agents (pixel sprites) in a bordered box
//   pane    a pane's header: ┤ NAME ├ legend and its status
//   footer  the shown space's tabs and agent counts

import { View, div } from "gpui-kit";
import { props } from "herdr";
import Header from "./header.js";
import Side from "./side.js";
import PaneHead from "./pane.js";
import Footer from "./footer.js";

const ROLES = { header: Header, side: Side, pane: PaneHead, footer: Footer };

export default class Termlink extends View {
  init(p, cx) {
    const pr = props() ?? p ?? {};
    const R = ROLES[pr.role];
    this.role = R ? new R() : null;
    this.role?.init?.(pr, cx);
  }

  render(cx) {
    if (!this.role) return div().child(`termlink: no role "${props()?.role}"`);
    return this.role.render(cx);
  }
}
