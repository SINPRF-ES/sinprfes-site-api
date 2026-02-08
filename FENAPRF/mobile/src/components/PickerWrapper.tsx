import React from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';

interface PickerWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const PickerWrapper: React.FC<PickerWrapperProps> = ({ children, style }) => {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        justifyContent: 'center',
      },
      android: {
        justifyContent: 'center',
        // No Android, o Picker costuma precisar de um ajuste de altura se estiver dentro de um wrapper
        // mas o estilo passado via props ou o estilo do próprio Picker costuma resolver.
      }
    })
  },
});
