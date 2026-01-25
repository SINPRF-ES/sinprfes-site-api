// mobile/src/screens/PublicacoesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicacoes, downloadPublicacaoFile, DriveFile } from '../services/driveService';
import { FontAwesome } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { logDebug } from '../utils/filiadoUtils';
import api from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';

const PublicacoesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { token } = useAuth();
  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Publicações' }]);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1];

  const { data: publicacoes, isLoading, error } = useQuery({
    queryKey: ['publicacoes', currentFolder.id],
    queryFn: async () => {
      logDebug('Publicacoes.fetch.start', { folderId: currentFolder.id });
      const data = await fetchPublicacoes(currentFolder.id);

      // Sort alphabetically: Folders first, then files
      const sortedData = [...data].sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      logDebug('Publicacoes.fetch.success', {
        count: sortedData.length,
        items: sortedData.slice(0, 5).map(i => ({
          id: i.id,
          name: i.name,
          isFolder: i.isFolder,
          mimeType: i.mimeType,
          webViewLink: i.webViewLink
        }))
      });
      return sortedData;
    },
  });

  const handlePress = async (file: DriveFile) => {
    const isActuallyFolder = file.isFolder || file.mimeType === 'application/vnd.google-apps.folder';

    logDebug('Publicacoes.click', {
      id: file.id,
      title: file.name,
      isActuallyFolder,
      mimeType: file.mimeType
    });

    if (isActuallyFolder) {
      setFolderStack(prev => [...prev, { id: file.id, name: file.name }]);
      return;
    }

    if (!token) {
      Alert.alert('Acesso Negado', 'Sua sessão expirou. Por favor, faça login novamente.');
      return;
    }

    setIsDownloading(true);
    try {
      logDebug('Publicacoes.openLocal.start', { fileId: file.id, name: file.name, mimeType: file.mimeType });

      const { localUri, mimeType } = await downloadPublicacaoFile(file.id, file.name, token);
      const safeMimeType = mimeType || file.mimeType || '';

      navigation.navigate('FileViewer', {
          localUri,
          title: file.name,
          fileId: file.id,
          type: safeMimeType.includes('pdf') ? 'pdf' : (safeMimeType.startsWith('image/') ? 'image' : 'other'),
          context: 'publicacoes'
      });
    } catch (err: any) {
      logDebug('Publicacoes.openLocal.error', { message: err.message });

      // Fallback para webViewLink se o download falhar e houver link do Drive
      if (file.webViewLink) {
        logDebug('Publicacoes.openLocal.fallback', { url: file.webViewLink });
        Linking.openURL(file.webViewLink).catch(() => {});
      } else {
        Alert.alert('Erro', err.message || 'Não foi possível abrir o arquivo.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGoBack = () => {
    if (folderStack.length > 1) {
      setFolderStack(prev => prev.slice(0, -1));
    }
  };

  const renderIcon = (mimeType: string | null | undefined) => {
    const type = mimeType || '';
    if (type.includes('folder')) {
      return <FontAwesome name="folder" size={24} color="#FFCA28" />;
    }
    if (type.includes('pdf')) {
      return <FontAwesome name="file-pdf-o" size={24} color="#D32F2F" />;
    }
    if (type.includes('image')) {
      return <FontAwesome name="file-image-o" size={24} color="#4CAF50" />;
    }
    return <FontAwesome name="file" size={24} color="#757575" />;
  };

  const renderItem = ({ item }: { item: DriveFile }) => {
    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => handlePress(item)} disabled={isDownloading}>
        <View style={styles.iconContainer}>
          {renderIcon(item.mimeType)}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.itemName}>{item.name}</Text>
        </View>
        <FontAwesome name={item.isFolder ? "chevron-right" : "download"} size={20} color="#007BFF" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.fullScreen}>
      {isDownloading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Baixando arquivo...</Text>
        </View>
      )}
      <View style={styles.header}>
        {folderStack.length > 1 && (
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="#007BFF" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{currentFolder.name}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" /></View>
      ) : error ? (
        <View style={styles.centered}><Text style={styles.errorText}>Não foi possível carregar as publicações.</Text></View>
      ) : (
        <FlatList
          data={publicacoes || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.container}
          ListEmptyComponent={<View style={styles.centered}><Text>Nenhuma publicação encontrada.</Text></View>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  container: {
    padding: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    color: 'red',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
});

export default PublicacoesScreen;
