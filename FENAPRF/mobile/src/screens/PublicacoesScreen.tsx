// mobile/src/screens/PublicacoesScreen.tsx
import React, { useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import {
  fetchPublicacoes,
  downloadPublicacaoFile,
  DriveFile,
  createFolder,
  uploadDriveFile,
  renameItem,
  moveItem,
  deleteItem
} from '../services/driveService';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { logDebug } from '../utils/user';
import { logger } from '../infra/logger';
import api from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { EMOJIS } from '../utils/emoji';

const PublicacoesScreen: React.FC = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { mode, onSelectFile, returnTo } = route.params || {};
  const isPicker = mode === 'picker';

  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const isGestao = ['ADMIN', 'COLABORADOR', 'DIRETORIA'].includes((user?.perfil_acesso || '').toUpperCase());

  const [folderStack, setFolderStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Publicações' }]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DriveFile | null>(null);

  // Estados para Modais
  const [isNewFolderModalVisible, setIsNewFolderModalVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const currentFolder = folderStack[folderStack.length - 1];

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `${EMOJIS.PUBLICACOES} ${currentFolder.name}`,
      headerRight: () => (
        isGestao && !isPicker ? (
          <TouchableOpacity
            onPress={handleOpenOptions}
            style={{ marginRight: 15 }}
            accessibilityRole="button"
            accessibilityLabel="Opções da pasta"
          >
            <FontAwesome name="ellipsis-v" size={24} color="#003366" />
          </TouchableOpacity>
        ) : null
      )
    });
  }, [navigation, currentFolder.name, isGestao, isPicker]);

  const handleOpenOptions = () => {
    const isRoot = currentFolder.id === null;
    const nameLower = (currentFolder.name || '').toLowerCase();
    // FENAPRF: Ajustado para refletir a regra do site (noticias não é protegida)
    const isProtected = isRoot || ['app', 'lixeira'].includes(nameLower);

    Alert.alert(
      'Opções da Pasta',
      `O que deseja fazer em "${currentFolder.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Nova Pasta', onPress: () => handleOpenNewFolder() },
        { text: 'Enviar Arquivo', onPress: () => handleUpload() },
        ...(!isProtected ? [{
          text: 'Excluir esta Pasta',
          onPress: () => handleConfirmDelete({ id: currentFolder.id, name: currentFolder.name } as DriveFile),
          style: 'destructive'
        }] : [])
      ]
    );
  };

  const { data: publicacoes, isLoading, error } = useQuery({
    queryKey: ['publicacoes', currentFolder.id],
    queryFn: async () => {
      logDebug('Publicacoes.fetch.start', { folderId: currentFolder.id });
      let data = await fetchPublicacoes(currentFolder.id);

      // 🛑 Ocultar itens marcados como hidden pelo backend ou pastas técnicas na raiz
      data = data.filter(item => {
        if (item.hidden) return false;
        if (currentFolder.id === null) {
          const name = (item.name || '').toLowerCase();
          return name !== 'app' && name !== 'noticias' && name !== 'lixeira';
        }
        return true;
      });

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

    if (isPicker) {
        if (!file.mimeType?.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
            Alert.alert('Aviso', 'Por favor, selecione apenas arquivos PDF.');
            return;
        }
        if (onSelectFile) onSelectFile(file);

        if (returnTo) {
            navigation.navigate(returnTo, { selectedFile: file });
        } else {
            navigation.goBack();
        }
        return;
    }

    if (!token) {
      Alert.alert('Acesso Negado', 'Sua sessão expirou. Por favor, faça login novamente.');
      return;
    }

    setIsDownloading(true);
    try {
      logDebug('Publicacoes.openLocal.start', { fileId: file.id, name: file.name, mimeType: file.mimeType });

      const { localUri, mimeType: downloadedMimeType } = await downloadPublicacaoFile(
        file.id,
        file.name,
        token,
        file.mimeType || undefined
      );
      const safeMimeType = downloadedMimeType || file.mimeType || '';

      navigation.navigate('FileViewer', {
          localUri,
          title: file.name,
          fileId: file.id,
          type: safeMimeType.includes('pdf') ? 'pdf' : (safeMimeType.startsWith('image/') ? 'image' : 'other'),
          context: 'publicacoes'
      });
    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Publicacoes.openLocal.fail', error, {
        fileId: file.id,
        fileName: file.name,
        message: error.message
      });

      Alert.alert('Erro ao Abrir Arquivo', 'Não foi possível baixar o documento para visualização interna. Verifique sua conexão.');
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
    const isActuallyFolder = item.isFolder || item.mimeType === 'application/vnd.google-apps.folder';
    const a11yLabel = `${isActuallyFolder ? 'Pasta' : 'Arquivo'}: ${item.name}. ${item.isFolder ? 'Toque para abrir.' : 'Toque para visualizar.'}`;

    return (
      <View style={styles.itemWrapper}>
        <TouchableOpacity
          style={styles.itemContainer}
          onPress={() => handlePress(item)}
          disabled={isDownloading}
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ disabled: isDownloading }}
        >
          <View style={styles.iconContainer}>
            {renderIcon(item.mimeType)}
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.itemName}>{item.name}</Text>
          </View>
          <FontAwesome
            name={item.isFolder ? "chevron-right" : (isPicker ? "check-circle" : "download")}
            size={20}
            color={isPicker && !item.isFolder ? "#27ae60" : "#007BFF"}
          />
        </TouchableOpacity>

        {isGestao && !isPicker && (
          <TouchableOpacity
            style={styles.menuButton}
            accessibilityRole="button"
            accessibilityLabel={`Opções para ${item.name}`}
            onPress={() => {
              setSelectedItem(item);
              const nameLower = (item.name || '').toLowerCase();
              // FENAPRF: Garantir consistência na verificação de itens protegidos
              const isProtected = !!item.hidden || (currentFolder.id === null && ['app', 'lixeira'].includes(nameLower));

              Alert.alert(
                'Ações',
                `O que deseja fazer com "${item.name}"?`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  ...(isProtected ? [] : [{ text: 'Renomear', onPress: () => handleOpenRename(item) }]),
                  ...(isProtected ? [] : [{ text: 'Mover', onPress: () => handleOpenMove(item) }]),
                  ...(isProtected ? [] : [{ text: 'Excluir (Lixeira)', onPress: () => handleConfirmDelete(item), style: 'destructive' }]),
                ],
                { cancelable: true }
              );
            }}
          >
            <MaterialCommunityIcons name="dots-vertical" size={26} color="#003366" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleOpenRename = (item: DriveFile) => {
    setSelectedItem(item);
    setNewItemName(item.name);
    setIsRenameModalVisible(true);
  };

  const handleRename = async () => {
    if (!selectedItem || !newItemName.trim()) return;
    setIsProcessing(true);
    try {
      await renameItem(selectedItem.id, newItemName.trim());
      setIsRenameModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['publicacoes', currentFolder.id] });
      Alert.alert('Sucesso', 'Item renomeado.');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível renomear.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenMove = (item: DriveFile) => {
    setSelectedItem(item);
    setIsMoveModalVisible(true);
  };

  const handleMoveTo = async (targetFolderId: string) => {
    if (!selectedItem) return;
    setIsProcessing(true);
    try {
      await moveItem(selectedItem.id, targetFolderId);
      setIsMoveModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['publicacoes', currentFolder.id] });
      Alert.alert('Sucesso', 'Item movido.');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível mover o item.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = (item: DriveFile) => {
    Alert.alert(
      'Excluir Item',
      `Deseja mover "${item.name}" para a lixeira? Recuperação apenas no Google Drive web.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Mover para Lixeira', style: 'destructive', onPress: () => handleDelete(item) }
      ]
    );
  };

  const handleOpenNewFolder = () => {
    setNewItemName('');
    setIsNewFolderModalVisible(true);
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;

    // Guard clause: evitar envio de null para o backend
    const parentId = currentFolder?.id || 'ROOT';
    if (!parentId) {
       Alert.alert('Erro', 'Destino não identificado. Tente navegar novamente.');
       return;
    }

    setIsProcessing(true);
    try {
      await createFolder(newItemName.trim(), parentId);
      setIsNewFolderModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['publicacoes', currentFolder.id] });
      Alert.alert('Sucesso', 'Pasta criada com sucesso.');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível criar a pasta. Verifique se você tem permissão nesta pasta.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      // Guard clause: evitar envio de null para o backend
      const parentId = currentFolder?.id || 'ROOT';
      if (!parentId) {
         Alert.alert('Erro', 'Destino não identificado para o upload.');
         return;
      }

      setIsProcessing(true);
      await uploadDriveFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream', parentId);

      queryClient.invalidateQueries({ queryKey: ['publicacoes', currentFolder.id] });
      Alert.alert('Sucesso', 'Arquivo enviado com sucesso.');
    } catch (err) {
      Alert.alert('Erro', 'Falha no upload do arquivo. O arquivo pode ser muito grande ou de tipo não suportado.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (item: DriveFile) => {
      setIsProcessing(true);
      try {
        logDebug('Publicacoes.delete.start', { id: item.id, name: item.name });
        await deleteItem(item.id);

        // Se deletou a pasta que estava aberta, volta um nível
        const isDeletingCurrentFolder = item.id === currentFolder.id;

        if (isDeletingCurrentFolder) {
            handleGoBack();
        }

        // Invalida a query da pasta atual
        queryClient.invalidateQueries({ queryKey: ['publicacoes', currentFolder.id] });

        // Se deletou a pasta atual, precisamos invalidar também o pai para quando voltar a lista estar atualizada
        if (isDeletingCurrentFolder && folderStack.length > 1) {
            const parentId = folderStack[folderStack.length - 2].id;
            queryClient.invalidateQueries({ queryKey: ['publicacoes', parentId] });
        }

        Alert.alert('Sucesso', `"${item.name}" foi movido para a lixeira.`);
      } catch (err) {
        logger.error('Publicacoes.delete.fail', err as Error);
        Alert.alert('Erro', 'Não foi possível excluir o item.');
      } finally {
        setIsProcessing(false);
      }
  };

  return (
    <View style={styles.fullScreen}>
      {(isDownloading || isProcessing) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>{isDownloading ? 'Baixando arquivo...' : 'Processando...'}</Text>
        </View>
      )}

      {folderStack.length > 1 && (
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backFolderButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar para a pasta anterior"
        >
          <FontAwesome name="arrow-left" size={16} color="#003366" />
          <Text style={styles.backFolderText}>Voltar para anterior</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" /></View>
      ) : error ? (
        <View style={styles.centered}><Text style={styles.errorText}>Não foi possível carregar as publicações.</Text></View>
      ) : (
        <FlatList
          data={publicacoes || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.container,
            { paddingBottom: Math.max(insets.bottom + 20, 80) }
          ]}
          ListEmptyComponent={<View style={styles.centered}><Text>Nenhuma publicação encontrada.</Text></View>}
        />
      )}

      {/* Modal Nova Pasta */}
      <Modal visible={isNewFolderModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nova Pasta</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome da pasta"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setIsNewFolderModalVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateFolder} style={styles.confirmButton}>
                <Text style={styles.confirmButtonText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Renomear */}
      <Modal visible={isRenameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Renomear</Text>
            <TextInput
              style={styles.input}
              placeholder="Novo nome"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setIsRenameModalVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRename} style={styles.confirmButton}>
                <Text style={styles.confirmButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Mover */}
      <Modal visible={isMoveModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <FolderSelector
              movingItemId={selectedItem?.id}
              onSelect={(targetId) => handleMoveTo(targetId)}
              onCancel={() => setIsMoveModalVisible(false)}
            />
          </View>
        </View>
      </Modal>

      {isGestao && !isPicker && (
        <TouchableOpacity
          style={[
            styles.fab,
            { bottom: Math.max(insets.bottom, 20) }
          ]}
          onPress={() => {
            Alert.alert(
              'Nova Publicação',
              'Escolha uma ação:',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Nova Pasta', onPress: () => handleOpenNewFolder() },
                { text: 'Enviar Arquivo', onPress: () => handleUpload() }
              ]
            );
          }}
          accessibilityRole="button"
          accessibilityLabel="Nova Publicação: Adicionar pasta ou enviar arquivo"
        >
          <FontAwesome name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const FolderSelector = ({ movingItemId, onSelect, onCancel }: { movingItemId?: string, onSelect: (id: string) => void, onCancel: () => void }) => {
  const [currentPath, setCurrentPath] = useState<{ id: string | null, name: string }[]>([{ id: null, name: 'Páginas/Raiz' }]);
  const activeFolder = currentPath[currentPath.length - 1];

  const { data: folders, isLoading } = useQuery({
    queryKey: ['folders', activeFolder.id],
    queryFn: async () => {
      const data = await fetchPublicacoes(activeFolder.id);
      return data.filter(item => item.isFolder && !item.hidden && item.id !== movingItemId);
    }
  });

  return (
    <View style={styles.selectorContainer}>
      <Text style={styles.modalTitle}>Mover para...</Text>
      <Text style={styles.selectorPath}>Local selecionado: {activeFolder.name}</Text>

      <View style={styles.selectorListContainer}>
        {currentPath.length > 1 && (
          <TouchableOpacity onPress={() => setCurrentPath(p => p.slice(0, -1))} style={styles.selectorBack}>
            <FontAwesome name="arrow-left" size={14} color="#003366" />
            <Text style={styles.selectorBackText}>Voltar nível</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <ActivityIndicator style={{ marginVertical: 20 }} />
        ) : (
          <FlatList
            data={folders || []}
            keyExtractor={item => item.id}
            style={styles.selectorList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.selectorItem}
                onPress={() => setCurrentPath(p => [...p, { id: item.id, name: item.name }])}
              >
                <FontAwesome name="folder" size={20} color="#FFCA28" />
                <Text style={styles.selectorItemText}>{item.name}</Text>
                <FontAwesome name="chevron-right" size={12} color="#ccc" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma subpasta aqui.</Text>}
          />
        )}
      </View>

      <View style={styles.modalButtons}>
        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onSelect(activeFolder.id || 'ROOT')}
          disabled={activeFolder.id === movingItemId}
          style={[styles.confirmButton, activeFolder.id === movingItemId && { opacity: 0.5 }]}
        >
          <Text style={styles.confirmButtonText}>Mover para aqui</Text>
        </TouchableOpacity>
      </View>
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
  backFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#eef2f7',
    gap: 8,
  },
  backFolderText: {
    color: '#003366',
    fontWeight: '600',
    fontSize: 14,
  },
  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  itemContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  menuButton: {
    padding: 10,
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#003366',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    padding: 10,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#003366',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorContainer: {
    maxHeight: 400,
  },
  selectorPath: {
    fontSize: 14,
    color: '#003366',
    backgroundColor: '#eef2f7',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
    fontWeight: '600',
  },
  selectorListContainer: {
    height: 250,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 15,
  },
  selectorList: {
    flex: 1,
  },
  selectorBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  selectorBackText: {
    color: '#003366',
    fontWeight: 'bold',
  },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectorItemText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
    fontSize: 13,
  },
});

export default PublicacoesScreen;
