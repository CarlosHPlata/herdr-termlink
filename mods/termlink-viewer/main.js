// A read-only file viewer for a tab of its own: props { file, on, root? }.
// The Files panel opens one per file it is asked to show (tab.new with this mod).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { props, readTextFile, theme, settings, home, checking } from "herdr";

const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const MAX = 400000;

function short(path) {
  const h = home().replace(/\\/g, "/"), p = String(path ?? "").replace(/\\/g, "/");
  return p.toLowerCase().startsWith(h.toLowerCase() + "/") ? "~" + p.slice(h.length) : p;
}

export default class Viewer extends View {
  init(_props, cx) {
    this.code = null; this.error = null; this.lines = 0; this.truncated = false;
    // Take the keyboard when opened, so Enter in the Files panel lands here.
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.load(cx);
  }

  load(cx) {
    const { file, on } = props() ?? {};
    if (!file) { this.error = "No file given"; return; }
    if (checking()) return;
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(file, { on: on ?? null });
        if (text === null) this.error = "This file is no longer available";
        else if (text.includes("\0")) this.error = "Binary file · no text preview";
        else {
          const t = theme(), name = file.split(/[\\/]/).pop(), ext = name.includes(".") ? name.split(".").pop() : "txt";
          this.truncated = text.length > MAX;
          this.lines = text.split("\n").length;
          this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true,
            value: this.truncated ? text.slice(0, MAX) + "\n… (file truncated)" : text,
            font_family: settings().font_family, font_size: 13,
            syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
        }
      } catch { this.error = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  async close() { this.code?.release(); this.code = null; }

  render() {
    const t = theme(), { file, on } = props() ?? {};
    return v_flex().id("viewer").track_focus(this.handle).size_full().min_h(0).bg(t.background).text_color(t.foreground).font_family("JetBrains Mono")
      .child(this.code
        ? Editor.new(this.code).flex_1().min_h(0)
        : div().flex_1().p(14).text_size(12).text_color("#5bb0b0").child(this.error || "Loading file…"))
      .child(h_flex().id("viewer-status").h(22).flex_none().px(10).gap(10).items_center().text_size(11).text_color("#5bb0b0")
        .border_t(1).border_dashed().border_color("#2a2b3d")
        .child(div().flex_none().px(6).bg("#313244").text_color("#cdd6f4").child("VIEW"))
        .child(div().flex_1().min_w(0).truncate().child((on ? `${on}:` : "") + short(file)))
        .when(this.lines > 0, (el) => el.child(div().flex_none().child(`${this.lines} lines${this.truncated ? " · truncated" : ""}`)))
        .child(div().flex_none().child("READ-ONLY")));
  }
}
