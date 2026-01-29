import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOC_ITEMS = [
  { id: 'topo-estatuto', label: 'Topo' },
  { id: 'titulo1', label: 'TÍTULO I - Princípios' },
  { id: 'titulo2', label: 'TÍTULO II - Constituição' },
  { id: 'titulo3', label: 'TÍTULO III - Organização' },
  { id: 'titulo4', label: 'TÍTULO IV - Assembleia Geral' },
  { id: 'titulo5', label: 'TÍTULO V - Diretoria Executiva' },
  { id: 'titulo6', label: 'TÍTULO VI - Conselho Fiscal' },
  { id: 'titulo7', label: 'TÍTULO VII - Vacância' },
  { id: 'titulo8', label: 'TÍTULO VIII - Gestão Financeira' },
  { id: 'titulo9', label: 'TÍTULO IX - Sindicalizados' },
  { id: 'titulo10', label: 'TÍTULO X - Disposições Gerais' },
];

export default function EstatutoScreen({ navigation }: any) {
  const webViewRef = useRef<WebView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerTocButton}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Abrir Sumário"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="format-list-bulleted" size={24} color="#fff" />
          <Text style={styles.headerTocButtonText}>Sumário</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    async function loadAsset() {
      try {
        const asset = Asset.fromModule(require('../../assets/html/estatuto.html'));
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri || '';
        const finalUri = uri.startsWith('http') ? (uri.includes('?') ? `${uri}&embed=1` : `${uri}?embed=1`) : uri;
        setHtmlUri(finalUri);
        console.log('[Estatuto] URL carregada:', finalUri);
      } catch (err) {
        console.error('Erro ao carregar asset do estatuto:', err);
      }
    }
    loadAsset();
  }, []);

  const scrollToAnchor = (id: string) => {
    const js = `
      var element = document.getElementById('${id}');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
    setModalVisible(false);
  };

  const injectedCSS = `
    #site-header, #site-footer, .estatuto-nav { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }
    body {
      padding: 10px !important;
      background-color: #fff !important;
      color: #333 !important;
      font-size: 16px !important;
      font-family: sans-serif !important;
    }
    .estatuto-card {
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      padding: 10px !important;
      margin: 0 !important;
    }
    .estatuto-documento { padding-top: 0 !important; }
    .estatuto-documento h2, .estatuto-documento h3 { scroll-margin-top: 20px !important; }
  `;

  return (
    <SafeScreen style={styles.container}>
      {htmlUri ? (
        <WebView
          ref={webViewRef}
          source={{ uri: htmlUri }}
          style={styles.webview}
          injectedJavaScriptBeforeContentLoaded={`
            (function() {
              var style = document.createElement('style');
              style.innerHTML = \`${injectedCSS}\`;
              document.head.appendChild(style);

              // Remoção determinística via JS
              var removeNav = function() {
                var nav = document.querySelector('.estatuto-nav');
                if (nav) nav.remove();
                var titles = document.querySelectorAll('.estatuto-nav-title');
                titles.forEach(function(t) { t.remove(); });
              };
              removeNav();
              document.addEventListener('DOMContentLoaded', removeNav);
              setTimeout(removeNav, 500);
              setTimeout(removeNav, 2000);
              console.log('[Estatuto] Injected CSS/JS executed, embed mode should be active');
            })();
          `}
          originWhitelist={['*']}
          allowFileAccess={true}
        />
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003366" />
          <Text style={{ marginTop: 10 }}>Carregando...</Text>
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sumário</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={28} color="#003366" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.tocList}>
              {TOC_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.tocItem}
                  onPress={() => scrollToAnchor(item.id)}
                >
                  <Text style={styles.tocItemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTocButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4, marginRight: 10 },
  headerTocButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  webview: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#003366' },
  tocList: { padding: 10 },
  tocItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tocItemText: { fontSize: 16, color: '#333' },
});
