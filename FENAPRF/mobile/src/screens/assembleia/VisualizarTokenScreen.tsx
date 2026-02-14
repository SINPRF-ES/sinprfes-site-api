import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Share, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeScreen from '../../components/SafeScreen';

export default function VisualizarTokenScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { assembleiaId, token, assembleiaTitulo, type } = route.params;
  const [loadingQr, setLoadingQr] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [qrKey, setQrKey] = useState(Date.now());

  const qrPayload = JSON.stringify({
    type: type || 'CREDENCIAMENTO',
    assembleiaId,
    token
  });

  // FENAPRF: Usando API mais robusta e garantindo fundo branco
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qrPayload)}&ecc=M&bgcolor=ffffff`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Token de ${type === 'GLOBAL' ? 'Credenciamento' : 'Quórum'} para a Assembleia: ${assembleiaTitulo}\n\nCódigo: ${token}\n\nPayload QR: ${qrPayload}`,
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o token.');
    }
  };

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <MaterialCommunityIcons name="close" size={28} color="#003366" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QR Code de Check-in</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.assembleiaTitle}>{assembleiaTitulo}</Text>
        <Text style={styles.typeLabel}>{type === 'GLOBAL' ? 'CREDENCIAMENTO GLOBAL' : 'CHAMADA DE QUÓRUM'}</Text>

        <View style={styles.qrContainer}>
          {loadingQr && (
            <ActivityIndicator size="large" color="#003366" style={{ position: 'absolute', zIndex: 1 }} />
          )}

          {qrError ? (
            <TouchableOpacity onPress={() => { setQrError(false); setLoadingQr(true); setQrKey(Date.now()); }} style={styles.retryBox}>
                <MaterialCommunityIcons name="refresh" size={40} color="#003366" />
                <Text style={styles.retryText}>Falha ao carregar. Toque para tentar novamente.</Text>
            </TouchableOpacity>
          ) : (
            <Image
              key={qrKey}
              source={{ uri: `${qrUrl}&t=${qrKey}` }}
              style={[styles.qrImage, { backgroundColor: '#fff' }]}
              resizeMode="contain"
              onLoadStart={() => setLoadingQr(true)}
              onLoadEnd={() => { setLoadingQr(false); setQrError(false); }}
              onError={() => {
                  setLoadingQr(false);
                  setQrError(true);
              }}
            />
          )}
        </View>

        <View style={styles.tokenContainer}>
          <Text style={styles.tokenLabel}>TOKEN PARA DIGITAÇÃO:</Text>
          <Text style={styles.tokenValue}>{token}</Text>
        </View>

        <Text style={styles.hint}>
          Mostre este QR Code aos conselheiros para que realizem o check-in rápido via scanner.
        </Text>

        <TouchableOpacity style={styles.btnShare} onPress={handleShare}>
          <MaterialCommunityIcons name="share-variant" size={24} color="#fff" />
          <Text style={styles.btnShareText}>Compartilhar Token</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  btnBack: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 30,
  },
  assembleiaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
    textAlign: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#f1c40f',
    backgroundColor: '#003366',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 30,
  },
  qrContainer: {
    width: 250,
    height: 250,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  retryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  retryText: {
    marginTop: 10,
    fontSize: 12,
    color: '#003366',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  tokenContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tokenValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#003366',
    letterSpacing: 10,
    marginTop: 4,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
  },
  btnShare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#003366',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    marginTop: 'auto',
  },
  btnShareText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
