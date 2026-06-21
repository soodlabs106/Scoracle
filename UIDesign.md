# ScOracle UI Design System

A unified, minimal, analytical design language inspired by the ScOracle **S–O icon**.

---

## 1. Brand Color Palette

### Primary Colors

| Name          |       Hex | Usage                                        |
| ------------- | --------: | -------------------------------------------- |
| Mint Green    | `#3CC8A5` | Primary brand color, key UI elements, charts |
| Coral Red     | `#F45B5B` | Primary accent, CTAs, highlights             |
| Sky Blue      | `#4DB7E8` | Secondary accent, data visuals, tabs         |
| Ivory White   | `#F9F9F9` | Main background, cards, whitespace           |
| Charcoal Gray | `#333333` | Primary text, icons, navigation              |

### Extended Colors

| Name           |       Hex | Usage                         |
| -------------- | --------: | ----------------------------- |
| Soft Mint      | `#6EEBC3` | Hover states, subtle emphasis |
| Mist Blue      | `#E8F4FA` | Light backgrounds, panels     |
| Cool Gray      | `#DADADA` | Borders, dividers             |
| Champagne Gold | `#EEDFA3` | Premium highlights, badges    |

---

## 2. Typography

### Font Family Options

#### Option A — Aptos Display

```css
font-family:
  "Aptos Display", "Aptos", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

#### Option B — California

```css
font-family:
  "California", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
```

### Recommendation

Use **Aptos Display** for a sharper, more analytical feel.

Use **California** for a softer, premium, humanist tone.

### Type Scale

| Role       |   Size | Weight |
| ---------- | -----: | -----: |
| H1         | `48px` |  `700` |
| H2         | `32px` |  `600` |
| H3         | `24px` |  `600` |
| Body Large | `18px` |  `400` |
| Body       | `16px` |  `400` |
| Caption    | `13px` |  `400` |

### Typography Guidelines

* Use **Charcoal Gray** for all primary text.
* Use **Mint Green** or **Coral Red** for emphasis.
* Maintain line-height between `1.4` and `1.6`.

---

## 3. Spacing & Layout

### Spacing Scale

```css
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
```

### Layout Rules

* Use `32px` padding for major sections.
* Use `16px` padding inside cards.
* Use `48px` whitespace between major blocks.
* Keep layouts airy and minimal.

---

## 4. Buttons

### Primary Button

| Property   | Value               |
| ---------- | ------------------- |
| Background | Coral Red `#F45B5B` |
| Text       | White               |
| Hover      | Soft Mint `#6EEBC3` |
| Radius     | `8px`               |
| Padding    | `12px 24px`         |
| Weight     | `600`               |

### Secondary Button

| Property   | Value                |
| ---------- | -------------------- |
| Background | Sky Blue `#4DB7E8`   |
| Text       | White                |
| Hover      | Slightly darker blue |
| Radius     | `8px`                |

### Ghost Button

| Property | Value                                  |
| -------- | -------------------------------------- |
| Border   | Mint Green `#3CC8A5`                   |
| Text     | Mint Green `#3CC8A5`                   |
| Hover    | Mint Green background at `10%` opacity |

---

## 5. Cards & Surfaces

### Card Style

| Property   | Value                            |
| ---------- | -------------------------------- |
| Background | Ivory White `#F9F9F9`            |
| Border     | Cool Gray `#DADADA`, `1px`       |
| Radius     | `12px`                           |
| Shadow     | `0 4px 12px rgba(0, 0, 0, 0.06)` |
| Padding    | `24px`                           |

### Panel Background

Use **Mist Blue** `#E8F4FA` for dashboards or data sections.

---

## 6. Iconography

### Icon Rules

Use the ScOracle **S–O icon** as the anchor for the visual language.

All icons should be:

* Line-based
* `2px` stroke
* Rounded caps
* Charcoal Gray or Mint Green

---

## 7. Data Visualization

### Chart Colors

| Use Case                  | Color          |
| ------------------------- | -------------- |
| Primary metric            | Mint Green     |
| Alerts or negative trends | Coral Red      |
| Secondary metric          | Sky Blue       |
| Highlights or predictions | Champagne Gold |

### Data Visualization Guidelines

* Avoid gradients.
* Use rounded bar and line ends.
* Maintain high contrast.

---

## 8. Dark Mode Optional

### Dark Palette

| Role       |     Color |
| ---------- | --------: |
| Background | `#1A1A1A` |
| Surface    | `#222222` |
| Text       | `#F2F2F2` |
| Mint       | `#4FE3BD` |
| Coral      | `#FF6F6F` |
| Blue       | `#5CCBFF` |

### Dark Mode Rules

* Keep the **S–O icon** bright.
* Use subtle shadows instead of borders.

---

## 9. Brand Voice

### Tone

* Confident
* Analytical
* Minimal
* Insight-driven

### Writing Style

* Use short sentences.
* Use clear value statements.
* Use data-first language.

---

## 10. Component Library Starter Set

### Navigation Bar

| Property    | Value          |
| ----------- | -------------- |
| Background  | Ivory          |
| Text        | Charcoal       |
| Active Link | Mint underline |
| Height      | `72px`         |

### Footer

| Property     | Value    |
| ------------ | -------- |
| Background   | Charcoal |
| Text         | Ivory    |
| Accent Links | Mint     |

### Form Fields

| Property | Value            |
| -------- | ---------------- |
| Border   | Cool Gray        |
| Focus    | Mint border glow |
| Radius   | `8px`            |
