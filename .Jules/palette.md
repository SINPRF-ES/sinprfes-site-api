## 2025-05-15 - [Accessible Navigation Links]
**Learning:** The application uses `Pressable` for navigation links (e.g., "Esqueci minha senha") without setting `accessibilityRole="link"`. Adding this role along with a clear `accessibilityLabel` ensures screen reader users understand the interaction target is a navigation action.
**Action:** Always apply `accessibilityRole="link"` and descriptive `accessibilityLabel` to `Pressable` or `TouchableOpacity` elements that perform navigation.

## 2026-01-27 - [Semantic Form Metadata & Keyboard Flow]
**Learning:** Mobile forms benefit greatly from `textContentType`, `autoComplete`, and `returnKeyType`. Adding `onSubmitEditing` to the final field in a form (e.g., password or 2FA token) allows users to submit without dismissing the keyboard and manually tapping a button, creating a much smoother "delightful" flow.
**Action:** Always pair `returnKeyType="done"` or `"send"` with an `onSubmitEditing` handler for primary form actions. Use standard `textContentType` values like `birthdate` (not `birthdateDay`).

## 2025-05-16 - [Numeric Input Mode for CPF]
**Learning:** For fields like CPF that consist of digits but require specific formatting (e.g., dots and dashes), using `inputmode="numeric"` instead of `type="number"` allows the browser to show the numeric keypad on mobile without breaking formatting logic or introducing unwanted spin buttons.
**Action:** Always use `inputmode="numeric"` for CPF, CEP, and telephone fields in web forms to improve mobile UX.

## 2026-05-18 - [Interactive Loading States & Visual Limits]
**Learning:** Providing immediate visual feedback during async operations (disabling buttons and changing text) significantly reduces user anxiety and prevents double-submissions. Similarly, visual cues on character limits (e.g., changing color at 90% threshold) help users self-correct before hitting a hard validation error.
**Action:** Implement button loading states in all primary forms. Add visual thresholds to character counters for critical inputs like push notification titles and bodies.

## 2026-02-04 - [Clipboard Feedback UX Pattern]
**Learning:** For clipboard operations (e.g., 2FA secret copy), buttons should provide transient visual feedback by updating `textContent` to '✅ Copiado!' for 2000ms. Use `textContent` instead of `innerHTML` to avoid XSS risks and maintain a clean interaction loop.
**Action:** Always provide a "Copy" utility for long, sensitive, or complex alphanumeric strings (tokens, keys, IDs) that users might need to transfer to other apps, ensuring transient text feedback is used.

## 2026-02-17 - [Traceable Error Responses]
**Learning:** Including a `requestId` in API error responses empowers users to provide specific references when seeking support. This drastically reduces the time needed for developers to locate relevant logs in cloud environments (Railway/Render).
**Action:** Standardized all backend controllers to include `requestId` in both success and error JSON payloads.

## 2025-05-15 - [Password Visibility Toggle]
**Learning:** Adding a password visibility toggle as a global utility (`initPasswordToggles`) is an efficient way to enhance legacy forms. Using a wrapper element with relative positioning ensures consistent button placement across different layouts, but care must be taken to keep the implementation under 50 lines to comply with agent constraints. Emojis (👁️/🙈) serve as effective, zero-dependency icons.
**Action:** Use the `initPasswordToggles` pattern for future password fields and ensure it's called in the main entry point of the application.

## 2025-05-20 - [Modern React Login UX]
**Learning:** Modernizing legacy React login forms requires a multi-faceted approach: loading states for feedback, `inputMode="numeric"` for CPF, and `autoComplete` for password managers. Using `aria-label` is critical when visual labels are omitted in favor of placeholders to maintain accessibility.
**Action:** Implement a holistic "Modern Login" pattern in React apps: `loading` state + `aria-label` + `autoComplete` + `inputMode` + `passwordToggle`.

## 2025-05-22 - [Initial ARIA States for Dynamic UI]
**Learning:** Dynamically generated UI elements (like password toggles or floating alerts) often miss critical initial accessibility metadata. Adding `aria-label`, `title`, and `aria-pressed` at the moment of creation—not just after the first interaction—is essential for a "fail-secure" accessible experience.
**Action:** Always set descriptive ARIA labels and appropriate initial states (`aria-pressed="false"`) when creating icon-only buttons via JavaScript. Ensure these elements have `:focus-visible` styles in CSS to support keyboard navigation.

## 2025-05-23 - [ARIA Tab Pattern for Sidebar Navigation]
**Learning:** Sidebar navigation that switches between different views on the same page should follow the WAI-ARIA Tab pattern. This involves using `role="tablist"` on the container, `role="tab"` on the buttons, and `role="tabpanel"` on the target sections. Consistent IDs (e.g., prefixed with `tab-`) and appropriate `aria-selected`, `aria-controls`, and `aria-labelledby` attributes ensure assistive technologies correctly interpret the relationship and state of the navigation.
**Action:** Implement the ARIA Tab pattern for all non-navigation sidebar menus. Ensure JS logic updates `aria-selected` synchronously with visual state changes. Wrap decorative emojis in `<span aria-hidden="true">` to reduce screen reader noise.

## 2026-03-04 - [Accessible Forms and Real-time Feedback]
**Learning:** Web forms must provide explicit context for screen readers and visual feedback for all users. Using `aria-describedby` linked to `sr-only` hints provides precise instructions without cluttering the UI. `aria-live="polite"` on message containers ensures asynchronous feedback (like login errors) is announced.
**Action:** Always use `aria-describedby` for complex fields (like CPF/formatted inputs) and `aria-live` for status messages. Buttons performing async actions must use `aria-busy="true"` and show a visual indicator (spinner) while disabled.
