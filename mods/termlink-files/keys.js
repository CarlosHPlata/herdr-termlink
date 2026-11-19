// Keyboard for termlink's Files panel. Copied into mods/termlink-files by make-panel.ps1;
// the Files clone calls attachKeys() in init, onKey() from its root, and draws legend(),
// cursorRow() and hints().
//
//   j k / ↓ ↑   move          l / →   open folder, then go in    h / ←   close folder, or go up
//   ⏎           open: a folder folds, a file opens in Neovim / Helix / a viewer tab (and takes the keyboard)
//   a           new file in the folder under the cursor (end the name with / for a folder)
//   c / p       copy / paste (a copy beside it: "name copy.ext")
//   r           delete, after a y / n confirmation
//   esc         back to the pane you came from
// The panel takes the keyboard with pane.go (it's "focusable") or ctrl-space e (termlink.files).
import { div } from "gpui-kit";
import { h_flex, ScrollHandle } from "gpui-base";
import { nextCommand, focused, panes, props, run, openOverlay, closeOverlay, shared, setShared, exec, window, notify } from "herdr";

// "pinned" (default): the panel stays until ctrl-space o. "auto-hide": it shows with the keyboard
// and hides when it loses it. "auto-hide-drawer": the same, but as a drawer over the terminals
// (the column copy then rests hidden, like auto-hide). Set on the Files block in
// layouts/termlink.json: props { mode }.
export const panelMode = () => (["auto-hide", "auto-hide-drawer"].includes(props()?.mode) ? "auto-hide" : "pinned");
// The auto-hide drawer: a copy termlink's header opens as a frameless window over the terminals
// (props { mode: "drawer" }). It slides in, takes the keyboard, and slides out when it loses it.
export const isDrawer = () => props()?.mode === "drawer";
const DRAWER_KEY = "termlink.drawer", SLIDE = { duration: 180, easing: "ease-out" };

const C = { s100: "#26263a", frame: "#45475a", ink: "#cdd6f4", muted: "#5bb0b0", yellow: "#fbd207" };
export const FOCUS_KEY = "termlink.files.focus"; // set by termlink's header on ctrl-space e
const RESULT_KEY = "termlink.dialog.result";

const parentOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const nameOf = (p) => p.split("/").pop();
const isWin = (v) => !v.on && window()?.platform === "windows";
const q = (s) => `'${String(s).replace(/['‘’]/g, "''")}'`; // a PowerShell single-quoted string

export function attachKeys(v, cx) {
  v.handle = cx.focus_handle();
  v.treeScroll = ScrollHandle.new();
  v.sel = null; v.back = null; v.clip = null; v.tlDialog = null;
  const f = shared(FOCUS_KEY);
  v.seenFocus = f;
  // There is no blur event: redraw when the panel gains or loses the keyboard (by esc, a click,
  // pane.go), so the yellow legend and cursor never linger. A boolean check, no processes.
  v.hadFocus = false;
  // Auto-hide rests hidden. This copy restarts when the mode changes (new props) and when Herdr
  // starts, so a panel left open then hides, unless ctrl-space e just gave it the keyboard.
  v.slid = false; v.closing = false; v.everFocused = false;
  // A layout switch closes windows too: whichever way the drawer goes, it's no longer up.
  // Only the latest drawer counts: the header stamps each open (shared termlink.drawer { at }).
  // One that starts long after its stamp is a reload or a leftover, and goes at once.
  if (isDrawer()) {
    v.drawerAt = shared(DRAWER_KEY)?.at ?? 0;
    v.close = async () => { if (shared(DRAWER_KEY)?.at === v.drawerAt) setShared(DRAWER_KEY, null); };
    if (Date.now() - v.drawerAt > 2000) cx.timer.after(1, (cx) => hideDrawer(v, cx));
    else cx.timer.after(16, (cx) => { v.slid = true; take(v); cx.notify(); }); // slide in: left 340 → 0
  }
  if (panelMode() === "auto-hide") cx.timer.after(800, () => { if (!v.handle.is_focused() && !v.tlDialog) run("layout.hide", { id: "panel" }); });
  cx.timer.every(250, (cx) => {
    const now = v.handle.is_focused();
    if (now) v.everFocused = true;
    // The drawer goes once the keyboard is elsewhere (checked every tick, not only on a change,
    // so coming back to the window with a terminal focused still closes it).
    if (isDrawer() && v.everFocused && !now && !v.tlDialog && window()?.active !== false) hideDrawer(v, cx);
    if (now === v.hadFocus) return;
    v.hadFocus = now;
    // Auto-hide: the panel goes when it loses the keyboard (esc, enter on a file, a click
    // elsewhere), but not for its own dialogs (a, r) or when the whole window loses focus.
    if (!now && panelMode() === "auto-hide" && !v.tlDialog && window()?.active !== false) run("layout.hide", { id: "panel" });
    cx.notify();
  });
  if (typeof f === "number" && Date.now() - f < 3000) cx.timer.after(1, (cx) => { take(v); cx.notify(); }); // just shown by ctrl-space e
  cx.spawn(async (cx) => {
    for (;;) {
      const c = await nextCommand();
      if (c === "focus") { take(v); cx.notify(); }
    }
  });
}

// Slide out, then close the window once the slide is done.
function hideDrawer(v, cx) {
  if (v.closing) return;
  v.closing = true; v.slid = false;
  cx.notify();
  cx.timer.after(SLIDE.duration + 20, () => {
    if (shared(DRAWER_KEY)?.at === v.drawerAt) setShared(DRAWER_KEY, null);
    closeOverlay(props().overlay);
  });
}

// The drawer's frame around the Files view: clipped, solid (the layout's background is clear),
// pressing on it doesn't drag the window, and the view slides on `left` natively.
export function drawer(v, el) {
  if (!isDrawer()) return el;
  return div().id("tl-drawer").size_full().overflow_hidden()
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
    .child(div().id("tl-drawer-slide").relative().size_full().bg("#1e1e2e")
      .left(v.slid ? 0 : 340).opacity(v.slid ? 1 : 0)
      .transition("left", SLIDE).transition("opacity", SLIDE)
      .child(el));
}

function take(v) {
  const f = focused()?.pane;
  if (f) v.back = f;
  if (!v.sel || !visible(v).some((r) => r.path === v.sel)) v.sel = visible(v)[0]?.path ?? null;
  v.handle.focus();
}

// The rows as drawn: [{ path, dir, open }], in order.
function visible(v, prefix = "", out = []) {
  for (const e of v.entries.get(prefix) ?? []) {
    const path = prefix ? `${prefix}/${e.name}` : e.name, open = v.folders.has(path);
    out.push({ path, dir: e.dir, open });
    if (e.dir && open) visible(v, path, out);
  }
  return out;
}

function move(v, rows, i) {
  if (!rows.length) return;
  const j = Math.max(0, Math.min(rows.length - 1, i));
  v.sel = rows[j].path;
  v.treeScroll.scroll_to_item(j);
}

const targetDir = (v, rows) => { const r = rows.find((x) => x.path === v.sel); return !r ? "" : r.dir ? r.path : parentOf(r.path); };
const abs = (v, rel) => (rel ? `${v.root}/${rel}` : v.root);

export function onKey(v, e, cx) {
  const m = e.modifiers ?? {};
  if (m.control || m.alt || m.platform || v.file) return;
  const rows = visible(v), i = rows.findIndex((r) => r.path === v.sel), row = rows[i];
  const k = e.key;
  if (k === "down" || k === "j") move(v, rows, i < 0 ? 0 : i + 1);
  else if (k === "up" || k === "k") move(v, rows, i < 0 ? 0 : i - 1);
  else if (k === "right" || k === "l") {
    if (row?.dir && !row.open) v.toggle(row.path, cx);
    else if (row?.dir && rows[i + 1] && parentOf(rows[i + 1].path) === row.path) move(v, rows, i + 1);
  } else if (k === "left" || k === "h") {
    if (row?.dir && row.open) v.toggle(row.path, cx);
    else if (row && parentOf(row.path)) move(v, rows, rows.findIndex((r) => r.path === parentOf(row.path)));
  } else if (k === "enter") {
    if (!row) return;
    if (row.dir) v.toggle(row.path, cx);
    else v.open(row.path, cx);
  } else if (k === "a") newFile(v, rows);
  else if (k === "c") {
    if (!row) return;
    v.clip = { on: v.on ?? null, path: abs(v, row.path), name: nameOf(row.path) };
  } else if (k === "p") paste(v, rows, cx);
  else if (k === "r") remove(v, row);
  else if (k === "escape") {
    // Back to the pane you came from. While the panel has the keyboard Herdr still reports that
    // pane as focused, and pane.focus on it hands the keyboard back.
    if (v.back && panes().some((p) => p.pane === v.back)) run("pane.focus", { pane: v.back });
    else run("pane.go", { direction: "left" });
    if (isDrawer()) hideDrawer(v, cx);
  } else return;
  cx.stop_propagation();
  cx.notify();
}

function ask(v, spec, then) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  v.tlDialog = { id, then };
  openOverlay({ mod: "termlink-dialog", kind: "dialog", frame: "none", width: 440, height: spec.mode === "prompt" ? 150 : 130, props: { id, ...spec } });
}

function newFile(v, rows) {
  const dir = targetDir(v, rows);
  ask(v, { mode: "prompt", title: "New file", detail: `in ${dir ? dir + "/" : "./"}  (end with / for a folder)` }, async (ok, name, cx) => {
    name = String(name ?? "").trim().replace(/\\/g, "/");
    if (!ok || !name || name.split("/").some((s) => s === "..")) return;
    const folder = name.endsWith("/"), rel = (dir ? `${dir}/` : "") + name.replace(/\/+$/, "");
    const r = await ops.create(v, rel, folder);
    if (r.code !== 0) return notify({ title: "Couldn't create it", body: `${rel}: ${(r.stderr || "").trim() || "error"}`, level: "error" });
    reload(v, [parentOf(rel), ...(rel.includes("/") ? ancestors(rel) : [])], rel, cx);
  });
}

async function paste(v, rows, cx) {
  const clip = v.clip;
  if (!clip) return notify({ title: "Nothing copied", body: "Press c on a file first.", level: "info" });
  if ((clip.on ?? null) !== (v.on ?? null)) return notify({ title: "Can't paste here", body: "That was copied on another machine.", level: "error" });
  const dir = targetDir(v, rows);
  const r = await ops.paste(v, clip.path, dir);
  if (r.code !== 0) return notify({ title: "Couldn't paste", body: (r.stderr || "").trim() || "error", level: "error" });
  const rel = (dir ? `${dir}/` : "") + r.stdout.trim();
  reload(v, [dir], rel, cx);
}

function remove(v, row) {
  if (!row) return;
  ask(v, { mode: "confirm", title: row.dir ? "Delete folder" : "Delete file", detail: `${row.path}${row.dir ? "/ and everything in it" : ""}`, yes: "DELETE", no: "KEEP" }, async (ok, _value, cx) => {
    if (!ok) return;
    const r = await ops.remove(v, row.path);
    if (r.code !== 0) return notify({ title: "Couldn't delete it", body: (r.stderr || "").trim() || "error", level: "error" });
    // Put the cursor on the next row (or the one before) before the tree reloads.
    const rows = visible(v), i = rows.findIndex((x) => x.path === row.path);
    const next = rows.slice(i + 1).find((x) => !x.path.startsWith(row.path + "/")) ?? rows[i - 1];
    for (const f of [...v.folders]) if (f === row.path || f.startsWith(row.path + "/")) { v.folders.delete(f); v.entries.delete(f); }
    reload(v, [parentOf(row.path)], next?.path ?? null, cx);
  });
}

// The file operations, on the panel's machine. rel paths are under v.root. Each resolves an
// exec result ({ code, stdout, stderr }); paste's stdout is the new file's name.
export const ops = {
  create(v, rel, folder) {
    return isWin(v)
      ? exec("powershell", ["-NoProfile", "-Command", `& { param($p, $folder) if ($folder -eq '1') { New-Item -ItemType Directory -Force -Path $p | Out-Null; exit 0 }; if (Test-Path -LiteralPath $p) { [Console]::Error.Write('already exists'); exit 17 }; New-Item -ItemType Directory -Force -Path (Split-Path -Parent $p) | Out-Null; New-Item -ItemType File -Path $p | Out-Null } ${q(abs(v, rel))} ${folder ? "'1'" : "'0'"}`])
      : exec("sh", ["-c", 'p=$1; if [ "$2" = 1 ]; then exec mkdir -p -- "$p"; fi; [ -e "$p" ] && { echo "already exists" >&2; exit 17; }; mkdir -p -- "$(dirname -- "$p")" && : > "$p"', "herdr", abs(v, rel), folder ? "1" : "0"], { on: v.on ?? null });
  },
  paste(v, src, dir) {
    return isWin(v)
      ? exec("powershell", ["-NoProfile", "-Command", `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($s, $d) $b = Split-Path $s -Leaf; $dest = Join-Path $d $b; if (Test-Path -LiteralPath $dest) { $n = [IO.Path]::GetFileNameWithoutExtension($b); $e = [IO.Path]::GetExtension($b); if (-not $n) { $n = $b; $e = '' }; $i = 1; $dest = Join-Path $d "$n copy$e"; while (Test-Path -LiteralPath $dest) { $i++; $dest = Join-Path $d "$n copy $i$e" } }; Copy-Item -LiteralPath $s -Destination $dest -Recurse -ErrorAction Stop; [Console]::Out.Write((Split-Path $dest -Leaf)) } ${q(src)} ${q(abs(v, dir))}`])
      : exec("sh", ["-c", 'src=$1; dir=$2; base=$(basename -- "$src"); dest="$dir/$base"; if [ -e "$dest" ]; then case "$base" in ?*.*) name=${base%.*}; ext=".${base##*.}";; *) name=$base; ext="";; esac; dest="$dir/$name copy$ext"; i=1; while [ -e "$dest" ]; do i=$((i+1)); dest="$dir/$name copy $i$ext"; done; fi; cp -R -- "$src" "$dest" && basename -- "$dest"', "herdr", src, abs(v, dir)], { on: v.on ?? null });
  },
  remove(v, rel) {
    const path = abs(v, rel);
    if (!rel || path === v.root || rel.split("/").some((s) => s === ".." || s === "")) return Promise.resolve({ code: 1, stdout: "", stderr: "refusing to delete that" });
    return isWin(v)
      ? exec("powershell", ["-NoProfile", "-Command", `& { param($p) Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop } ${q(path)}`])
      : exec("sh", ["-c", 'rm -rf -- "$1"', "herdr", path], { on: v.on ?? null });
  },
};

const ancestors = (rel) => { const out = []; let p = parentOf(rel); while (p) { out.push(p); p = parentOf(p); } return out; };

function reload(v, dirs, sel, cx) {
  for (const d of dirs) if (d) v.folders.add(d);
  if (sel !== undefined) v.sel = sel;
  v.loading = false; // a reload in flight would skip ours
  v.refresh(cx);
  v.handle.focus();
}

// Called from render: dialog answers and ctrl-space e. Focus can't move during render (and a task
// spawned here starts inside it), so both go through a timer, which runs after render.
function poll(v, cx) {
  if (isDrawer() && !v.closing && shared(DRAWER_KEY)?.at !== v.drawerAt && shared(DRAWER_KEY)) cx.timer.after(1, (cx) => hideDrawer(v, cx)); // a newer drawer opened
  const f = shared(FOCUS_KEY);
  if (f !== v.seenFocus) { v.seenFocus = f; cx.timer.after(1, (cx) => { take(v); cx.notify(); }); }
  const r = shared(RESULT_KEY);
  if (v.tlDialog && r && r.id === v.tlDialog.id) {
    const job = v.tlDialog; v.tlDialog = null;
    cx.timer.after(1, (cx) => {
      v.handle.focus();
      cx.spawn(async (cx) => { try { await job.then(r.ok, r.value, cx); } finally { cx.notify(); } });
    });
  }
}

export function legend(v) {
  const focus = v.handle?.is_focused();
  return div().flex_none().text_color(focus ? C.yellow : C.muted).when(focus, (el) => el.font_weight(700)).child("┤ FILES ├");
}

export const isCursor = (v, path) => v.sel === path && v.handle?.is_focused();
export const cursorRow = (el) => el.bg(C.s100).text_color(C.yellow);

export function hints(v, cx) {
  poll(v, cx);
  const focus = v.handle?.is_focused();
  const hint = (k, label) => h_flex().gap(4).child(div().font_weight(600).text_color(C.yellow).child(k)).child(div().child(label));
  return h_flex().id("files-keys").flex_none().flex_wrap().gap_x(12).gap_y(2).px(10).py(6)
    .border_t(1).border_dashed().border_color(C.frame).text_size(11).text_color(C.muted)
    .when(!focus, (el) => el.child(h_flex().id("files-take").cursor_pointer().on_click((_e, cx) => { take(v); cx.notify(); }).child(hint("^␣e", "focus"))))
    .when(focus, (el) => el
      .child(hint("⏎", "open")).child(hint("a", "new")).child(hint("c", "copy")).child(hint("p", "paste"))
      .child(hint("r", "delete")).child(hint("esc", "back"))
      .when(Boolean(v.clip), (el) => el.child(div().truncate().text_color(C.ink).child(`⧉ ${v.clip.name}`))));
}
