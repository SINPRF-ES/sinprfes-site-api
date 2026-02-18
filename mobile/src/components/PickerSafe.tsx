// mobile/src/components/PickerSafe.tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { Picker, PickerProps } from '@react-native-picker/picker';

interface PickerSafeProps extends PickerProps {
  label?: string;
  items?: { label: string; value: any }[];
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  pickerBoxStyle?: ViewStyle;
}

export const PickerSafe: React.FC<PickerSafeProps> & { Item: typeof Picker.Item } = ({
  label,
  items,
  children,
  containerStyle,
  labelStyle,
  pickerBoxStyle,
  ...pickerProps
}) => {
  return (
    <View style={[styles.block, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <View style={[styles.pickerBox, pickerBoxStyle]}>
        <Picker
          {...pickerProps}
          style={[
            styles.picker,
            pickerProps.style,
            Platform.OS === 'android' && { height: 50 }
          ]}
        >
          {items
            ? items.map((item, index) => (
                <Picker.Item key={index} label={item.label} value={item.value} />
              ))
            : children
          }
        </Picker>
      </View>
    </View>
  );
};

PickerSafe.Item = Picker.Item;

const styles = StyleSheet.create({
  block: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  pickerBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        // iOS picker has its own height behavior
      },
      android: {
        minHeight: 50,
      }
    })
  },
  picker: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});

export default PickerSafe;
