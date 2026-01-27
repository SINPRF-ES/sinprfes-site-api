## 2025-05-15 - [Accessible Navigation Links]
**Learning:** The application uses `Pressable` for navigation links (e.g., "Esqueci minha senha") without setting `accessibilityRole="link"`. Adding this role along with a clear `accessibilityLabel` ensures screen reader users understand the interaction target is a navigation action.
**Action:** Always apply `accessibilityRole="link"` and descriptive `accessibilityLabel` to `Pressable` or `TouchableOpacity` elements that perform navigation.

## 2026-01-27 - [Semantic Form Metadata & Keyboard Flow]
**Learning:** Mobile forms benefit greatly from `textContentType`, `autoComplete`, and `returnKeyType`. Adding `onSubmitEditing` to the final field in a form (e.g., password or 2FA token) allows users to submit without dismissing the keyboard and manually tapping a button, creating a much smoother "delightful" flow.
**Action:** Always pair `returnKeyType="done"` or `"send"` with an `onSubmitEditing` handler for primary form actions. Use standard `textContentType` values like `birthdate` (not `birthdateDay`).
