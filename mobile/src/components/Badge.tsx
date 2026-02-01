import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'info' | 'error' | 'default' | 'pink';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', style, textStyle }) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'success':
        return styles.success;
      case 'warning':
        return styles.warning;
      case 'info':
        return styles.info;
      case 'error':
        return styles.error;
      case 'pink':
        return styles.pink;
      default:
        return styles.default;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'success':
        return styles.successText;
      case 'warning':
        return styles.warningText;
      case 'info':
        return styles.infoText;
      case 'error':
        return styles.errorText;
      case 'pink':
        return styles.pinkText;
      default:
        return styles.defaultText;
    }
  };

  return (
    <View style={[styles.container, getVariantStyle(), style]}>
      <Text style={[styles.label, getTextStyle(), textStyle]}>{label || '—'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  success: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#34A853',
  },
  successText: {
    color: '#1E7E34',
  },
  warning: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  warningText: {
    color: '#856404',
  },
  info: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  infoText: {
    color: '#0D47A1',
  },
  error: {
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: '#D32F2F',
  },
  errorText: {
    color: '#B71C1C',
  },
  default: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#BDBDBD',
  },
  defaultText: {
    color: '#616161',
  },
  pink: {
    backgroundColor: '#FCE4EC',
    borderWidth: 1,
    borderColor: '#F06292',
  },
  pinkText: {
    color: '#880E4F',
  },
});

export default Badge;
