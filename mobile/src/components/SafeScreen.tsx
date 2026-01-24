import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wrapper reutilizável para garantir que o conteúdo respeite as Safe Areas,
 * especialmente a inferior no Android.
 */
export default function SafeScreen({ children, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.container,
      { paddingBottom: Math.max(insets.bottom, 16) },
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
