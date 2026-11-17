# Design System

## Visual world
Elegant Burgundy: a contemporary, sophisticated identity built around the institutional burgundy, with calm light surfaces, restrained rose accents, and clear semantic feedback. The application is an operational workspace; scanability, legibility, and consistency take priority over decoration.

## Color tokens
The canonical values live in `frontend/src/index.css` as CSS variables and are exposed through `frontend/tailwind.config.js`.

| Role | Token | Value |
|---|---|---|
| Brand primary | `brand-primary` | `#5A0048` |
| Primary hover | `brand-hover` | `#87316F` |
| Primary active | `brand-active` | `#35102F` |
| Brand light | `brand-light` | `#F1E3ED` |
| Brand secondary | `brand-secondary` | `#754D6C` |
| Brand accent | `brand-accent` | `#D49BBE` |
| Background | `surface-background` | `#F8F3F5` |
| Surface | `surface` | `#FFFFFF` |
| Alternate surface | `surface-alt` | `#F3EBF0` |
| Accent surface | `surface-accent` | `#F1E3ED` |
| Primary text | `text-primary` | `#29212A` |
| Secondary text | `text-secondary` | `#665B66` |
| Muted text | `text-muted` | `#948794` |
| Inverse text | `text-inverse` | `#FFFFFF` |
| Border | `border` | `#E8DDE5` |
| Strong border | `border-strong` | `#D9CBD5` |
| Success | `success` / `success-background` | `#287A50` / `#EAF4EE` |
| Warning | `warning` / `warning-background` | `#8A4B08` / `#FBF2E4` |
| Error | `error` / `error-background` | `#C03950` / `#FBECEF` |
| Info | `info` / `info-background` | `#3976B9` / `#EAF1F9` |
| Focus | `focus` | `#87316F` |
| Overlay | `overlay` | `rgba(41, 33, 42, 0.45)` |

## Usage
- Use the semantic Tailwind utilities (`bg-brand-primary`, `text-secondary`, `border-border`, `bg-error-background`) instead of hardcoded component colors.
- Keep primary actions burgundy with white text, exact hover/active states, and a visible focus ring.
- Keep cards and form fields white; use the alternate surface for subtle grouping rather than large tinted areas.
- Use `brand-accent` sparingly for decorative details. Prefer text on light surfaces and white text on primary.
- Warning and info hues have limited small-text contrast on their backgrounds. Use primary/secondary text for their labels and reserve those hues for icons, borders, and supporting cues.
- `text-muted` is reserved for nonessential or sufficiently large text; use `text-secondary` for small supporting copy.
- Preserve explicit labels/icons alongside feedback colors; never communicate status by color alone.

## Typography and interaction
Use DM Sans for headings and emphasis, Inter for interface text, and JetBrains Mono for monetary/tabular values. The global type utilities are `type-display`, `type-h1` through `type-h4`, and `type-body-lg`, `type-body`, `type-body-sm`, and `type-caption`. Display and page headings scale down on narrow screens.

| Style | Size | Weight |
|---|---:|---:|
| Display | 48px | 700 |
| H1 | 36px | 700 |
| H2 | 30px | 700 |
| H3 | 24px | 600 |
| H4 | 20px | 600 |
| Body Large | 18px | 400 |
| Body | 16px | 400 |
| Body Small | 14px | 400 |
| Caption | 12px | 400 |

## Spacing, shape, and elevation
Use the CSS spacing tokens `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-12`, and `--space-16` (4, 8, 12, 16, 24, 32, 48, and 64px). Prefer these points for section gaps, card padding, form rhythm, and control spacing.

| Token | Value |
|---|---:|
| Radius Small | 6px |
| Radius Medium | 10px |
| Radius Large | 16px |
| Radius XL | 24px |
| Shadow Small | subtle burgundy tinted elevation |
| Shadow Medium | subtle burgundy tinted elevation |
| Shadow Large | subtle burgundy tinted elevation |

## Component patterns
Shared primitives in `frontend/src/components/ui` are the source of truth. Buttons use the primary semantic token and shared focus ring; inputs and selects use white surfaces, medium radius, and a 40px control height; cards use large radius and small elevation; dialogs, sheets, dropdowns, and popovers use shared surface, radius, and shadow tokens. Badges, alerts, tables, tabs, navigation, and pagination use semantic color utilities. Extend a shared primitive when a pattern changes instead of creating page-specific styles.

## Responsive layout
Use the existing Tailwind breakpoints and fluid heading utilities. Preserve compact controls and readable line lengths on phones, progressive grid columns on tablet and desktop, and consistent section/card/form gaps at every breakpoint. Avoid fixed content widths where a max-width container or `w-full` can adapt naturally.

## Theme
The product uses the light theme. Tailwind's existing class-based dark-mode compatibility is retained, but no separate dark palette or theme switch is defined.
