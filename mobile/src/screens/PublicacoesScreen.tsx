// mobile/src/screens/PublicacoesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicacoes, downloadPublicacao, DriveFile } from '../services/driveService';
import { FontAwesome } from '@expo/vector-icons';

const PublicacoesScreen: React.FC = () => {
  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Publicações' }]);
  const [isDownloading, setIsDownloading] = useState(false);

  const currentFolder = folderStack[folderStack.length - 1];

  const { data: publicacoes, isLoading, error } = useQuery({
    queryKey: ['publicacoes', currentFolder.id],
    queryFn: () => fetchPublicacoes(currentFolder.id),
  });

  const handlePress = async (file: DriveFile) => {
    if (file.isFolder) {
      setFolderStack(prev => [...prev, { id: file.id, name: file.name }]);
    } else {
      setIsDownloading(true);
      await downloadPublicacao(file);
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
    const safeDate = item.createdTime ? new Date(item.createdTime).toLocaleDateString('pt-BR') : 'Data indisponível';

    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => handlePress(item)} disabled={isDownloading}>
        <View style={styles.iconContainer}>
          {renderIcon(item.mimeType)}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemDate}>{safeDate}</Text>
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
