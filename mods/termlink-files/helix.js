// Open a file in a Helix that is already running in the current space, instead of a viewer tab.
// Copied into mods/termlink-files by make-panel.ps1; the Files clone calls openInHelix() on a click.
//
// Phase 0: the machine's Helix config must have our binding (see the termlink README):
//   [keys.normal]
//   F9 = ":open %sh{cat ~/.cache/herdr/hx-open}"
// Phase 1: find a terminal in this space whose foreground program is Helix and whose folder
// holds the file, write the path to ~/.cache/herdr/hx-open on its machine, press esc + F9.
// Everything runs only on a click; answers about a machine's config are cached.
import { spaces, panes, focused, exec, hc, run, notify } from "herdr";

export const HELIX_KEY = "f9";
const MARK = "herdr/hx-open"; // what the binding line must mention
const HELIX = new Set(["hx", "helix"]);
const OK_FOR = 10 * 60 * 1000, NO_FOR = 30 * 1000; // re-check a wired machine every 10 min, an unwired one after 30 s

const wired = new Map(); // machine ("" = here) -> { ok, at }
const hinted = new Set();

const machineOf = (address) => (address?.includes("/") ? address.split("/")[0] : "");
const norm = (p) => String(p ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
const inside = (file, dir) => { const f = norm(file), d = norm(dir); return !!d && (f === d || f.startsWith(d + "/")); };

// Phase 0: is Helix on this machine set up for us? Unix shells only (Linux, macOS, WSL).
async function isWired(machine) {
  const hit = wired.get(machine);
  if (hit && Date.now() - hit.at < (hit.ok ? OK_FOR : NO_FOR)) return hit.ok;
  let ok = false;
  try {
    const r = await exec("sh", ["-c", 'command -v hx >/dev/null 2>&1 || command -v helix >/dev/null 2>&1 || exit 3; cat "${XDG_CONFIG_HOME:-$HOME/.config}/helix/config.toml" 2>/dev/null'],
      { on: machine || null, timeout: 5000 });
    ok = r.code === 0 && r.stdout.split("\n").some((l) => l.includes(MARK) && !l.trim().startsWith("#"));
  } catch { ok = false; } // no sh here (Windows): phase 2
  wired.set(machine, { ok, at: Date.now() });
  return ok;
}

// Terminal panes of the shown space, best first: the focused pane, the shown tab, then other tabs.
function candidates() {
  const space = spaces().find((s) => s.active);
  if (!space) return [];
  const tabs = space.tabs ?? [], order = new Map(tabs.map((t, i) => [t.id, t.active ? -1 : i]));
  const f = focused()?.pane;
  return panes()
    .filter((p) => p.terminal && order.has(p.tab))
    .sort((a, b) => (b.pane === f) - (a.pane === f) || order.get(a.tab) - order.get(b.tab));
}

async function helixPane(file) {
  for (const p of candidates()) {
    try {
      const r = await hc(["get", p.terminal, "--json"]);
      const fg = JSON.parse(r.stdout || "{}").foreground;
      const name = String(fg?.name ?? "").replace(/\.exe$/i, "").split(/[\\/]/).pop();
      if (HELIX.has(name) && inside(file, fg.cwd)) return p;
    } catch {}
  }
  return null;
}

// file: absolute path on `on` (null = here). Resolves true when Helix took it.
export async function openInHelix(file, on) {
  const machine = on ?? "";
  if (!(await isWired(machine))) {
    // Tell the person once when a Helix is right there but isn't wired up.
    if (!hinted.has(machine) && (await helixPane(file))) {
      hinted.add(machine);
      notify({ title: "Open files in Helix", level: "info",
        body: "Helix is running here, but its config has no termlink binding. See the termlink README: add F9 = \":open %sh{cat ~/.cache/herdr/hx-open}\" under [keys.normal]." });
    }
    return false;
  }
  const p = await helixPane(file);
  if (!p || machineOf(p.terminal) !== machine) return false;
  try {
    const w = await exec("sh", ["-c", 'mkdir -p "$HOME/.cache/herdr" && printf %s "$1" > "$HOME/.cache/herdr/hx-open"', "herdr", norm(file)],
      { on: on ?? null, timeout: 5000 });
    if (w.code !== 0) return false;
    const k = await hc(["keys", p.terminal, "esc", HELIX_KEY]);
    if (k.code !== 0) return false;
  } catch { return false; }
  run("tab.select", { id: p.tab });
  run("pane.focus", { pane: p.pane });
  return true;
}
