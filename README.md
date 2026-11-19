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
- `mods/termlink/`, `mods/termlink-files/`, `mods/termlink-changes/` and `mods/termlink-viewer/` → `mods/`
- merge `keys.json` into yours (`ctrl-space 0` focus the sidebar, `ctrl-space b` hide/show,
  `ctrl-space shift-b` full ↔ rail, `ctrl-space o` the Files/Changes panel,
  `ctrl-space e` / `ctrl-space g` switch it to Files / Changes); ask before replacing keys you already use.

Then `herdr-app check` each of the four mod folders and
`herdr-app do layout.switch --name termlink`. `ctrl-shift-l` switches back.

Or ask an agent to add `herdr.dev/layouts/CarlosHPlata/herdr-termlink`.
`RECIPE.md` is the brief to build it from scratch.

The `termlink` mod runs no programs except `hc machine ls` (to list your machines, only when they
change), reads no files outside its folder and makes no network requests.

`termlink-files` and `termlink-changes` are restyled clones of Herdr's shipped `files` and
`changes` mods (Herdr 0.1.16): their frame and header changed, and clicking a file in Files opens a tab
with `termlink-viewer` instead of previewing it inside the panel. `termlink-viewer` only reads
the file it was opened with. Like the originals, they read
the shown space's folder and run `git` in it (status, diff, and `git commit` when you press
Commit in Changes), on the space's machine. No network requests.

MIT licensed.