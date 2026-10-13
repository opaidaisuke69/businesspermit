import { Platform } from 'react-native'

// ── LCC BPA Color Palette ─────────────────────────────────────
// Base: Midnight Green  #073B3A
// Dartmouth Green       #0B6E4F
// Pigment Green         #08A045
// Emerald               #21D375

export const Colors = {
  // Brand
  primary:     '#073B3A',   // Midnight Green — main brand
  primaryDark: '#052928',   // darker shade for pressed states
  secondary:   '#0B6E4F',   // Dartmouth Green — secondary actions
  accent:      '#08A045',   // Pigment Green — highlights, badges
  emerald:     '#21D375',   // Emerald — success, active states
  gold:        '#C9A227',   // kept for seal/logo accent

  // Semantic
  success:     '#21D375',
  warning:     '#F59E0B',
  danger:      '#EF4444',
  info:        '#0B6E4F',

  // Neutrals
  bg:          '#F0F7F4',   // very light green-tinted background
  card:        '#FFFFFF',
  border:      '#D1E8E2',
  text:        '#0D2B28',
  textMuted:   '#4A7A72',
  textLight:   '#8AADA8',

  // Tab / nav
  light: {
    text:           '#0D2B28',
    background:     '#F0F7F4',
    tint:           '#073B3A',
    icon:           '#4A7A72',
    tabIconDefault: '#4A7A72',
    tabIconSelected:'#073B3A',
  },
  dark: {
    text:           '#E8F5F2',
    background:     '#0D2B28',
    tint:           '#21D375',
    icon:           '#8AADA8',
    tabIconDefault: '#8AADA8',
    tabIconSelected:'#21D375',
  },
}

export const Fonts = Platform.select({
  ios:     { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
})
