import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, Share, Platform, Dimensions, Image } from 'react-native';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '../infra/logger';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config/env';
import SafeScreen from '../components/SafeScreen';

export default function FileViewerScreen({ route, navigation }: any) {
  const { localUri, remoteUrl, title, fileId, type, context } = route.params;
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentLocalUri, setCurrentLocalUri] = useState(localUri);
  const [mimeType, setMimeType] = useState<string | null>(null);

  useEffect(() => {
    logger.info('[file.open.start]', { context, type, fileId, localUri, remoteUrl });

    if (!currentLocalUri && remoteUrl) {
      downloadToCache();
    } else {
      setLoading(false);
      inferMimeType();
    }
  }, []);

  const inferMimeType = () => {
    const uri = currentLocalUri || remoteUrl || '';
    const cleanUri = uri.split('?')[0];
    const extension = cleanUri.split('.').pop()?.toLowerCase();

    if (extension === 'pdf') setMimeType('application/pdf');
    else if (['jpg', 'jpeg', 'png', 'webp'].includes(extension || '')) setMimeType(`image/${extension === 'jpg' ? 'jpeg' : extension}`);
  };

  const downloadToCache = async () => {
    try {
      setLoading(true);
      const cleanUrl = remoteUrl.split('?')[0];
      const extension = cleanUrl.split('.').pop()?.toLowerCase() || 'bin';
      const fileName = `view_${fileId || Date.now()}.${extension}`;
      const dest = `${FileSystem.cacheDirectory}${fileName}`;

      logger.info('[file.download.start]', { remoteUrl, dest });

      let result = await FileSystem.downloadAsync(remoteUrl, dest);

      logger.info('[file.download.success]', { status: result.status });

      // Fallback controlado para proxy do sistema se falhar download direto de edital (Issue A)
      if (result.status !== 200 && context === 'assembleia-edital' && fileId) {
          const proxyUrl = `${API_BASE_URL}/api/assembleias/${fileId}/edital`;
          logger.info('[file.download.fallback.start]', { proxyUrl });

          try {
              result = await FileSystem.downloadAsync(proxyUrl, dest, {
                  headers: {
                      'Authorization': `Bearer ${token}`
                  }
              });
              logger.info('[file.download.fallback.success]', { status: result.status });
          } catch (fallbackErr) {
              logger.error('[file.download.fallback.error]', fallbackErr);
          }
      }

      if (result.status === 401 || result.status === 403) {
        throw new Error(`Acesso negado (Status ${result.status}). Verifique as permissões do arquivo.`);
      }

      if (result.status !== 200) {
        throw new Error(`Falha no download (Status ${result.status})`);
      }

      setCurrentLocalUri(result.uri);
      const remoteMime = result.headers['content-type'] || result.headers['Content-Type'];
      if (remoteMime) setMimeType(remoteMime);
      else inferMimeType();

    } catch (err: any) {
      logger.error('[file.download.error]', err, { remoteUrl });
      Alert.alert('Erro', err.message || 'Não foi possível carregar o arquivo.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const uriToShare = currentLocalUri || remoteUrl;
      logger.info('[file.share.start]', { fileId, uriToShare });

      await Share.share({
        url: Platform.OS === 'ios' ? uriToShare : undefined,
        message: Platform.OS === 'android' ? uriToShare : title,
        title: title,
      });
      logger.info('[file.share.success]');
    } catch (err: any) {
      logger.error('[file.share.error]', err);
    }
  };

  const handleSave = async () => {
    if (!currentLocalUri) {
      Alert.alert('Aviso', 'Aguarde o download concluir para salvar.');
      return;
    }

    try {
      logger.info('[file.save.start]', { fileId, currentLocalUri });

      if (Platform.OS === 'android') {
        const SAF = FileSystem.StorageAccessFramework;
        const permissions = await SAF.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const base64Content = await FileSystem.readAsStringAsync(currentLocalUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const safeMime = mimeType || (currentLocalUri.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          const newFileUri = await SAF.createFileAsync(permissions.directoryUri, title, safeMime);
          await FileSystem.writeAsStringAsync(newFileUri, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });

          logger.info('[file.save.success]', { uri: newFileUri });
          Alert.alert('Sucesso', 'Arquivo salvo com sucesso!');
        } else {
          logger.info('[file.save.denied]');
          handleShare();
        }
      } else {
        handleShare();
      }
    } catch (err: any) {
      logger.error('[file.save.error]', err);
      handleShare();
    }
  };

  const isPdf = mimeType?.includes('pdf') || currentLocalUri?.toLowerCase().endsWith('.pdf');
  const isImage = mimeType?.startsWith('image/') || (['jpg', 'jpeg', 'png', 'webp'].some(ext => currentLocalUri?.toLowerCase().endsWith(ext)));

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <FontAwesome name="share-alt" size={20} color="#003366" />
          <Text style={styles.actionText}>Compartilhar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
          <FontAwesome name="download" size={20} color="#003366" />
          <Text style={styles.actionText}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading && <ActivityIndicator size="large" color="#003366" style={styles.loader} />}

        {isPdf && currentLocalUri && (
          <Pdf
            trustAllCerts={false}
            source={{ uri: currentLocalUri }}
            onLoadComplete={(numberOfPages, filePath) => {
              setLoading(false);
              logger.info('[file.open.pdf.success]', { numberOfPages, filePath });
            }}
            onPageChanged={(page, numberOfPages) => {
                logger.info(`[file.page.changed] ${page}/${numberOfPages}`);
            }}
            onPressLink={(uri) => {
                logger.info(`[file.link.pressed] ${uri}`);
            }}
            onError={(error) => {
              setLoading(false);
              logger.error('[file.open.pdf.error]', error);
              Alert.alert(
                'Erro de Visualização',
                'Não foi possível abrir o PDF nativamente. Deseja compartilhar para abrir em outro app?',
                [
                  { text: 'Não', style: 'cancel' },
                  { text: 'Sim, Compartilhar', onPress: () => handleShare() },
                ]
              );
            }}
            style={styles.viewer}
          />
        )}

        {isImage && currentLocalUri && (
          <Image
            source={{ uri: currentLocalUri }}
            style={styles.viewer}
            resizeMode="contain"
            onLoad={() => setLoading(false)}
            onError={() => {
                setLoading(false);
                Alert.alert('Erro', 'Não foi possível carregar a imagem.');
            }}
          />
        )}

        {!loading && !isPdf && !isImage && (
            <View style={styles.fallbackContainer}>
                <MaterialCommunityIcons name="file-question" size={64} color="#ccc" />
                <Text style={styles.fallbackText}>Visualização não disponível para este tipo de arquivo.</Text>
                <TouchableOpacity style={styles.btnShareFallback} onPress={handleShare}>
                    <Text style={styles.btnShareFallbackText}>Abrir via Compartilhamento</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  actionText: {
    color: '#003366',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  viewer: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  loader: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1,
  },
  fallbackContainer: {
    alignItems: 'center',
    padding: 20,
  },
  fallbackText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  btnShareFallback: {
    backgroundColor: '#003366',
    padding: 15,
    borderRadius: 8,
  },
  btnShareFallbackText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
