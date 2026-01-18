import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export default function PdfViewerScreen({ route }: any) {
  const { localUri, title } = route.params;

  // HTML que utiliza PDF.js via CDN para renderizar o PDF local.
  // Precisamos converter a localUri em algo que o WebView consiga acessar.
  // Em alguns casos o WebView acessa file:// diretamente se as permissões estiverem ok.
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <title>${title}</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #525659; overflow-x: hidden; font-family: sans-serif; }
          #canvas-container { display: flex; flex-direction: column; align-items: center; padding: 10px; }
          canvas { box-shadow: 0 4px 8px rgba(0,0,0,0.2); background-color: white; margin-bottom: 10px; max-width: 100%; height: auto !important; }
          #controls {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.7); padding: 10px 20px; border-radius: 25px;
            display: flex; gap: 20px; color: white; align-items: center; z-index: 100;
          }
          button { background: transparent; border: 1px solid white; color: white; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div id="canvas-container"></div>
        <div id="controls">
          <button onclick="prevPage()">Anterior</button>
          <span id="page-info">Pág <span id="page-num"></span> / <span id="page-count"></span></span>
          <button onclick="nextPage()">Próxima</button>
        </div>

        <script>
          const url = '${localUri}';
          let pdfDoc = null,
              pageNum = 1,
              pageRendering = false,
              pageNumPending = null;

          const container = document.getElementById('canvas-container');

          function renderPage(num) {
            pageRendering = true;
            pdfDoc.getPage(num).then(function(page) {
              const viewport = page.getViewport({scale: 1.5});
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              // Limpa o container e adiciona o canvas
              container.innerHTML = '';
              container.appendChild(canvas);

              const renderContext = {
                canvasContext: ctx,
                viewport: viewport
              };
              const renderTask = page.render(renderContext);

              renderTask.promise.then(function() {
                pageRendering = false;
                if (pageNumPending !== null) {
                  renderPage(pageNumPending);
                  pageNumPending = null;
                }
              });
            });
            document.getElementById('page-num').textContent = num;
          }

          function queueRenderPage(num) {
            if (pageRendering) pageNumPending = num;
            else renderPage(num);
          }

          function prevPage() {
            if (pageNum <= 1) return;
            pageNum--;
            queueRenderPage(pageNum);
          }

          function nextPage() {
            if (pageNum >= pdfDoc.numPages) return;
            pageNum++;
            queueRenderPage(pageNum);
          }

          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          pdfjsLib.getDocument(url).promise.then(function(pdfDoc_) {
            pdfDoc = pdfDoc_;
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            renderPage(pageNum);
          }).catch(err => {
            document.body.innerHTML = '<div style="color:white; padding:20px;">Erro ao carregar PDF: ' + err.message + '</div>';
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
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
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
