// Termlink's small dialogs, opened as overlays by termlink-files:
//   props { id, mode: "prompt" | "confirm", title, detail?, value?, yes?, no?, overlay }
// prompt:  a text field; Enter answers with its text, Esc cancels.
// confirm: y (or the yes button) answers yes; n, Esc (or the no button) answers no.
// The answer goes to shared "termlink.dialog.result" = { id, ok, value }, which the opener reads.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, setShared } from "herdr";

const C = { bg: "#1e1e2e", s100: "#26263a", frame: "#45475a", ink: "#cdd6f4", muted: "#5bb0b0", yellow: "#fbd207", danger: "#ff5a5c" };
const MONO = "JetBrains Mono";

export default class Dialog extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.answered = false;
    this.handle = cx.focus_handle();
    if (p.mode === "prompt") {
      this.input = InputState.new({ value: p.value ?? "" });
      this.input.on("submit", () => this.answer(true, this.input.value()));
      this.input.focus();
      cx.timer.after(300, () => this.input.focus());
    } else {
      this.handle.focus();
      cx.timer.after(300, () => this.handle.focus());
    }
  }

  answer(ok, value) {
    if (this.answered) return;
    this.answered = true;
    const p = props() ?? {};
    setShared("termlink.dialog.result", { id: p.id, ok, value: value ?? null, at: Date.now() });
    closeOverlay(p.overlay);
  }

  // Esc closes the dialog on its own too; answer "no" then.
  async close() { this.answer(false); }

  key(e, cx) {
    const k = e.key, confirm = props()?.mode !== "prompt";
    if (k === "escape") this.answer(false);
    else if (confirm && k === "y") this.answer(true);
    else if (confirm && k === "n") this.answer(false);
    else return;
    cx.stop_propagation();
  }

  button(id, keyLabel, label, color, onClick) {
    return h_flex().id(id).h(26).px(10).gap(6).items_center().border_1().border_color(color + "99").cursor_pointer()
      .hover((s) => s.bg(C.s100)).on_click(onClick)
      .child(div().font_weight(700).text_color(C.yellow).child(keyLabel))
      .child(div().text_color(color).child(label));
  }

  render() {
    const p = props() ?? {}, prompt = p.mode === "prompt";
    return v_flex().id("tl-dialog").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().min_h(0).p(16).gap(12).bg(C.bg).border_1().border_color(C.frame)
      .font_family(MONO).text_size(12).text_color(C.ink)
      .child(h_flex().gap(8).items_center()
        .child(div().font_weight(700).text_color(C.yellow).child(`┤ ${String(p.title ?? "").toUpperCase()} ├`))
        .child(div().flex_1().h(1).bg(C.frame)))
      .when(Boolean(p.detail), (el) => el.child(div().text_color(C.muted).child(p.detail)))
      .when(prompt, (el) => el.child(
        h_flex().h(30).px(8).items_center().border_1().border_color(C.muted + "99").bg(C.s100)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .child(div().flex_none().pr(6).text_color(C.muted).child("❯"))
          .child(Input.new(this.input).flex_1().h_full().text_size(12).text_color(C.ink))))
      .child(h_flex().justify_end().gap(8).text_size(11)
        .when(prompt, (el) => el
          .child(div().flex_1().text_color(C.muted).child("⏎ create · esc cancel"))
          .child(this.button("tl-d-no", "esc", "CANCEL", C.muted, () => this.answer(false)))
          .child(this.button("tl-d-yes", "⏎", p.yes ?? "CREATE", C.ink, () => this.answer(true, this.input.value()))))
        .when(!prompt, (el) => el
          .child(this.button("tl-d-no", "N", p.no ?? "NO", C.muted, () => this.answer(false)))
          .child(this.button("tl-d-yes", "Y", p.yes ?? "YES", C.danger, () => this.answer(true)))));
  }
}
