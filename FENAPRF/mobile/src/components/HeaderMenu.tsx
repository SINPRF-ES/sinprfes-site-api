import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

export interface MenuAction {
  label: string;
  onPress: () => void;
  icon?: string;
  isDestructive?: boolean;
  disabled?: boolean;
}

interface Props {
  actions: MenuAction[];
  triggerLabel?: string; // Mantido por retrocompatibilidade, mas ignorado se seguirmos o padrão "Opções" fixo
}

export default function HeaderMenu({ actions }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  if (!actions || actions.length === 0) return null;

  const openSheet = () => {
    setVisible(true);
    Animated.timing(animation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <View>
      <TouchableOpacity
        onPress={openSheet}
        style={styles.anchor}
        accessibilityRole="button"
        accessibilityLabel="Abrir menu de opções"
      >
        <View style={styles.triggerWithLabel}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
          <Text style={styles.label}>Opções</Text>
        </View>
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={closeSheet}
      >
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.bottomSheet,
                  {
                    transform: [{ translateY }],
                    paddingBottom: insets.bottom + 20
                  }
                ]}
              >
                <View style={styles.indicator} />
                <Text style={styles.sheetTitle}>Opções da Tela</Text>

                <View style={styles.actionsContainer}>
                  {actions.map((item, index) => (
                    <TouchableOpacity
                      key={item.label + index}
                      style={[
                        styles.menuItem,
                        item.isDestructive && styles.destructiveItem,
                        item.disabled && styles.disabledItem
                      ]}
                      disabled={item.disabled}
                      onPress={() => {
                        closeSheet();
                        // Pequeno delay para garantir que o modal fechou antes de disparar a ação
                        setTimeout(item.onPress, 300);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={item.disabled ? `${item.label} (Desativado)` : item.label}
                      accessibilityState={{ disabled: item.disabled }}
                    >
                      {item.icon && (
                        <MaterialCommunityIcons
                          name={item.icon as any}
                          size={26}
                          color={item.isDestructive ? '#fff' : '#003366'}
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

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={closeSheet}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar e fechar menu"
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    padding: 8,
    marginRight: 4,
  },
  triggerWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: height * 0.8,
  },
  indicator: {
    width: 40,
    height: 5,
    backgroundColor: '#ccc',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 15,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  destructiveItem: {
    backgroundColor: '#e74c3c',
  },
  disabledItem: {
    opacity: 0.5,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  destructiveText: {
    color: '#fff',
  },
  cancelButton: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
});
