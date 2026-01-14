// mobile/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getLogsAsText, logger } from '../infra/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error', error, { errorInfo });
  }

  handleReload = () => {
    // Para Expo Go, a melhor forma de recarregar é pedir ao usuário.
    // Em um build de desenvolvimento, poderíamos usar `DevSettings.reload()`.
    this.setState({ hasError: false, error: undefined });
  };

  handleCopyLogs = async () => {
    const logsText = await getLogsAsText();
    await Clipboard.setStringAsync(logsText);
    alert('Logs copiados para a área de transferência.');
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Ocorreu um erro</Text>
          <Text style={styles.subtitle}>
            A aplicação encontrou um problema e não pode continuar.
          </Text>
          <ScrollView style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {this.state.error?.toString()}
            </Text>
          </ScrollView>
          <Button title="Tentar Novamente" onPress={this.handleReload} />
          <View style={{ marginVertical: 5 }} />
          <Button title="Copiar Logs para Suporte" onPress={this.handleCopyLogs} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#6c757d',
  },
  errorContainer: {
    maxHeight: 200,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
  },
  errorText: {
    color: '#dc3545',
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
