import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface MenuAction {
  label: string;
  onPress: () => void;
  icon?: string;
  isDestructive?: boolean;
}

interface Props {
  actions: MenuAction[];
}

export default function HeaderMenu({ actions }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  if (actions.length === 0) return null;

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.anchor}>
        <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <View style={[styles.menuContainer, { marginTop: insets.top + 10 }]}>
              {actions.map((item, index) => (
                <TouchableOpacity
                  key={item.label + index}
                  style={[
                    styles.menuItem,
                    index === actions.length - 1 && styles.lastMenuItem
                  ]}
                  onPress={() => {
                    setVisible(false);
                    item.onPress();
                  }}
                >
                  {item.icon && (
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={20}
                      color={item.isDestructive ? '#e74c3c' : '#333'}
                      style={styles.menuIcon}
                    />
                  )}
                  <Text style={[
                    styles.menuText,
                    item.isDestructive && styles.destructiveText
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    padding: 8,
    marginRight: -8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 200,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: '#333',
  },
  destructiveText: {
    color: '#e74c3c',
  },
});
