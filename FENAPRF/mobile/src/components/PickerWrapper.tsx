// src/components/PickerWrapper.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface PickerWrapperProps {
  children: React.ReactNode;
  style?: any;
}

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
    ...Platform.select({
      ios: {
        paddingVertical: 0,
      },
      android: {
        height: 55,
        justifyContent: 'center',
      },
    }),
  },
});

export default PickerWrapper;
