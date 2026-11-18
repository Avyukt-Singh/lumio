# ASSET_REQUESTS.md — Lumio 2.0, chunk 1

Master prompt 6.3: build one `Mascot` component with `pose`, `expression` and `size`
props; if art for a needed pose or expression does not exist, use the nearest one and
log it here. **Never redraw the owl as an approximate SVG.**

## Supplied art (7 pieces, WebP, cut from the brand sheet)

`owl-icon`, `owl-happy`, `owl-excited`, `owl-curious`, `owl-thinking`,
`owl-cheering`, `owl-standing` — shipped in `public/mascot/` and used only through
`src/components/lumio/Mascot.tsx`. No other art exists in chunk 1.

## Missing art and the fallbacks used meanwhile

| Requested asset | Kind | Needed for (6.3 mapping) | Nearest-art fallback in use |
| --- | --- | --- | --- |
| sad expression | expression | Lost streak: "a gentle sad with an immediate path to recover" | `thinking` — never shaming, no guilt copy |
| cool expression | expression | Strict Mode blocking screen (chunk 4) | `icon` art |
| wink expression | expression | Milestone celebrations variety | `happy` |
| surprised expression | expression | Errors / unexpected-state moments | `curious` |
| flying pose | pose | Progress-path movement, celebration variety | `cheering` |
| reading pose | pose | Focus screen and focus blocks (chunk 4) | `standing` |
| teaching pose | pose | Chapter explanations, hint moments (chunk 2) | `standing` |
| backpack pose | pose | Onboarding "standing and waving", school-day moments | `standing` |
| morning wallpaper (bright floating-island castle) | background | Optional hero background, morning theme | Solid token background (`--background`); no wallpaper |
| evening wallpaper (warm sunset) | background | Optional hero background, evening theme | Solid token background; no wallpaper |
| night wallpaper (stars and moon) | background | Optional hero background, night theme | Solid token background; no wallpaper |

## Requirements for new art

- Source: the same brand sheet style; the owl keeps the purple body, oversized eyes,
  orange beak and feet, black hoodie with glowing 'L' and four-point sparkle.
- Delivery: cut out, then export WebP (and AVIF where supported) at 1x/2x/3x, matching
  the existing `owl-*.webp` naming so `Mascot.tsx` can adopt them without redesign.
- Idle motion (blink, bob) remains CSS-transform-based and stops under reduced motion
  and calm mode; art itself stays static.

Chunk-1 UI never shows a redrawn, distorted or AI-approximated owl (anti-slop 6.6).
