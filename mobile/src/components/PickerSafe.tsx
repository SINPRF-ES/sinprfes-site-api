// mobile/src/components/PickerSafe.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform, Modal, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { Picker, PickerProps } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

type PickerSafeItem = { label: string; value: any };

interface PickerSafeProps extends Omit<PickerProps, 'onValueChange'> {
  label?: string;
  items?: PickerSafeItem[];
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  pickerBoxStyle?: ViewStyle;
  onValueChange?: (itemValue: any, itemIndex: number) => void;
}

export const PickerSafe: React.FC<PickerSafeProps> & { Item: typeof Picker.Item } = ({
  label,
  items,
  children,
  containerStyle,
  labelStyle,
  pickerBoxStyle,
  selectedValue,
  onValueChange,
  enabled = true,
  ...pickerProps
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Se for iOS, mantemos o Picker nativo pois ele lida bem com texto longo (roda lateral)
  // Ou podemos usar o Modal para consistência. Vamos de Modal para garantir "anti-truncamento".

  const resolvedItems = items || React.Children.map(children, (child: any) => {
    if (child?.props) {
      return { label: child.props.label, value: child.props.value };
    }
    return null;
  })?.filter(Boolean) || [];

  const selectedItem = resolvedItems.find((i: PickerSafeItem) => i.value === selectedValue);

  const handleSelect = (item: PickerSafeItem, index: number) => {
    if (onValueChange) {
      onValueChange(item.value, index);
    }
    setModalVisible(false);
  };

  return (
    <View style={[styles.block, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}

      <TouchableOpacity
        style={[styles.pickerBox, pickerBoxStyle, !enabled && styles.disabled]}
        onPress={() => enabled && setModalVisible(true)}
        disabled={!enabled}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectedValueText, !selectedItem && styles.placeholderText]} numberOfLines={2}>
          {selectedItem ? selectedItem.label : (pickerProps.prompt || 'Selecione...')}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Selecione uma opção'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={resolvedItems}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.itemRow,
                    item.value === selectedValue && styles.selectedItemRow
                  ]}
                  onPress={() => handleSelect(item, index)}
                >
                  <Text style={[
                    styles.itemLabel,
                    item.value === selectedValue && styles.selectedItemLabel
                  ]}>
                    {item.label}
                  </Text>
                  {item.value === selectedValue && (
                    <MaterialCommunityIcons name="check" size={20} color={COLORS.prfBlue} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.list}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// @ts-ignore
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
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 50,
  },
  disabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  selectedValueText: {
    fontSize: 15,
    color: COLORS.text,
    flex: 1,
    lineHeight: 20,
    paddingRight: 8,
  },
  placeholderText: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: Dimensions.get('window').height * 0.7,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.prfBlue,
  },
  list: {
    width: '100%',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  selectedItemRow: {
    backgroundColor: '#eaf3ff',
  },
  itemLabel: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
    marginRight: 10,
  },
  selectedItemLabel: {
    color: COLORS.prfBlue,
    fontWeight: '700',
  },
});

export default PickerSafe;
