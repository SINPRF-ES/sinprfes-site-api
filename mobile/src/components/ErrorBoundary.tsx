// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackUI?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallbackUI || (
        <View style={styles.container}>
          <Text style={styles.text}>⚠️ Erro ao renderizar esta seção.</Text>
          <Text style={styles.subtext}>Por favor, atualize o app ou contate o suporte.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff8f8',
    borderColor: '#e57373',
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#c0392b',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtext: {
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 4,
  }
});

export default ErrorBoundary;
