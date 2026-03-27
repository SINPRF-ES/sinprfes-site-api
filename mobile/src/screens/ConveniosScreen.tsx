import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import SafeScreen from '../components/SafeScreen';
import { API_BASE_URL } from '../config/env';
import { COLORS } from '../theme/colors';

function getSiteBaseUrl(): string {
  return API_BASE_URL.replace('://api.', '://').replace(/\/+$/, '');
}

export default function ConveniosScreen() {
  const conveniosUrl = `${getSiteBaseUrl()}/convenios.html?embed=1`;

  return (
    <SafeScreen style={styles.container}>
      <WebView
        source={{ uri: conveniosUrl }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.prfBlue} />
          </View>
        )}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
