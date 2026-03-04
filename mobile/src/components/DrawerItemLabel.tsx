// mobile/src/components/DrawerItemLabel.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

interface DrawerItemLabelProps {
  emoji: string;
  label: string;
  color?: string;
  focused?: boolean;
}

const DrawerItemLabel: React.FC<DrawerItemLabelProps> = ({ emoji, label, color, focused }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, { color: color || COLORS.text, fontWeight: focused ? '700' : '500' }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 22,
    marginRight: 10,
    width: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 15,
  },
});

export default DrawerItemLabel;
