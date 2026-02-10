// src/components/PickerWrapper.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface PickerWrapperProps {
  children: React.ReactNode;
  style?: any;
}

/**
 * Componente utilitário para garantir que os Pickers (especialmente no Android)
 * tenham altura adequada e não truncamento de texto.
 */
const PickerWrapper: React.FC<PickerWrapperProps> = ({ children, style }) => {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    minHeight: 52,
    paddingVertical: 6,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});

export default PickerWrapper;
