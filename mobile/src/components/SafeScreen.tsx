import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  includeTop?: boolean;
}

/**
 * Wrapper reutilizável para garantir que o conteúdo respeite as Safe Areas,
 * especialmente a inferior no Android.
 * Opção includeTop para telas sem Header nativo ou Drawer.
 */
export default function SafeScreen({ children, style, includeTop = false }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      { paddingBottom: Math.max(insets.bottom, 16) },
      includeTop && { paddingTop: Math.max(insets.top, 12) },
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
