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
