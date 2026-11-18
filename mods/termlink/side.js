// Sidebar: a bordered SPACES box with the spaces grouped by machine (LOCAL first, then
// each connected or known machine, offline ones too), then ── AGENTS ── with pixel sprites.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, agents, panes, machines, hc, run, openOverlay, setAgentOrder, nextCommand, focused, shared, setShared, settings } from "herdr";
import { C, MONO, STATUS, statusOf, sprite, pixels, box, upper, RAIL_PX } from "./kit.js";

// Two letters for a space in the rail: the first letters of its first two words
// (notes-vault: NV), else its first two letters.
function initials(name) {
  const w = String(name ?? "").split(/[-_\s.]+/).filter(Boolean);
  return upper(w.length > 1 ? w[0][0] + w[1][0] : (w[0] ?? "?").slice(0, 2));
}

// The split between spaces and agents: the ── AGENTS ── rule is its handle.
const HANDLE = 28;
const MIN_HALF = 60; // neither half shrinks below this

// A space with an agent in it gets a clay square (old machines draw pixels, not dots).
const AGENT_DOT = "#d97757";

// A space under its machine: its name, indented to the machine's name, and the clay
// square when an agent runs in it. Tabs live in the footer, so the tree stops here.
// The shown space: raised, brand text, bold.
function spaceRow(s, cursor, hasAgent) {
  return h_flex()
    .id(`tl-sp-${s.id}`)
    .flex_none()
    .h(30)
    .pl(28)
    .pr(10)
    .gap(8)
    .items_center()
    .cursor_pointer()
    .when(s.active, (el) => el.bg(C.s200).text_color(C.brand).font_weight(700))
    .when(!s.active, (el) => el.text_color(C.muted).hover((st) => st.bg(C.s200).text_color(C.ink)))
    .when(cursor, (el) => el.bg(C.s100).text_color(C.yellow))
    .on_click(() => run("space.select", { id: s.id }))
    .child(div().flex_1().min_w(0).truncate().child(s.name))
    .when(hasAgent, (el) => el.child(div().flex_none().size(7).bg(AGENT_DOT)));
}

// A key hint at the box's foot; clicking it does the same.
function keyHint(id, key, label, onClick) {
  return h_flex()
    .id(id)
    .flex_none()
    .gap(4)
    .cursor_pointer()
    .hover((s) => s.text_color(C.ink))
    .when(Boolean(onClick), (el) => el.on_click(() => onClick()))
    .child(div().font_weight(600).text_color(C.yellow).child(key))
    .child(label);
}

function agentName(a) {
  return upper(a.program?.name ?? a.app ?? a.title ?? "agent").replace(/ CODE$/, "");
}

function agentRow(a) {
  const st = statusOf(a.status, a.program) ?? STATUS.idle;
  const quiet = a.status === "idle" || a.status === "done";
  return h_flex()
    .id(`tl-ag-${a.address}`)
    .flex_none()
    .min_h(40)
    .px(8)
    .gap(12)
    .items_center()
    .cursor_pointer()
    .when(a.focused, (el) => el.bg(C.s100))
    .hover((s) => s.bg(C.s200))
    .on_click(() => run("agent.focus", { terminal: a.address }))
    .child(sprite(st.sprite, st.color, 3, st.ms))
    .child(
      v_flex()
        .flex_1()
        .min_w(0)
        .child(div().truncate().text_color(quiet ? C.muted : C.ink).child(agentName(a)))
        .child(div().truncate().text_size(10).text_color(C.muted).child(upper(a.space_name) + " · " + upper(a.tab_name))),
    )
    .child(div().flex_none().text_color(st.color).child(st.tag));
}

// A small [+] style button that keeps its click to itself.
function plus(id, label, tip, onClick) {
  return div()
    .id(id)
    .flex_none()
    .px(2)
    .cursor_pointer()
    .text_color(C.muted)
    .hover((s) => s.text_color(C.brand))
    .tooltip(tip)
    .on_click((_e, cx) => {
      cx.stop_propagation();
      onClick(cx);
    })
    .child(label);
}

// A machine: ▾ NAME ──── [+] (the [+] only while hovered: a new space there),
// or ▸ NAME ──── OFFLINE. Click folds an online one; an offline one opens
// Settings → Machines.
function machineRow(m, folded, fold, hovered, onHover) {
  const key = m.name ?? "local";
  // The [+] keeps its room when hidden, so the line doesn't jump on hover.
  const add = plus(`tl-m-new-${key}`, "[+]", `New space on ${m.name ?? "this computer"}`, () => run("space.new", { machine: m.name ?? "" }));
  return h_flex()
    .id(`tl-m-${key}`)
    .flex_none()
    .h(24)
    .px(10)
    .gap(8)
    .items_center()
    .text_size(11)
    .cursor_pointer()
    .text_color(C.muted)
    .hover((s) => s.text_color(C.ink))
    .on_hover((h, cx) => onHover(key, h, cx))
    .on_click((_e, cx) => (m.online ? fold(key, cx) : run("app.settings", { section: "machines" })))
    .child(div().flex_none().w(10).text_size(14).child(folded || !m.online ? "▸" : "▾"))
    .child(div().flex_none().child(upper(m.name ?? "local")))
    .child(div().flex_1().min_w(12).h(1).bg(C.muted + "38"))
    .child(m.online ? (hovered ? add : div().flex_none().invisible().px(2).child("[+]")) : div().flex_none().text_color(C.danger).child("OFFLINE"));
}

export default class Side {
  init(_p, cx) {
    this.known = []; // hc machine ls: every added machine, offline ones too
    try {
      this.folded = new Set(JSON.parse(localStorage.getItem("folded") ?? "[]"));
    } catch {
      this.folded = new Set();
    }
    this.mkey = null;
    this.handle = cx.focus_handle();
    this.cursor = null; // the space under the keyboard cursor
    this.back = null; // the pane to give the keyboard back to
    this.ratio = null; // spaces' share of the split; null: 50/50
    try {
      const r = parseFloat(localStorage.getItem("split") ?? "");
      if (r > 0 && r < 1) this.ratio = r;
    } catch {}
    // ctrl-space 0 ("termlink.sidebar"; every copy gets key commands, the other roles
    // ignore this one): take the keyboard, cursor on the shown space.
    cx.spawn(async (cx) => {
      for (;;) {
        if ((await nextCommand()) !== "sidebar") continue;
        this.back = focused()?.pane ?? null;
        this.cursor = (spaces().find((s) => s.active) ?? spaces()[0])?.id ?? null;
        this.handle.focus();
        cx.notify();
      }
    });
  }

  // ↑↓ / j k move, ⏎ opens the space, n new space, m machine, ? keys, esc goes back.
  key(e, order, cx) {
    const i = Math.max(0, order.findIndex((s) => s.id === this.cursor));
    const k = e.key;
    if (k === "down" || k === "j") this.cursor = order[(i + 1) % order.length]?.id ?? null;
    else if (k === "up" || k === "k") this.cursor = order[(i + order.length - 1) % order.length]?.id ?? null;
    else if (k === "enter") {
      // Show that space and hand the keyboard to its tab's focused pane.
      const s = order.find((x) => x.id === this.cursor);
      this.cursor = null;
      if (s) {
        run("space.select", { id: s.id });
        const tab = (s.tabs.find((t) => t.active) ?? s.tabs[0])?.id;
        const ps = panes().filter((p) => p.tab === tab);
        this.back = (ps.find((p) => p.focused) ?? ps[0])?.pane ?? this.back;
      }
      if (this.back) run("pane.focus", { pane: this.back });
    } else if (k === "n") run("space.new");
    else if (k === "m") openOverlay({ mod: "machine-add", kind: "dialog", width: 560 });
    else if (k === "?" || k === "/") run("app.help");
    else if (k === "escape") {
      this.cursor = null;
      if (this.back) run("pane.focus", { pane: this.back });
    } else return;
    cx.stop_propagation();
    cx.notify();
  }

  // Ask herdr-core for its machines, only when the app's machine list changes (no timer).
  refreshMachines(cx) {
    const key = JSON.stringify(machines());
    if (key === this.mkey) return;
    this.mkey = key;
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["machine", "ls", "--json"]);
        if (r.code === 0) this.known = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary);
      } catch {}
      cx.notify();
    });
  }

  // LOCAL, then every other machine by name, with whether it answers now.
  groups(list) {
    const live = machines();
    const names = new Set([
      ...live.map((m) => m.name).filter(Boolean),
      ...this.known.map((m) => m.name),
      ...list.map((s) => s.machine).filter(Boolean),
    ]);
    const remote = [...names].sort().map((name) => {
      const k = this.known.find((m) => m.name === name);
      const layout = live.find((m) => m.name === name)?.layout;
      const online = k ? k.state === "connected" : layout === "ready";
      return { name, online, why: k?.why };
    });
    return [{ name: null, online: true }, ...remote];
  }

  render(cx) {
    this.refreshMachines(cx);
    const list = spaces();
    const ps = panes();
    // Which machine row the pointer is on (its [+] shows).
    const hoverM = (key, h, cx) => {
      if (h) this.hoverM = key;
      else if (this.hoverM === key) this.hoverM = null;
      cx.notify();
    };
    const fold = (key, cx) => {
      this.folded.has(key) ? this.folded.delete(key) : this.folded.add(key);
      try {
        localStorage.setItem("folded", JSON.stringify([...this.folded]));
      } catch {}
      cx.notify();
    };
    const machs = this.groups(list);
    const small = shared("termlink.side.mode") === "small";
    // The spaces in tree order, as the keyboard cursor walks them (folded and offline
    // skipped; the rail folds nothing).
    const order = machs.flatMap((m) =>
      (!small && this.folded.has(m.name ?? "local")) || !m.online ? [] : list.filter((s) => (s.machine ?? null) === m.name),
    );
    const focus = this.handle.is_focused();
    if (!focus) this.cursor = null;
    if (small) return this.rail(machs, list, ps, order, focus);
    // machines → spaces; a machine is one group (its header, then its spaces).
    const groups = machs.map((m) => {
      const key = m.name ?? "local";
      const folded = this.folded.has(key);
      const mine = folded || !m.online ? [] : list.filter((s) => (s.machine ?? null) === m.name);
      const body = mine.length
        ? mine.map((s) => spaceRow(s, focus && s.id === this.cursor, ps.some((p) => s.tabs.some((t) => t.id === p.tab) && (p.program?.agent || p.status))))
        : m.online && !folded
          ? [h_flex().id(`tl-m-empty-${key}`).flex_none().h(30).pl(28).pr(10).items_center().text_color(C.muted + "aa").cursor_pointer()
              .hover((s) => s.text_color(C.ink)).on_click(() => run("space.new", { machine: m.name ?? "" }))
              .child("+ new space")]
          : [];
      return v_flex().flex_none().child(machineRow(m, folded, fold, this.hoverM === key, hoverM)).children(body);
    });
    const addMachine = () => openOverlay({ mod: "machine-add", kind: "dialog", width: 560 });
    const keys = h_flex()
      .flex_none()
      .flex_wrap()
      .gap_x(14)
      .gap_y(4)
      .pt(10)
      .px(10)
      .border_t_1()
      .border_dashed()
      .border_color(C.frameFocus)
      .text_size(11)
      .text_color(C.muted)
      // ctrl-space 0 takes the keyboard; clicking the hint does the same.
      .child(keyHint("tl-k-focus", "^␣0", "focus", () => {
        this.back = focused()?.pane ?? null;
        this.cursor = (list.find((s) => s.active) ?? list[0])?.id ?? null;
        this.handle.focus();
      }))
      .child(keyHint("tl-k-open", "⏎", "open"))
      .child(keyHint("tl-k-new", "n", "new space", () => run("space.new")))
      .child(keyHint("tl-k-machine", "m", "machine", addMachine))
      .child(keyHint("tl-k-help", "?", "keys", () => run("app.help")));
    const ags = agents();
    setAgentOrder(ags.map((a) => a.address));
    const newSpace = plus("tl-space-new", "[+]", "New space", () => run("space.new"));
    // The legend turns yellow while the box holds the keyboard (ctrl-space 0, in the key hints).
    const legend = div().text_size(11).text_color(focus ? C.yellow : C.ink).when(focus, (el) => el.font_weight(700)).child("SPACES");
    return box("tl-side", legend, div().text_size(11).child(newSpace), focus ? C.yellow : C.line)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, order, cx))
      // Remember the full width as dragged, so leaving the rail brings it back.
      .on_size_change((size) => {
        // Layout sizes are at zoom 1; what we measure is zoomed.
        const w = Math.round(size.width / (settings()?.zoom || 1));
        if (w > RAIL_PX + 40 && Math.abs(w - (shared("termlink.side.full") ?? 0)) > 1) setShared("termlink.side.full", w);
      })
      .font_family(MONO)
      .text_size(13)
      .child(
        v_flex()
          .id("tl-side-body")
          .absolute()
          .top(8)
          .left(0)
          .right(0)
          .bottom(0)
          .pt(16)
          .px(7)
          .pb(10)
          .gap(10)
          .child(this.split(groups, ags))
          .child(keys),
      );
  }

  // Spaces above, agents below, 50/50 until the ── AGENTS ── rule is dragged (the ratio
  // is remembered). Each half scrolls on its own; its bar shows only while scrolling.
  // The minimal state (ctrl-space shift-b): a 64px rail, same order as the box.
  // Machines are tiny faded tags (offline: dimmed red, click opens their settings);
  // spaces are two-letter buttons, each with a dimmed rule on top and a 3px dot when an
  // agent runs inside; agents are still 11×8 sprites at 60% (waiting stays bright).
  // Names show as tooltips. No legend, no [+], no key hints.
  rail(machs, list, ps, order, focus) {
    const top = v_flex().items_center().gap(4);
    for (const m of machs) {
      const key = m.name ?? "local";
      const tag = upper(key).slice(0, 3);
      top.child(
        div()
          .id(`tl-r-m-${key}`)
          .flex_none()
          .w_full()
          .pt(8)
          .pb(2)
          .flex()
          .justify_center()
          // A dimmed rule above every machine but the first.
          .when(m !== machs[0], (el) => el.mt(6).border_t_1().border_color(C.muted + "2e"))
          .text_size(12)
          .text_color(m.online ? C.muted : C.danger)
          .opacity(m.online ? 0.75 : 0.5)
          .tooltip(m.online ? (m.name ?? "this computer") : `${m.name}: offline`)
          .when(!m.online, (el) => el.cursor_pointer().on_click(() => run("app.settings", { section: "machines" })))
          .child(tag),
      );
      if (!m.online) continue;
      for (const s of list.filter((x) => (x.machine ?? null) === m.name)) {
        const cursor = focus && s.id === this.cursor;
        const agent = ps.some((p) => s.tabs.some((t) => t.id === p.tab) && (p.program?.agent || p.status));
        top.child(
          div()
            .id(`tl-r-sp-${s.id}`)
            .relative()
            .flex_none()
            .w(44)
            .h(30)
            .flex()
            .items_center()
            .justify_center()
            .text_size(8)
            .cursor_pointer()
            .text_color(C.ink)
            .hover((st) => st.bg(C.s200))
            .when(s.active, (el) => el.bg(C.s200).text_color(C.brand).font_weight(700))
            .when(cursor, (el) => el.bg(C.s100).text_color(C.yellow))
            .tooltip(s.name)
            .on_click(() => run("space.select", { id: s.id }))
            .child(initials(s.name))
            .when(agent, (el) => el.child(div().absolute().top(5).right(5).size(3).bg(C.muted).opacity(0.7))),
        );
      }
    }
    const ags = agents();
    setAgentOrder(ags.map((a) => a.address));
    const bottom = v_flex()
      .items_center()
      .gap(4)
      .children(
        ags.map((a) => {
          const st = statusOf(a.status, a.program) ?? STATUS.idle;
          return h_flex()
            .id(`tl-r-ag-${a.address}`)
            .flex_none()
            .w(44)
            .h(24)
            .items_center()
            .justify_center()
            .cursor_pointer()
            .when(a.focused, (el) => el.bg(C.s100))
            .hover((s) => s.bg(C.s200))
            .tooltip(`${agentName(a)} · ${a.space_name} · ${a.status ?? "idle"}`)
            .on_click(() => run("agent.focus", { terminal: a.address }))
            .child(div().opacity(a.status === "blocked" || a.focused ? 1 : 0.6).child(pixels(st.sprite, st.color)));
        }),
      );
    return box("tl-side", null, null, focus ? C.yellow : C.line)
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, order, cx))
      .font_family(MONO)
      .child(
        v_flex()
          .id("tl-side-body")
          .absolute()
          .top(8)
          .left(0)
          .right(0)
          .bottom(0)
          .pt(10)
          .px(7)
          .pb(10)
          .child(this.split(top, bottom, true)),
      );
  }

  // `small`: the rail's halves (already built) and a bare ── handle.
  split(groups, ags, small = false) {
    const handleH = small ? 16 : HANDLE;
    const H = this.splitH ?? 0; // the split area's height, once laid out
    const room = H - handleH;
    const custom = this.ratio != null && room > 2 * MIN_HALF;
    const top = custom ? Math.round(Math.min(room - MIN_HALF, Math.max(MIN_HALF, this.ratio * room))) : 0;
    const half = (id, el) => el.id(id).min_h(0).overflow_y_scrollbar().mode("scrolling");
    const spacesHalf = half("tl-side-spaces", small ? groups : v_flex().gap(10).children(groups));
    const agentsHalf = half(
      "tl-side-agents",
      small
        ? ags
        : v_flex()
            .gap(4)
            .px(6)
            .when(ags.length === 0, (el) => el.child(div().px(8).text_size(11).text_color(C.muted).child("NO AGENTS IN ORBIT")))
            .children(ags.map(agentRow)),
    );
    const dragging = Boolean(this.drag);
    const handle = h_flex()
      .id("tl-side-handle")
      .flex_none()
      .h(handleH)
      .px(small ? 0 : 14)
      .gap(8)
      .when(small, (el) => el.justify_center())
      .items_center()
      .cursor_ns_resize()
      .text_size(11)
      .text_color(dragging ? C.ink : C.muted)
      .hover((s) => s.text_color(C.ink))
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.drag = { y: e.position.y, top: custom ? top : Math.round(room / 2) };
        cx.notify();
      })
      // Double-click: back to 50/50.
      .on_click((e, cx) => {
        if ((e.click_count ?? 1) < 2) return;
        this.setRatio(null);
        cx.notify();
      })
      .child(small ? "──" : "── AGENTS ──")
      .when(!small, (el) => el.child(div().flex_1().min_w(0).h(1).bg((dragging ? C.line : C.muted) + "38")));
    const stop = (cx) => {
      if (!this.drag) return;
      this.drag = null;
      this.setRatio(this.ratio);
      cx.notify();
    };
    return v_flex()
      .id("tl-split")
      .flex_1()
      .min_h(0)
      .on_size_change((size, cx) => {
        this.splitH = size.height;
        cx.notify();
      })
      .on_mouse_move((e, cx) => {
        if (!this.drag || room <= 0) return;
        const t = Math.min(room - MIN_HALF, Math.max(MIN_HALF, this.drag.top + e.position.y - this.drag.y));
        this.ratio = t / room;
        cx.notify();
      })
      .on_mouse_up("left", (_e, cx) => stop(cx))
      .on_hover((h, cx) => !h && stop(cx))
      // Before the first drag both halves share the room equally.
      .child(custom ? spacesHalf.flex_none().h(top) : spacesHalf.flex_1().flex_basis(0))
      .child(handle)
      .child(agentsHalf.flex_1().flex_basis(0));
  }

  // Remember the split (null: 50/50 again).
  setRatio(r) {
    this.ratio = r;
    try {
      if (r == null) localStorage.removeItem("split");
      else localStorage.setItem("split", String(r));
    } catch {}
  }
}
