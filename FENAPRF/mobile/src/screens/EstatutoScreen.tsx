import React, { useRef, useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TOC_ITEMS = [
  { id: 'topo-estatuto', label: '🏠 Início' },
  { id: 'preambulo', label: 'Preâmbulo' },
  { id: 'capitulo-1', label: 'Capítulo I — Constituição e Finalidade' },
  { id: 'capitulo-2', label: 'Capítulo II — Organização do Sistema' },
  { id: 'capitulo-3', label: 'Capítulo III — Objetivos e Prerrogativas' },
  { id: 'capitulo-4', label: 'Capítulo IV — Competências' },
  { id: 'capitulo-5', label: 'Capítulo V — Contribuições' },
  { id: 'capitulo-6', label: 'Capítulo VI — Sindicatos Regionais' },
  { id: 'capitulo-7', label: 'Capítulo VII — Requisitos para Filiação' },
  { id: 'capitulo-8', label: 'Capítulo VIII — Requisitos para Desfiliação' },
  { id: 'capitulo-9', label: 'Capítulo IX — Direitos Sindicais' },
  { id: 'capitulo-10', label: 'Capítulo X — Deveres Sindicais' },
  { id: 'capitulo-11', label: 'Capítulo XI — Sanções' },
  { id: 'capitulo-12', label: 'Capítulo XII — Organização Federativa' },
  { id: 'capitulo-13', label: 'Capítulo XIII — Conselho de Representantes' },
  { id: 'capitulo-14', label: 'Capítulo XIV — Diretoria Executiva' },
  { id: 'capitulo-15', label: 'Capítulo XV — Conselho Fiscal' },
  { id: 'capitulo-16', label: 'Capítulo XVI — Conselho de Ética' },
  { id: 'capitulo-17', label: 'Capítulo XVII — Administração Patrimonial' },
  { id: 'capitulo-18', label: 'Capítulo XVIII — Processo Eleitoral' },
  { id: 'capitulo-19', label: 'Capítulo XIX — Vacância e Impedimentos' },
  { id: 'capitulo-20', label: 'Capítulo XX — Disposições Gerais' },
  { id: 'assinaturas', label: 'Assinaturas' },
];

export default function EstatutoScreen({ navigation }: any) {
  const webViewRef = useRef<WebView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
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

        const runtimeVersion = Updates.runtimeVersion || 'native';
        const updateId = Updates.updateId || 'none';
        const cb = `${runtimeVersion}-${updateId}`;

        const finalUri = uri.includes('?')
          ? `${uri}&embed=1&cb=${cb}`
          : `${uri}?embed=1&cb=${cb}`;

        setHtmlUri(finalUri);
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
    setSearchText('');
  };

  const filteredItems = useMemo(() => {
    if (!searchText) return TOC_ITEMS;
    return TOC_ITEMS.filter(item =>
      item.label.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [searchText]);

  const injectedCSS = `
    body { padding-top: 10px !important; }
    .wrap { padding-top: 10px !important; }
  `;

  return (
    <SafeScreen style={styles.container}>
      {htmlUri ? (
        <WebView
          ref={webViewRef}
          source={{ uri: htmlUri }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          injectedJavaScriptBeforeContentLoaded={
            "(function() {" +
              "var cssText = " + JSON.stringify(injectedCSS) + ";" +
              "var style = document.createElement('style');" +
              "style.appendChild(document.createTextNode(cssText));" +
              "document.documentElement.appendChild(style);" +
            "})();"
          }
          originWhitelist={['*']}
          allowFileAccess={true}
        />
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#003366" accessibilityLabel="Carregando estatuto..." />
          <Text style={styles.loadingText}>Carregando Estatuto...</Text>
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sumário</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Fechar Sumário"
                accessibilityRole="button"
              >
                <MaterialCommunityIcons name="close" size={28} color="#003366" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar no sumário..."
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
                clearButtonMode="while-editing"
                accessibilityLabel="Campo de busca no sumário"
              />
            </View>

            <ScrollView style={styles.tocList} keyboardShouldPersistTaps="handled">
              {filteredItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.tocItem}
                  onPress={() => scrollToAnchor(item.id)}
                  accessibilityRole="link"
                  accessibilityLabel={`Ir para ${item.label}`}
                >
                  <Text style={styles.tocItemText}>{item.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}
              {filteredItems.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhum item encontrado.</Text>
                </View>
              )}
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
  loadingText: { marginTop: 12, color: '#003366', fontWeight: '500' },
  headerTocButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4, marginRight: 10 },
  headerTocButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  webview: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#003366' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', margin: 15, paddingHorizontal: 10, borderRadius: 10, height: 45 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#333' },
  tocList: { paddingHorizontal: 10 },
  tocItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tocItemText: { fontSize: 16, color: '#333', flex: 1 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 16 },
});
