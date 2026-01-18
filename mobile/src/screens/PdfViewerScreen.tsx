import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text, Share, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { logger } from '../infra/logger';
import { FontAwesome } from '@expo/vector-icons';

export default function PdfViewerScreen({ route }: any) {
  const { localUri, title, fileId } = route.params;
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPdfAsBase64() {
      try {
        logger.info('[Publicacoes.openLocal.pdf.start]', { fileId, localUri });

        const info = await FileSystemLegacy.getInfoAsync(localUri);
        logger.info('[Publicacoes.pdf.fsInfo]', { exists: info.exists, size: info.size, uri: localUri });
        logger.info('[Publicacoes.pdf.encodingType]', { encodingType: typeof FileSystemLegacy?.EncodingType });

        if (!FileSystemLegacy?.EncodingType?.Base64) {
          throw new Error('EncodingType.Base64 indisponível (FileSystemLegacy)');
        }

        const content = await FileSystemLegacy.readAsStringAsync(localUri, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });

        if (!content) {
          throw new Error('Arquivo Base64 vazio');
        }

        logger.info('[Publicacoes.openLocal.pdf.base64.ok]', { size: content.length });
        setBase64(content);
      } catch (err: any) {
        logger.error('[Publicacoes.openLocal.pdf.error]', err, {
          message: err.message,
          localUri,
          encodingType: typeof FileSystemLegacy?.EncodingType
        });
        Alert.alert('Erro', 'Não foi possível carregar o PDF.');
      } finally {
        setLoading(false);
      }
    }

    loadPdfAsBase64();
  }, [localUri, fileId]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  if (!base64) {
    return null;
  }

  // TODO (Futuro):
  // Quando migrar para Expo Dev Client ou Bare Workflow,
  // substituir o viewer PDF.js + WebView por react-native-pdf
  // para renderização nativa, melhor performance e zoom avançado.

  // HTML que utiliza PDF.js via CDN para renderizar o PDF a partir de Base64.
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>${title}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #525659; overflow-x: hidden; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; }
          #canvas-container { width: 100%; display: flex; flex-direction: column; align-items: center; padding: 10px 0; }
          canvas { box-shadow: 0 4px 8px rgba(0,0,0,0.2); background-color: white; margin-bottom: 20px; max-width: 95%; height: auto !important; }
          #loading-indicator { color: white; padding: 20px; }
        </style>
      </head>
      <body>
        <div id="loading-indicator">Carregando PDF...</div>
        <div id="canvas-container"></div>

        <script>
          const pdfData = atob("${base64}");

          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          const loadingTask = pdfjsLib.getDocument({ data: pdfData });

          loadingTask.promise.then(function(pdf) {
            document.getElementById('loading-indicator').style.display = 'none';
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOG', message: '[Publicacoes.openLocal.pdf.render.ok]' }));

            // Renderiza todas as páginas para permitir scroll vertical
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              renderPage(pdf, pageNum);
            }
          }).catch(err => {
            document.getElementById('loading-indicator').innerHTML = 'Erro ao renderizar PDF: ' + err.message;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: err.message }));
          });

          function renderPage(pdf, num) {
            pdf.getPage(num).then(function(page) {
              const viewport = page.getViewport({scale: 1.5});
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              document.getElementById('canvas-container').appendChild(canvas);

              const renderContext = {
                canvasContext: ctx,
                viewport: viewport
              };
              page.render(renderContext);
            });
          }
        </script>
      </body>
    </html>
  `;

  const handleShare = async () => {
    try {
      logger.info('[Publicacoes.pdf.share.start]', { fileId, localUri });
      await Share.share({
        url: Platform.OS === 'ios' ? localUri : undefined,
        message: Platform.OS === 'android' ? localUri : title,
        title: title,
      });
      logger.info('[Publicacoes.pdf.share.success]');
    } catch (err: any) {
      logger.error('[Publicacoes.pdf.share.error]', err);
    }
  };

  const handleSave = async () => {
    try {
      logger.info('[Publicacoes.pdf.save.start]', { fileId, localUri });

      if (Platform.OS === 'android') {
        const SAF = FileSystemLegacy.StorageAccessFramework;
        const permissions = await SAF.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const base64Content = await FileSystemLegacy.readAsStringAsync(localUri, {
            encoding: FileSystemLegacy.EncodingType.Base64,
          });

          const mimeType = 'application/pdf';
          const newFileUri = await SAF.createFileAsync(permissions.directoryUri, title, mimeType);
          await FileSystemLegacy.writeAsStringAsync(newFileUri, base64Content, {
            encoding: FileSystemLegacy.EncodingType.Base64,
          });

          logger.info('[Publicacoes.pdf.save.success]', { uri: newFileUri });
          Alert.alert('Sucesso', 'Arquivo salvo com sucesso!');
        } else {
          logger.info('[Publicacoes.pdf.save.denied]');
          // Fallback para share sheet
          handleShare();
        }
      } else {
        // No iOS o share sheet já tem a opção de salvar
        handleShare();
      }
    } catch (err: any) {
      logger.error('[Publicacoes.pdf.save.error]', err);
      // Fallback
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
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'LOG') logger.info(data.message);
            if (data.type === 'ERROR') logger.error('[Publicacoes.openLocal.pdf.render.error]', new Error(data.message));
          } catch (e) {}
        }}
        startInLoadingState={true}
        renderLoading={() => <ActivityIndicator size="large" color="#003366" style={styles.loading} />}
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
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
