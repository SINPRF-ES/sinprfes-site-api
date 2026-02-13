# Palette Journal - FENAPRF UX & A11y Insights

- **Header Menu Accessibility**: All `HeaderMenu` actions must have explicit `accessibilityRole="button"` and `accessibilityLabel` to be usable by screen readers.
- **Async Action Feedback**: Header actions should be disabled and their labels updated (e.g., adding "(Aguarde...)") during saving states to prevent double-submits and provide immediate user feedback.
- **Color Consistency**: The brand color `#003366` (Deep Blue) is the standard for primary actions and headers across the application.
- **Explicit Accessibility Labels**: Interactive components like `CanonicalPicker` and custom report buttons now require `accessibilityLabel` to provide clear context for screen reader users, especially for icon-only or multi-state actions.
- **MemberCard Accessibility**: Member data should be summarized in a single `accessibilityLabel` on the card container (Name, CPF, Cargo, UF) to provide immediate context for non-sighted users.
- **Section Headers**: Use `accessibilityRole="header"` and descriptive labels (e.g., "Seção: [Nome]") for screen section dividers.
- **Async State Accessibility**: Always provide an `accessibilityLabel` to `ActivityIndicator` during data fetching or processing states.
- **List Item Clarity**: Identify list items by type (e.g., "Pasta:", "Arquivo:") and action (e.g., "Toque para abrir") in their `accessibilityLabel`.
- **Consolidated Card Accessibility**: Large interactive cards (like `MemberCard`) should summarize all data in a single `accessibilityLabel` on the container. Internal elements should be hidden from screen readers using `importantForAccessibility="no-hide-descendants"` (Android) and `accessibilityElementsHidden={true}` (iOS) to avoid redundant announcements.
- **Form Navigation Flow**: Improve UX by using `returnKeyType` ("next", "search", "done") and `onSubmitEditing` in `TextInput` components to guide users through multi-field forms.
