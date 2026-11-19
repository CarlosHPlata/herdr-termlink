// Open a clicked file in an editor that is already running in the shown space, instead of a
// viewer tab. Copied into mods/termlink-files by make-panel.ps1; the Files clone calls
// openInEditor() on a click and falls back to its viewer tab when it resolves false.
//
// Order (first that applies wins):
//   1. Neovim: installed on the machine, and a terminal runs nvim in a folder holding the file.
//      Opened through Neovim's own server socket: nvim --server <socket> --remote <file>.
//      Needs nothing in Neovim's config (every Neovim >= 0.9 listens on a socket).
//   2. Helix: installed, its config has our binding (see the termlink README), and a terminal
//      runs hx in a folder holding the file. Path written to ~/.cache/herdr/hx-open, then esc + F9.
//   3. Nothing: the caller opens its viewer tab.
// Unix only (Linux, macOS, WSL): on Windows herdr-core can't see a terminal's foreground program.
// Everything runs on a click only; per-machine answers are cached.
import { spaces, panes, focused, exec, hc, run, notify } from "herdr";

export const HELIX_KEY = "f9";
const HELIX_MARK = "herdr/hx-open"; // what the Helix binding line must mention
const OK_FOR = 10 * 60 * 1000, NO_FOR = 30 * 1000; // re-check a yes after 10 min, a no after 30 s

const cache = new Map(); // `${editor}:${machine}` -> { ok, at }
const hinted = new Set();

const machineOf = (address) => (address?.includes("/") ? address.split("/")[0] : "");
const norm = (p) => String(p ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
const inside = (file, dir) => { const f = norm(file), d = norm(dir); return !!d && (f === d || f.startsWith(d + "/")); };
const progName = (fg) => String(fg?.name ?? "").replace(/\.exe$/i, "").split(/[\\/]/).pop();

async function sh(script, args, on) {
  return exec("sh", ["-c", script, "herdr", ...args], { on: on || null, timeout: 5000 });
}

async function cached(key, check) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.ok ? OK_FOR : NO_FOR)) return hit.ok;
  let ok = false;
  try { ok = await check(); } catch { ok = false; } // no sh here (Windows)
  cache.set(key, { ok, at: Date.now() });
  return ok;
}

// "Installed" per machine. Helix also needs our binding in its config.
const hasNvim = (machine) => cached(`nvim:${machine}`, async () => (await sh("command -v nvim >/dev/null 2>&1", [], machine)).code === 0);
const hasHelix = (machine) => cached(`helix:${machine}`, async () => {
  const r = await sh('command -v hx >/dev/null 2>&1 || command -v helix >/dev/null 2>&1 || exit 3; cat "${XDG_CONFIG_HOME:-$HOME/.config}/helix/config.toml" 2>/dev/null', [], machine);
  return r.code === 0 && r.stdout.split("\n").some((l) => l.includes(HELIX_MARK) && !l.trim().startsWith("#"));
});
const helixInstalled = (machine) => cached(`hx-bin:${machine}`, async () => (await sh("command -v hx >/dev/null 2>&1 || command -v helix >/dev/null 2>&1", [], machine)).code === 0);

// Terminal panes of the shown space on `machine`, best first: focused pane, shown tab, other tabs.
function candidates(machine) {
  const space = spaces().find((s) => s.active);
  if (!space) return [];
  const tabs = space.tabs ?? [], order = new Map(tabs.map((t, i) => [t.id, t.active ? -1 : i]));
  const f = focused()?.pane;
  return panes()
    .filter((p) => p.terminal && order.has(p.tab) && machineOf(p.terminal) === machine)
    .sort((a, b) => (b.pane === f) - (a.pane === f) || order.get(a.tab) - order.get(b.tab));
}

// Each candidate with its foreground program, in order. One `hc get` per pane, only on a click.
async function running(machine) {
  const out = [];
  for (const p of candidates(machine)) {
    try {
      const fg = JSON.parse((await hc(["get", p.terminal, "--json"])).stdout || "{}").foreground;
      if (fg) out.push({ pane: p, name: progName(fg), cwd: fg.cwd, pid: fg.pid });
    } catch {}
  }
  return out;
}

// Neovim: find the socket of that nvim (the TUI's pid, or its --embed child's) and --remote.
const NVIM_OPEN = `
pid=$1; file=$2
for p in $pid $(pgrep -P "$pid" 2>/dev/null); do
  for d in "\${XDG_RUNTIME_DIR:-}" "\${TMPDIR:-/tmp}" /tmp; do
    [ -n "$d" ] && [ -d "$d" ] || continue
    s=$(find "$d" -maxdepth 3 -name "nvim.$p.*" -type s 2>/dev/null | head -n 1)
    if [ -n "$s" ]; then exec nvim --server "$s" --remote "$file"; fi
  done
done
exit 4`;

async function openNvim(hit, file, on) {
  const r = await sh(NVIM_OPEN, [String(hit.pid), norm(file)], on);
  return r.code === 0;
}

async function openHelix(hit, file, on) {
  const w = await sh('mkdir -p "$HOME/.cache/herdr" && printf %s "$1" > "$HOME/.cache/herdr/hx-open"', [norm(file)], on);
  if (w.code !== 0) return false;
  return (await hc(["keys", hit.pane.terminal, "esc", HELIX_KEY])).code === 0;
}

// file: absolute path on `on` (null = here). Resolves true when an editor took it.
export async function openInEditor(file, on) {
  const machine = on ?? "";
  const [nvim, helix] = await Promise.all([hasNvim(machine), hasHelix(machine)]);
  const hxBin = !helix && !hinted.has(machine) && (await helixInstalled(machine));
  if (!nvim && !helix && !hxBin) return false; // nothing to look for: no pane scan at all

  const procs = (await running(machine)).filter((x) => inside(file, x.cwd));
  const pick = (names) => procs.find((x) => names.includes(x.name));
  let done = false, hit;
  try {
    if (nvim && (hit = pick(["nvim"]))) done = await openNvim(hit, file, on);
    if (!done && helix && (hit = pick(["hx", "helix"]))) done = await openHelix(hit, file, on);
  } catch { done = false; }
  if (done) {
    run("tab.select", { id: hit.pane.tab });
    run("pane.focus", { pane: hit.pane.pane });
    return true;
  }
  // Helix is right there but not wired up: say so once.
  if (hxBin && pick(["hx", "helix"])) {
    hinted.add(machine);
    notify({ title: "Open files in Helix", level: "info",
      body: "Helix is running here, but its config has no termlink binding. See the termlink README: add F9 = \":open %sh{cat ~/.cache/herdr/hx-open}\" under [keys.normal]." });
  }
  return false;
}
