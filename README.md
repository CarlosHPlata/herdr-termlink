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

## Open files in Helix

> **Windows: not supported yet.** This works on Linux and WSL, and should on macOS. On native
> Windows, herdr-core can't see that Helix is running in a terminal, so clicked files always open
> in the viewer tab there.

If you edit in [Helix](https://helix-editor.com), clicking a file in the Files panel can open it in
the Helix you already have running, like `:open file`, instead of in a viewer tab. Add this to
Helix's config (`~/.config/helix/config.toml`) on each machine where you run it (your computer,
WSL, an ssh machine):

```toml
[keys.normal]
F9 = ":open %sh{cat ~/.cache/herdr/hx-open}"
```

Needs Helix 25.01 or newer (`%sh{}`). Then, when you click a file, the panel looks in the shown
space for a terminal running Helix whose folder holds the file (the focused pane first, then the
shown tab, then other tabs), writes the file's path to `~/.cache/herdr/hx-open` on that machine,
presses Esc and F9 in it and switches to it. Without the binding, without a Helix in that folder,
or on native Windows (for now), the file opens read-only in its own tab as before. If Helix is
running but the binding is missing, a one-time notice says so.

## What runs

The `termlink` mod runs no programs except `hc machine ls` (to list your machines, only when they
change), reads no files outside its folder and makes no network requests.

`termlink-files` and `termlink-changes` are restyled clones of Herdr's shipped `files` and
`changes` mods (Herdr 0.1.16): their frame and header changed, and clicking a file in Files opens a tab
with `termlink-viewer` instead of previewing it inside the panel. `termlink-viewer` only reads
the file it was opened with. Like the originals, they read
the shown space's folder and run `git` in it (status, diff, and `git commit` when you press
Commit in Changes), on the space's machine. No network requests. On a file click, `termlink-files` also runs `sh`
on the space's machine to check Helix's config and write `~/.cache/herdr/hx-open`, and
`hc get` / `hc keys` on the space's terminals (see Open files in Helix).

MIT licensed.