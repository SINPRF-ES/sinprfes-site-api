import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import PickerWrapper from './PickerWrapper';

interface CanonicalPickerItem {
  label: string;
  value: any;
  color?: string;
}

interface CanonicalPickerProps {
  items: CanonicalPickerItem[];
  selectedValue: any;
  onValueChange: (itemValue: any, itemIndex: number) => void;
  placeholder?: string;
  enabled?: boolean;
  style?: any;
  wrapperStyle?: ViewStyle;
  mode?: 'dialog' | 'dropdown';
  accessibilityLabel?: string;
}

/**
 * Componente de Picker padronizado para o app FENAPRF.
 * Garante que não haja truncamento de texto no Android e mantém visual consistente.
 */
const CanonicalPicker: React.FC<CanonicalPickerProps> = ({
  items,
  selectedValue,
  onValueChange,
  placeholder,
  enabled = true,
  style,
  wrapperStyle,
  mode = 'dropdown',
  accessibilityLabel,
}) => {
  return (
    <PickerWrapper style={wrapperStyle}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        enabled={enabled}
        style={[styles.picker, style]}
        mode={mode}
        accessibilityLabel={accessibilityLabel}
        // No Android, itemStyle ajuda a evitar cortes dependendo da versão
        // @ts-ignore - itemStyle existe no Picker de Android
        itemStyle={{ height: 52 }}
      >
        {placeholder && (
          <Picker.Item label={placeholder} value="" color="#999" />
        )}
        {items.map((item, index) => (
          <Picker.Item
            key={`${item.value}-${index}`}
            label={item.label}
            value={item.value}
            color={item.color}
          />
        ))}
      </Picker>
    </PickerWrapper>
  );
};

const styles = StyleSheet.create({
  picker: {
    width: '100%',
    minHeight: 52,
    color: '#333',
  },
});

export default CanonicalPicker;
