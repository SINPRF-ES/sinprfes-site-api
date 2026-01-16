// mobile/src/screens/PublicacoesScreen.tsx
import React, 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getPublicacoes, DriveFile } from '../services/driveService';
import { FontAwesome } from '@expo/vector-icons';

const PublicacoesScreen: React.FC = () => {
  const { data: publicacoes, isLoading, error } = useQuery({
    queryKey: ['publicacoes'],
    queryFn: getPublicacoes,
  });

  const handlePress = (file: DriveFile) => {
    const url = file.webViewLink;
    if (typeof url !== 'string' || url.length === 0) {
      Alert.alert('Indisponível', 'Este item não possui um link para visualização.');
      return;
    }

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Erro', `Não foi possível abrir o link: ${url}`);
      }
    });
  };

  const renderIcon = (mimeType: string | null | undefined) => {
    const type = typeof mimeType === 'string' ? mimeType : '';
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
    const safeDate = item.createdTime && !isNaN(new Date(item.createdTime).getTime())
      ? new Date(item.createdTime).toLocaleDateString('pt-BR')
      : 'Data indisponível';

    return (
      <TouchableOpacity style={styles.itemContainer} onPress={() => handlePress(item)}>
        <View style={styles.iconContainer}>
          {renderIcon(item.mimeType)}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.itemName}>{item.name || 'Nome indisponível'}</Text>
          <Text style={styles.itemDate}>{safeDate}</Text>
        </View>
        <FontAwesome name="external-link" size={20} color="#007BFF" />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>Não foi possível carregar as publicações.</Text></View>;
  }

  // Sanitização dos dados para evitar crashes na renderização
  const sanitizedPublicacoes = Array.isArray(publicacoes)
    ? publicacoes.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string')
    : [];

  return (
    <FlatList
      data={sanitizedPublicacoes}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<View style={styles.centered}><Text>Nenhuma publicação encontrada.</Text></View>}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default PublicacoesScreen;
