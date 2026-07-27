# Beeyond Limits - Design System (Neo-Brutalist "Carnival" Theme)

This document outlines the core design language, tokens, and components used in the Beeyond Limits Chrome Extension. The extension utilizes a strict **Neo-Brutalist** aesthetic, focusing on stark contrasts, heavy borders, vibrant solid colors, and oversized typography.

## 1. Color Palette

The color system relies on high-contrast combinations. We avoid gradients and soft drop-shadows in favor of flat colors and sharp ink borders.

| Token | CSS Variable | Hex Code | Usage |
|---|---|---|---|
| **Canvas** | `--color-canvas` | `#f2e9e1` | The global background color (pale peach). Provides warmth and contrast for the stark black borders. |
| **Ink** | `--color-ink` | `#0d0c0c` | Primary text, borders, and shadows (sharp black). Used everywhere for structure. |
| **Paper** | `--color-paper` | `#ffffff` | Pure white background for cards, inputs, and supplementary boxes. |
| **Mustard** | `--color-mustard` | `#eeba0b` | Accent 1. Used for the Pomodoro Timer module and primary active states. |
| **Crimson** | `--color-crimson` | `#9e1414` | Accent 2. Used for the Website Blocker module and destructive/pause actions. |
| **Sapphire**| `--color-sapphire` | `#1e3a8a` | Accent 3. Used for the Task List module and "Add/Submit" actions. |
| **Emerald** | `--color-emerald` | `#147a42` | Accent 4. Used for the Ambient Sounds module. |

## 2. Typography

The typographic hierarchy is intentionally exaggerated to create visual interest.

- **Display (`font-display`)**: `Anton`, `Impact`, `sans-serif`. 
  - Used for giant, uppercase page titles (e.g., `text-6xl`, `text-7xl`) and massive button texts.
  - Line height is kept tight (`leading-none`).
- **Body (`font-sans`)**: `Outfit`, `system-ui`, `sans-serif`.
  - Used for standard paragraph text, descriptions, and structural layout numbers.
- **Monospace (`font-mono`)**: `JetBrains Mono`, `monospace`.
  - Used for small uppercase utility labels, tags, timer stats, and secondary buttons. Always styled with `font-bold uppercase tracking-widest`.

## 3. Structural Elements (Utilities)

The UI is built using repetitive, recognizable geometric shapes.

### Borders & Shadows
- **`.brutal-border`**: A thick, `3px solid var(--color-ink)` line applied to almost every component (buttons, inputs, cards).
- **`.brutal-shadow`**: A hard, solid offset shadow (`4px 4px 0px 0px var(--color-ink)`).
- **`.brutal-shadow-sm`**: A smaller variant (`2px 2px 0px 0px var(--color-ink)`) used for inputs and checkboxes.

### Halftone Patterns
- **`.halftone-dark`**: A dotted ink pattern (radial gradient) on transparent background. Used as a decorative left-border block on light/mustard cards.
- **`.halftone-light`**: A dotted white pattern on a transparent background. Used on dark accent cards (Crimson, Sapphire, Emerald) to maintain contrast.

## 4. Interaction Design (Motion)

While the design is brutal, the interaction should feel extremely tactile and mechanical.

- **Hover States (`:hover`)**: Elements shift slightly upward (`-translate-y-[2px]`) or expand their shadow to invite interaction.
- **Active States (`:active`)**: When a button is clicked, it visually "presses down" into the page. The shadow collapses to `0px`, and the element translates down and right (`translate-y-[4px] translate-x-[4px]`) to mimic a physical mechanical keyboard switch.

## 5. Core Components

- **Feature Cards**: A horizontal box layout featuring a halftone pattern on the left, giant typography in the middle, and a small square icon box on the far right.
- **Range Sliders**: Re-styled inputs with sharp square thumbs, flat tracks bounded by ink borders, and a filled progress bar.
- **Block Screen**: A jarring, full-screen crimson background featuring an oversized white brutalist box shouting "BLOCKED." in the center.

> **Note**: To maintain the integrity of this design system, do not introduce generic rounded corners (`rounded-md`, `rounded-lg`), soft box-shadows, or complex gradients. Stick to the sharp, flat, and aggressive geometry established here.
