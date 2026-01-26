## 2025-05-15 - [Accessible Navigation Links]
**Learning:** The application uses `Pressable` for navigation links (e.g., "Esqueci minha senha") without setting `accessibilityRole="link"`. Adding this role along with a clear `accessibilityLabel` ensures screen reader users understand the interaction target is a navigation action.
**Action:** Always apply `accessibilityRole="link"` and descriptive `accessibilityLabel` to `Pressable` or `TouchableOpacity` elements that perform navigation.
