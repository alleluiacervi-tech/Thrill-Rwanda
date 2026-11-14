# Thrill Rwanda design system

Tokens live in `src/app/globals.css`; fonts load in `src/app/layout.tsx`.

## Colour

The palette comes from the logo, which uses Rwanda's flag colours.

| Role | Token | Hex | Use |
|---|---|---|---|
| Ground | `forest-800` / `900` / `950` | `#1c5c45` `#154a38` `#0f3a2c` | Dark sections, primary buttons, active tabs |
| Action | `sun-500` (hover `sun-300`) | `#f8c300` | The money button on each view, badges, italic accent lines on dark, map pins |
| Wayfinding | `lake-600` / `700` | `#086dbb` `#07599a` | Section labels on light ground, links, focus rings, numerals |
| Earth | `clay-*` | `#8b4513` … | The airport-transfers band (Rwanda's red soil); sparingly |
| Paper | `bone-*` | `#f7f3ec` … | Tinted section grounds, borders, muted text |

Contrast rules:

- Gold never appears as text on a light background, because it fails contrast. On light grounds it is a fill only (buttons, badges, the rule in a section label). Text on gold is always `forest-950` (7.7:1).
- `lake-600` and darker pass 4.5:1 on white.
- Focus rings use `--focus`, which is blue on light grounds and gold inside `.on-dark`.

## Type

- **Display:** Fraunces, `SOFT 30`, `opsz 60`, weight 400, tracking −0.02em. The roman is straight. `<em>` inside a heading switches to the soft, wonky italic, and that italic is the brand's voice: one accent phrase per heading, at most.
- **Body and UI:** Karla, 16/1.6.
- **Section label (`Eyebrow`):** a 24px gold rule followed by bold capitals tracked at 0.2em, echoing the "— RWANDA —" line in the logo.
- **Scale:** `text-display-lg` is the homepage hero only. `text-display` is for page banners and detail titles. `text-display-sm` is for section headings.

## Photography

Text over photos uses the neutral `.scrim-b` and `.scrim-t` overlays plus `.on-media`, never a green wash.

## Signature elements

These are what make the brand recognisably Rwandan. Keep them consistent.

- **Imigongo lattice** (`.imigongo`, `.imigongo-light`; the old `.contours` names point to the same pattern). Nested diamonds from the Imigongo relief art of Nyakarambi, used as a hairline texture at 3–9% opacity behind dark or tinted sections. Never put it over photographs.
- **Imigongo band** (`.imigongo-band`). A 12px strip of gold peaks on green, used as a seam between major bands. Today it appears only between the footer's welcome and its directory.
- **Flag ribbon** (`.flag-ribbon`). A 4px strip in sky blue, sun gold and green, in the flag's proportions. It sits at the top of every public and auth page and closes the footer.
- **Thousand-hills edge** (`<HillsEdge />` in `page-shell.tsx`). Layered ridgelines with a gold crest line close every page banner. Set `--edge` on the banner when the section below isn't white.
- **Murakaza neza.** The footer opens with the Kinyarwanda welcome. Mark any Kinyarwanda text with `lang="rw"`.
