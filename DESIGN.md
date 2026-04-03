# MAFIA Recruitment Dashboard — Design System

**Version:** 2.0
**Last Updated:** 2025-04-03

---

## Brand Identity

**MAFIA** is a university recruitment platform. The brand is bold, professional, and slightly edgy — reflected in the signature purple accent.

| Element | Value |
|---------|-------|
| **Primary Color** | #cc00cc (MAFIA Purple) |
| **Brand Voice** | Direct, efficient, no-nonsense |
| **Design Philosophy** | Function-first with polish |

---

## Color Palette

### Primary (MAFIA Purple)
```
50:  #f5e6ff  (lightest backgrounds)
500: #cc00cc  (primary brand - main accent)
900: #660066  (dark borders, hover states)
```

### Semantic Colors
| Purpose | Light | Default | Dark | Background |
|---------|-------|---------|------|------------|
| Success | #4ade80 | #22c55e | #16a34a | rgba(34, 197, 94, 0.1) |
| Error | #f87171 | #ef4444 | #dc2626 | rgba(239, 68, 68, 0.1) |
| Warning | #fbbf24 | #f59e0b | #d97706 | rgba(245, 158, 11, 0.1) |
| Info | #60a5fa | #3b82f6 | #2563eb | rgba(59, 130, 246, 0.1) |

### Surfaces (Dark Theme)
```
DEFAULT:  #1a1a2e  (main background)
ELEVATED: #16213e  (cards, modals)
CARD:     #0f0f1a  (nested cards)
INPUT:    #252540  (form inputs)
BORDER:   #2a2a4a  (dividers)
```

### Text
```
Primary:   #ffffff      (headlines, body)
Secondary: rgba(255,255,255,0.8)  (supporting text)
Tertiary:  rgba(255,255,255,0.6)  (labels, hints)
Disabled:  rgba(255,255,255,0.4)  (disabled elements)
```

---

## Typography

### Font Families
```css
--font-sans:     "Inter", sans-serif
--font-mono:     "JetBrains Mono", monospace
--font-display:  "Outfit", "Inter", sans-serif
```

### Type Scale (Major Third: 1.25)
| Size | CSS | Usage |
|------|-----|-------|
| 12px | xs | Captions, labels |
| 14px | sm | Body text, buttons |
| 16px | base | Default body |
| 18px | lg | Emphasized body |
| 20px | xl | Section subheads |
| 24px | 2xl | Card titles |
| 30px | 3xl | Section headers |
| 36px | 4xl | Page title |
| 48px | 5xl | Hero title |
| 60px | 6xl | Display |

### Weights
```
Light:    300  (overlines, decorative)
Normal:   400  (body text)
Medium:   500  (emphasis)
Semibold: 600  (subheadings)
Bold:     700  (headings, buttons)
```

### Line Heights
```
Tight:   1.2  (headings)
Snug:    1.35 (display text)
Normal:  1.5  (body text)
Relaxed: 1.6  (long-form content)
```

---

## Spacing (4px Base Scale)

```
0:  0px      | 4:  16px   | 8:  32px   | 16: 64px
1:  4px      | 5:  20px   | 9:  36px   | 20: 80px
2:  8px      | 6:  24px   | 10: 40px   | 24: 96px
3:  12px     | 7:  28px   | 12: 48px   | 32: 128px
```

**Spacing Rhythm:**
- **Tight sections:** 4px - 16px (cards, inline elements)
- **Standard:** 16px - 32px (layout, component padding)
- **Loose sections:** 32px - 64px (page sections)

---

## Border Radius

```
none:  0px     (sharp edges - decorative only)
sm:    4px     (small elements, inputs)
md:    8px     (default - buttons, cards)
lg:    12px    (larger cards)
xl:    16px    (modals, panels)
2xl:   32px    (hero elements)
full:  9999px  (pills, badges)
```

**Hierarchy:** Inner radius = outer radius - gap
(e.g., button inside card: button radius 8px, card radius 12px)

---

## Shadows

```
none:  (flat elements)
sm:    (subtle elevation)
md:    (cards, dropdowns)
lg:    (modals, popovers)
xl:    (tooltips)

GLOW EFFECTS (MAFIA brand):
glow-sm:  0 0 20px rgba(204, 0, 204, 0.3)
glow-md:  0 0 40px rgba(204, 0, 204, 0.4)
glow-lg:  0 0 60px rgba(204, 0, 204, 0.5)
```

---

## Animation

### Duration
```
Fast:   150ms  (micro-interactions)
Base:   200ms  (standard transitions)
Slow:   300ms  (motion, layout)
Slower: 500ms  (page transitions)
```

### Easing
```
Ease:      cubic-bezier(0.4, 0, 0.2, 1)  (standard)
EaseIn:    cubic-bezier(0.4, 0, 1, 1)    (entering)
EaseOut:   cubic-bezier(0, 0, 0.2, 1)    (exiting)
EaseInOut: cubic-bezier(0.4, 0, 0.2, 1)  (moving)
```

**Rules:**
- Entering elements → ease-out
- Exiting elements → ease-in
- Movement → ease-in-out
- Only animate `transform` and `opacity` (never width/height/top/left)

---

## Component Patterns

### Buttons

| Variant | Background | Text | Border | Glow |
|---------|-----------|------|--------|------|
| Primary | #cc00cc | white | none | glow-sm on hover |
| Secondary | #252540 | white | 2px solid #cc00cc | none |
| Ghost | transparent | #cc00cc | 1px solid #cc00cc | glow-sm on hover |
| Danger | #ef4444 | white | none | none |

**States:** hover (transform: translateY(-1px)), active (translateY(0)), disabled (opacity: 0.5, cursor: not-allowed)

### Cards
```
Background: #0f0f1a
Border: 1px solid #2a2a4a
Radius: 12px
Shadow: md on hover
Padding: 16px - 24px
```

### Inputs
```
Background: #252540
Border: 1px solid #2a2a4a → #cc00cc (focus)
Radius: 8px
Padding: 12px 16px
Placeholder: rgba(255,255,255,0.4)
```

---

## Layout

### Container Widths
```
sm:  640px   (mobile)
md:  768px   (tablet)
lg:  1024px  (desktop)
xl:  1280px  (wide)
2xl: 1536px  (ultrawide)
```

### Grid
```
2 columns:  mobile
3 columns:  tablet
4 columns:  desktop
```

---

## Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Laptops |
| xl | 1280px | Desktop |
| 2xl | 1536px | Wide screens |

**Mobile-First:** Write base styles for mobile, add `@media (min-width: ...)` for larger screens.

---

## Accessibility

- **Touch Targets:** Minimum 44x44px
- **Contrast:** WCAG AA (4.5:1 for body text)
- **Focus Ring:** 2px solid #cc00cc, offset 2px
- **Skip Links:** Present for keyboard navigation
- **Aria Labels:** All interactive elements labeled

---

## Page Layout Patterns

### Login Page
- Centered card, max-width 400px
- MAFIA logo + tagline top
- Google sign-in primary CTA
- Minimal decoration, glow effect on brand

### Dashboard
- Sidebar navigation (collapsible on mobile)
- Top bar with user profile
- Card-based content grid
- Search bar prominent

### Admin Portal
- Same base as dashboard
- Additional data tables
- Action buttons per row

---

## Anti-Patterns (DO NOT USE)

- ❌ Gradient backgrounds (purple-to-white screams "AI-generated")
- ❌ Decorative blobs, circles, waves
- ❌ Icons in colored circles
- ❌ Generic 3-column feature grids
- ❌ Emoji as design elements
- ❌ Centered everything (mix alignment)
- ❌ Uniform bubbly radius on all elements
- ❌ Placeholder/lorem ipsum text

---

## Implementation

### Import Tokens
```javascript
import { colors, typography, spacing, borderRadius, shadows } from './theme/tokens';
```

### Apply Theme
```javascript
import { applyDesignTokens } from './theme/tokens';

// In App.js useEffect
useEffect(() => {
  applyDesignTokens();
}, []);
```

### Styled Component Example
```javascript
const Card = styled.div`
  background: ${colors.surface.card};
  border: 1px solid ${colors.surface.border};
  border-radius: ${borderRadius.lg};
  padding: ${spacing[6]};
  box-shadow: ${shadows.md};
  transition: ${transitions.base};

  &:hover {
    box-shadow: ${shadows.lg};
    transform: translateY(-2px);
  }
`;
```
