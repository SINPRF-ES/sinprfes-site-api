import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, Share, Platform, Dimensions } from 'react-native';
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system';
import { logger } from '../infra/logger';
import { FontAwesome } from '@expo/vector-icons';

export default function PdfViewerScreen({ route }: any) {
  const { localUri, title, fileId } = route.params;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logger.info('[pdf.open.start]', { fileId, localUri });
  }, [localUri, fileId]);

  const handleShare = async () => {
    try {
      logger.info('[pdf.share.start]', { fileId, localUri });
      await Share.share({
        url: Platform.OS === 'ios' ? localUri : undefined,
        message: Platform.OS === 'android' ? localUri : title,
        title: title,
      });
      logger.info('[pdf.share.success]');
    } catch (err: any) {
      logger.error('[pdf.share.error]', err);
    }
  };

  const handleSave = async () => {
    try {
      logger.info('[pdf.save.start]', { fileId, localUri });

      if (Platform.OS === 'android') {
        const SAF = FileSystem.StorageAccessFramework;
        const permissions = await SAF.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const base64Content = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const mimeType = 'application/pdf';
          const newFileUri = await SAF.createFileAsync(permissions.directoryUri, title, mimeType);
          await FileSystem.writeAsStringAsync(newFileUri, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });

          logger.info('[pdf.save.success]', { uri: newFileUri });
          Alert.alert('Sucesso', 'Arquivo salvo com sucesso!');
        } else {
          logger.info('[pdf.save.denied]');
          handleShare();
        }
      } else {
        handleShare();
      }
    } catch (err: any) {
      logger.error('[pdf.save.error]', err);
      handleShare();
    }
  };

  return (
    <View style={styles.container}>
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

      {loading && <ActivityIndicator size="large" color="#003366" style={styles.loader} />}

      <Pdf
        trustAllCerts={false}
        source={{ uri: localUri }}
        onLoadComplete={(numberOfPages, filePath) => {
          setLoading(false);
          logger.info('[pdf.open.native.success]', { numberOfPages, filePath });
        }}
        onPageChanged={(page, numberOfPages) => {
          logger.info(`[pdf.page.changed] ${page}/${numberOfPages}`);
        }}
        onError={(error) => {
          setLoading(false);
          logger.error('[pdf.open.native.error]', error);
          Alert.alert(
            'Erro de Visualização',
            'Não foi possível abrir o PDF nativamente. Deseja compartilhar para abrir em outro app?',
            [
              { text: 'Não', style: 'cancel' },
              { text: 'Sim, Compartilhar', onPress: () => {
                  logger.info('[pdf.open.fallback.share]');
                  handleShare();
                }
              },
            ]
          );
        }}
        onPressLink={(uri) => {
          logger.info(`[pdf.link.pressed] ${uri}`);
        }}
        style={styles.pdf}
      />
    </View>
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
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
    zIndex: 1,
  }
});
