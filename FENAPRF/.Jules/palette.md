# Palette Journal - FENAPRF UX & A11y Insights

- **Header Menu Accessibility**: All `HeaderMenu` actions must have explicit `accessibilityRole="button"` and `accessibilityLabel` to be usable by screen readers.
- **Async Action Feedback**: Header actions should be disabled and their labels updated (e.g., adding "(Aguarde...)") during saving states to prevent double-submits and provide immediate user feedback.
- **Color Consistency**: The brand color `#003366` (Deep Blue) is the standard for primary actions and headers across the application.
