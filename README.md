# Termlink

A retro NASA-punk mission-control layout for [Herdr](https://herdr.dev): neon box borders,
a telemetry header, a machines → spaces sidebar with pixel-sprite agents (full, a minimal
64px rail, or hidden), square monospace pane headers and a footer of tab chips with live
agent counts. A Files / Changes panel on the right, squared to match the panes; clicking a file opens it
read-only in a tab of its own.

![Termlink](preview.png)

## Install

Copy into your Herdr home (`~/.config/herdr-app`):

- `layouts/termlink.json` → `layouts/`
- `themes/termlink.json` → `themes/`
- `mods/termlink/`, `mods/termlink-files/`, `mods/termlink-changes/` and `mods/termlink-viewer/` and `mods/termlink-dialog/` → `mods/`
- merge `keys.json` into yours (`ctrl-space 0` focus the sidebar, `ctrl-space b` hide/show,
  `ctrl-space shift-b` full ↔ rail, `ctrl-space o` the Files/Changes panel,
  `ctrl-space e` shows Files and gives it the keyboard, `ctrl-space g` switches it to Changes); ask before replacing keys you already use.

Then `herdr-app check` each of the five mod folders and
`herdr-app do layout.switch --name termlink`. `ctrl-shift-l` switches back.

Or ask an agent to add `herdr.dev/layouts/CarlosHPlata/herdr-termlink`.
`RECIPE.md` is the brief to build it from scratch.

## The Files panel from the keyboard

`ctrl-space e` shows the panel on Files and gives it the keyboard (so does `ctrl-space l` from the
rightmost pane). Its legend turns yellow, a yellow cursor marks the row, and the keys show at the
bottom:

| Key | Does |
|---|---|
| `j` `k` / `↓` `↑` | move |
| `l` / `→` | open a folder, then go into it |
| `h` / `←` | close a folder, or go up to its parent |
| `⏎` | a folder folds; a file opens (in Neovim or Helix, else a viewer tab) and takes the keyboard |
| `a` | new file in the folder under the cursor (end the name with `/` for a folder) |
| `c` / `p` | copy / paste: a copy goes beside it as `name copy.ext`, `name copy 2.ext`, … |
| `r` | delete, after a confirmation: `y` or click DELETE; `n`, `esc` or KEEP cancels |
| `esc` | back to the pane you came from |

Pasting works within one machine (copy and paste in spaces on the same machine).

## Open files in Neovim or Helix

> **Windows: not supported yet.** This works on Linux and WSL, and should on macOS. On native
> Windows, herdr-core can't see which editor is running in a terminal, so clicked files always
> open in the viewer tab there.

If you edit in a terminal, clicking a file in the Files panel can open it in the editor you already
have running, instead of in a viewer tab. The panel looks in the shown space for a terminal whose
folder holds the file (the focused pane first, then the shown tab, then other tabs) and tries:

1. **Neovim** (0.9 or newer), when it's installed on that machine and running there. Nothing to
   set up: the file opens through Neovim's own server (`nvim --server <its socket> --remote`).
2. **Helix**, when it's installed and wired up (below) and running there.
3. Otherwise the file opens read-only in its own tab.

Neovim wins when both are running in that folder.

### Helix setup

Helix has no remote control, so it needs one key binding. Add this to Helix's config (`~/.config/helix/config.toml`) on each machine where you run it (your computer,
WSL, an ssh machine):

```toml
[keys.normal]
F9 = ":open %sh{cat ~/.cache/herdr/hx-open}"
```

Needs Helix 25.01 or newer (`%sh{}`). On a click the panel writes the file's path to
`~/.cache/herdr/hx-open` on that machine, presses Esc and F9 in that Helix and switches to it. If
Helix is running but the binding is missing, a one-time notice says so.

## What runs

The `termlink` mod runs no programs except `hc machine ls` (to list your machines, only when they
change), reads no files outside its folder and makes no network requests.

`termlink-files` and `termlink-changes` are restyled clones of Herdr's shipped `files` and
`changes` mods (Herdr 0.1.16): their frame and header changed, and clicking a file in Files opens a tab
with `termlink-viewer` instead of previewing it inside the panel. `termlink-viewer` only reads
the file it was opened with. Like the originals, they read
the shown space's folder and run `git` in it (status, diff, and `git commit` when you press
Commit in Changes), on the space's machine. No network requests. `termlink-files` creates, copies (`cp -R` / `Copy-Item`) and deletes (`rm -rf` / `Remove-Item`)
files only when you press `a`, `p` or `r` (and confirm). On a file click, it also runs `sh`
on the space's machine to check whether Neovim / Helix are installed (and Helix's config), find a Neovim's socket and
run `nvim --server … --remote`, or write `~/.cache/herdr/hx-open`; and `hc get` / `hc keys` on the
space's terminals (see Open files in Neovim or Helix).

MIT licensed.