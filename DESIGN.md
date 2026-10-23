# GoodFellas Barbershop — POS Visual Design System

**Brand**: GoodFellas Barbershop Pandanaran
**Motto**: "Good Cut, Good Manner, Good Fellas"

## Color System

| Role | Variable | Hex | Usage |
|------|----------|-----|-------|
| Primary accent | `--color-barber-red-*` | #ef4444 (500) | Buttons, active states, key CTAs |
| Secondary | `--color-bronze-*` | #e8d5a5 (300) | Hover states, subtle highlights |
| Status — available | `--color-jade-*` | #22c58e | Active/online, completed |
| Status — in-progress | `--color-amber-*` | #f59e0b (500) | Waiting, syncing, pending |
| Status — alert | `--color-rust-*` | #dc2626 | Errors, stock-out |
| Background — dark | `--color-ink-*` | #0a0a0b (950) | Page backgrounds |
| Text — primary | `--color-ink-100` | #f8fafc | Headings, body |
| Text — muted | `--color-ink-400/500` | — | Captions, hints |

## Typography

- **Font**: Inter var (system sans-serif)
- **Headings**: bold, high-contrast against dark
- **Body**: clean, readable at 14–16px
- **Prices**: large (text-lg or text-2xl), tabular-nums for alignment
- **Never**: emoji, clip-path overlays, glass-morphism blur, or pastel accents

## Spacing & Density

- Cards: `p-4` minimum, `rounded-xl`
- Buttons: min 40px height, `0.5625rem 1.125rem` padding
- Grid gaps: `gap-3` to `gap-6` for generous breathing room
- Touch targets: 44px+ for all interactive elements

## Component Library

### Buttons
```css
.btn          /* base: 40px min-height, active:scale-95, 75ms transition */
.btn-primary  /* barber-red-500 bg, hover:600, active:700 */
.btn-ghost    /* transparent, barber-red text on hover */
.btn-outline  /* transparent, barber-red border + text */
.btn-danger   /* rust bg, hover:rust-600 */
```

### Cards
```css
.card    /* bg-ink-850, rounded-xl, border-ink-700, subtle shadow */
```

### Status Indicators
```css
.status-dot    /* 12px circle, rounded-full */
.badge         /* small pill, inline-flex */
```

## Layout Principles

1. **Dark field, red data** — dark backgrounds with barber-red as the only saturation
2. **Large touch targets** — optimized for counter tablet and chairside handheld
3. **Fast and decisive** — minimal animation (75–120ms), purposeful transitions only
4. **Professional microcopy** — short, clear, respectful. No casual or meme-style text
5. **Craftsmanship echo** — card borders and button presses mirror the quality of the physical shop

## Screens

### Login
- Brand panel: dark with subtle radial gradient (barber-red), scissors icon
- Auth panel: dark, clean, focused on PIN entry

### Home / Queue
- Dark background, red accent headers
- Queue columns with status dots (jade=active, amber=waiting, gray=scheduled)

### Service Selection
- Large cards, price + duration always visible
- Red selection state

### Checkout
- Total in large type (barber-red)
- Payment buttons: large h-16 cards with icon + label
- Change display: prominent

### Settings
- Status badges: jade (ok), amber (in-progress), rust (error)

## Anti-Patterns (never use)

- Emoji in UI text or icons
- Pastel colors
- Glass-morphism blur effects
- Excessively rounded corners (>rounded-xl)
- Generic placeholder illustrations
- Casual/meme-style microcopy
- Bright non-red accent colors
