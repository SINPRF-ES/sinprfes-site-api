import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { checkUpdates, applyOtaUpdate, UpdateCheckResult } from '../services/updateService';
import { FontAwesome } from '@expo/vector-icons';
import { logDebug } from '../utils/filiadoUtils';

/**
 * Componente responsável por verificar atualizações ao iniciar o app.
 * Exibe um modal caso uma atualização OTA ou um novo APK estejam disponíveis.
 */
const UpdateChecker: React.FC = () => {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const performCheck = async () => {
      try {
        setIsChecking(true);
        const result = await checkUpdates();
        if (result && result.hasUpdate) {
          logDebug('UpdateChecker.updateFound', { type: result.type, mandatory: result.isMandatory });
          setUpdateResult(result);
        }
      } catch (error: any) {
        logDebug('UpdateChecker.error', { message: error.message });
      } finally {
        setIsChecking(false);
      }
    };

    // Pequeno delay para não competir com o splash screen ou carregamento inicial pesado
    const timer = setTimeout(performCheck, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = async () => {
    if (!updateResult) return;

    if (updateResult.type === 'OTA') {
      setIsUpdating(true);
      try {
        logDebug('UpdateChecker.applyingOTA', {});
        await applyOtaUpdate();
        // O app irá reiniciar automaticamente após o reloadAsync no applyOtaUpdate
      } catch (error) {
        logDebug('UpdateChecker.otaFailed', error);
        Alert.alert('Erro', 'Não foi possível aplicar a atualização automática. Tente novamente mais tarde.');
        setIsUpdating(false);
      }
    } else {
      // APK Update
      if (updateResult.apkUrl) {
        logDebug('UpdateChecker.openingApkUrl', { url: updateResult.apkUrl });
        Linking.openURL(updateResult.apkUrl).catch((err) => {
          logDebug('UpdateChecker.openUrlFailed', err);
          Alert.alert('Erro', 'Não foi possível abrir o link de download.');
        });
      } else {
        Alert.alert('Erro', 'Link de download do APK não encontrado no servidor.');
      }
    }
  };

  if (!updateResult) return null;

  const isMandatory = updateResult.isMandatory;
  const notes = updateResult.type === 'OTA' ? updateResult.manifest.ota.notes : updateResult.manifest.apk.notes;

  return (
    <Modal
      transparent
      visible={!!updateResult}
      animationType="fade"
      onRequestClose={() => !isMandatory && setUpdateResult(null)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <FontAwesome name="arrow-circle-up" size={48} color="#003366" />
            <Text style={styles.title}>Atualização Disponível</Text>
            <Text style={styles.version}>Nova versão: {updateResult.manifest.versionName}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.notesTitle}>O que há de novo:</Text>
            <Text style={styles.notes}>{notes || 'Melhorias de desempenho e correções de bugs.'}</Text>

            {isMandatory && (
              <View style={styles.mandatoryBadge}>
                <FontAwesome name="exclamation-triangle" size={14} color="#d32f2f" style={{ marginRight: 6 }} />
                <Text style={styles.mandatoryText}>Esta atualização é obrigatória</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {isUpdating ? (
              <View style={styles.updatingContainer}>
                <ActivityIndicator size="large" color="#003366" />
                <Text style={styles.updatingText}>Preparando atualização...</Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                {!isMandatory && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setUpdateResult(null)}
                  >
                    <Text style={styles.cancelButtonText}>Depois</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.updateButton, isMandatory && styles.fullWidth]}
                  onPress={handleUpdate}
                >
                  <Text style={styles.updateButtonText}>
                    {updateResult.type === 'OTA' ? 'Atualizar Agora' : 'Baixar e Instalar'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f0f4f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#003366',
    marginTop: 12,
    textAlign: 'center',
  },
  version: {
    fontSize: 14,
    color: '#546e7a',
    marginTop: 6,
  },
  body: {
    padding: 24,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#263238',
    marginBottom: 10,
  },
  notes: {
    fontSize: 15,
    color: '#455a64',
    lineHeight: 22,
  },
  mandatoryBadge: {
    marginTop: 20,
    backgroundColor: '#ffebee',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  mandatoryText: {
    color: '#d32f2f',
    fontWeight: '700',
    fontSize: 13,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  updateButton: {
    flex: 2,
    backgroundColor: '#003366',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#78909c',
    fontWeight: '600',
    fontSize: 16,
  },
  fullWidth: {
    flex: 1,
  },
  updatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  updatingText: {
    marginTop: 12,
    color: '#003366',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default UpdateChecker;
