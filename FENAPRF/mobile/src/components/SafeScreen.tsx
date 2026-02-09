import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  top?: boolean;
}

/**
 * Wrapper reutilizável para garantir que o conteúdo respeite as Safe Areas,
 * especialmente a inferior no Android.
 */
export default function SafeScreen({ children, style, top = false }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      {
        paddingBottom: Math.max(insets.bottom, 16),
        paddingTop: top ? insets.top : 0
      },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
