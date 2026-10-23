# GoodFellas Barbershop — POS Visual Design System

**Brand**: GoodFellas Barbershop Pandanaran
**Motto**: "Good Cut, Good Manner, Good Fellas"

Identity: Modern Gentleman × Editorial Luxury × Operational Precision.

## Color System

### Palette at a glance

| Role | Variable | Hex | Usage |
|------|----------|-----|-------|
| Obsidian (sidebar) | `--color-ink-950` | #171715 | Dark sidebar, mobile nav, loading screens |
| Warm Ivory (workspace) | `--color-ivory-100` | #F5F1E8 | Main workspace background |
| Clean White (cards) | `--color-paper` | #FFFFFF | Card surfaces, modal content, inputs |
| Walnut (primary) | `--color-walnut-500` | #6B4935 | Primary CTA, active nav, prices, key accents |
| Muted Brass (secondary) | `--color-brass-500` | #B69A68 | Secondary highlights, hover states |
| Stone (borders) | `--color-stone-200` | #DCD6CB | Card borders, dividers, input borders |
| Sage (available/done) | `--color-sage-500` | #63725F | Completed, available, online |
| Amber (waiting) | `--color-amber-500` | #c0903e | Pending, syncing, attention |
| Muted Red (urgent) | `--color-red-400` | #B95048 | Destructive, errors, urgent alerts |

### Application Shell

- **Sidebar**: `bg-ink-950` (obsidian) — dark, minimal, houses all navigation
- **Workspace**: `bg-ivory-100` (warm ivory) — light, warm, easy on the eyes
- **Cards & Surfaces**: `bg-paper` (clean white) with `border-stone-200`
- **Header**: `bg-paper` with `border-stone-200`

### Grayscale (ink)

| Variable | Hex | Usage |
|----------|-----|-------|
| `ink-950` | #171715 | Sidebar bg, deepest |
| `ink-900` | #1d2123 | Sidebar elements |
| `ink-850` | #262b2e | (retired — use ink-900) |
| `ink-800` | #31373a | Sidebar hover, active bg |
| `ink-700` | #434a4e | Avatar placeholders |
| `ink-600` | #596165 | Muted text on light |
| `ink-500` | #6f797d | Secondary text on light |
| `ink-400` | #889296 | Muted labels, captions |
| `ink-300` | #a2adaf | Very dim text |
| `ink-200` | #bcc6c8 | Disabled, subtle |
| `ink-100` | #d6e0e2 | Text on dark sidebar |

## Typography

- **Headings**: Manrope / Plus Jakarta Sans — bold and confident
- **Body & data**: Inter — highly legible at small sizes
- **Prices**: large (`text-2xl`), `tabular-nums` for alignment
- **Accent serif**: optional, only for marketing moments — never transaction data

## Spacing & Density

- Cards: `p-4` minimum, `rounded-xl` (12px radius)
- Buttons: min 44×44px touch targets, `h-12` for primary, `h-14` for keypad
- Grid gaps: `gap-3` to `gap-6` for generous breathing room
- Transitions: 120–200ms, purposeful, no distractions during checkout

## Component Library

### Buttons
```css
.btn          /* base: 44px min-height, active:scale-95, 75ms transition */
.btn-primary  /* walnut-500 bg, hover:400, active:600 */
.btn-ghost    /* transparent, walnut text on hover */
.btn-outline  /* transparent, walnut border + text */
.btn-danger   /* red-400 bg, hover:red-500 */
```

### Cards
```css
.card    /* bg-paper, rounded-xl, border-stone-200, subtle shadow */
```

### Status indicators
```css
.status-dot  /* 7px circle, rounded-full */
.badge       /* small pill, inline-flex, font-semibold */
```

## Layout Principles

1. **Obsidian sidebar, warm ivory workspace** — clear visual hierarchy between navigation and work surface
2. **Live first, analytics second** — queue board and appointments take priority over revenue charts
3. **Large touch targets** — optimized for counter tablet and chairside handheld
4. **Fast and decisive** — minimal animation (120–200ms), purposeful transitions only
5. **No AI slop** — no emoji, no glassmorphism, no neon gradients, no casual/meme microcopy, no buzzword-compliant copy

## Screens

### Login
- Brand panel (left, dark obsidian): GoodFellas name, scissors icon (walnut), feature bullets
- Auth panel (right, warm ivory): staff selector cards (white), PIN entry with dot indicators

### Dashboard
- Light workspace (`bg-ivory-100`)
- White stat cards with stone borders — today's revenue, transactions, average ticket
- Queue column dots: amber (waiting), sage (in service)
- Recent transactions as white cards

### Sell (checkout station)
- Split layout: services/products on left (white cards), cart summary on right (white card)
- Total in large walnut type
- Payment buttons: large `h-16` cards, walnut fill for selected
- QRIS help text on warm ivory background

### Queue & Appointments
- Timeline/column board per barber
- Status dots: amber (arrived/queued), sage (in service), green (done)
- One-tap status changes
- Cards on warm ivory background

### Catalog
- Tab switch (services / products)
- Table with stone borders on warm ivory
- Low-stock badges in amber

### Customers
- Search bar, customer list as cards
- Customer detail with notes on warm ivory

### Branches
- Staff list with role badges
- Owner: walnut, Manager: brass, Barber: neutral

### Settings
- Sections as white cards with stone borders
- Status badges: sage (online), amber (offline/pending), red (error)
- Sync controls in header

## Anti-Patterns (never use)

- Emoji in UI text or icons
- Pastel colors (outside the defined palette)
- Glass-morphism blur effects
- Excessively rounded corners (>rounded-xl)
- Generic placeholder illustrations
- Casual/meme-style microcopy
- Bright non-walnut/amber/red accent colors
