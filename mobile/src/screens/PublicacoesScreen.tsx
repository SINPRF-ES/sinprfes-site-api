// mobile/src/screens/PublicacoesScreen.tsx
import React, 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { useQuery } from 'react-query';
import { getPublicacoes, DriveFile } from '../services/driveService';
import { FontAwesome } from '@expo/vector-icons';

const PublicacoesScreen: React.FC = () => {
  const { data: publicacoes, isLoading, error } = useQuery('publicacoes', getPublicacoes);

  const handlePress = (file: DriveFile) => {
    // Para PDFs e outros arquivos, usamos webViewLink que abre no navegador do app/dispositivo
    // Para pastas, também, para que o usuário possa navegar
    const url = file.webViewLink;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Erro', `Não foi possível abrir o link: ${url}`);
      }
    });
  };

  const renderIcon = (mimeType: string) => {
    if (mimeType.includes('folder')) {
      return <FontAwesome name="folder" size={24} color="#FFCA28" />; // Amarelo para pastas
    }
    if (mimeType.includes('pdf')) {
      return <FontAwesome name="file-pdf-o" size={24} color="#D32F2F" />; // Vermelho para PDFs
    }
    if (mimeType.includes('image')) {
      return <FontAwesome name="file-image-o" size={24} color="#4CAF50" />; // Verde para imagens
    }
    return <FontAwesome name="file" size={24} color="#757575" />; // Padrão
  };

  const renderItem = ({ item }: { item: DriveFile }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => handlePress(item)}>
      <View style={styles.iconContainer}>
        {renderIcon(item.mimeType)}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDate}>
          {new Date(item.createdTime).toLocaleDateString('pt-BR')}
        </Text>
      </View>
      <FontAwesome name="external-link" size={20} color="#007BFF" />
    </TouchableOpacity>
  );

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>Não foi possível carregar as publicações.</Text></View>;
  }

  return (
    <FlatList
      data={publicacoes}
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
