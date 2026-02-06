import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, BackHandler, Animated, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { applyOtaUpdate, downloadAndInstallApk, UpdateCheckResult } from '../services/updateService';
import { updateAutoScheduler } from '../services/updateAutoScheduler';
import { FontAwesome } from '@expo/vector-icons';
import { logDebug } from '../utils/filiadoUtils';
import { useAuth } from '../hooks/useAuth';

/**
 * Componente global que escuta o agendador de atualizações e exibe o Modal/Banner.
 */
const UpdateAutoChecker: React.FC = () => {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { autenticado, token, bloqueadoPorBiometria } = useAuth();

  useEffect(() => {
    if (!autenticado || !token || bloqueadoPorBiometria) {
        setShowModal(false);
        return;
    }

    const unsubscribe = updateAutoScheduler.subscribe(async (result) => {
        if (result?.hasUpdate) {
            setUpdateResult(result);

            // Prioridade para Modal em atualizações obrigatórias ou quando o resultado chega pela primeira vez no app aberto
            if (result.isMandatory) {
                setShowModal(true);
                await AsyncStorage.removeItem('@sinprf/ota_update_available');
            } else {
                // Para opcionais, salva para o banner na Home
                await AsyncStorage.setItem('@sinprf/ota_update_available', JSON.stringify(result));
                DeviceEventEmitter.emit('ota_update_detected', result);
            }
        } else {
            setUpdateResult(null);
            setShowModal(false);
            await AsyncStorage.removeItem('@sinprf/ota_update_available');
            DeviceEventEmitter.emit('ota_update_detected', null);
        }
    });

    return () => unsubscribe();
  }, [autenticado, token, bloqueadoPorBiometria]);

  // Bloquear botão voltar se for obrigatório
  useEffect(() => {
    if (updateResult?.isMandatory && showModal) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [updateResult]);

  const handleUpdate = async () => {
    if (!updateResult) return;

    logDebug('Update.Modal.CTA.Click', { type: updateResult.type, isMandatory: updateResult.isMandatory });

    if (updateResult.type === 'OTA') {
      setIsUpdating(true);
      try {
        logDebug('Update.Ota.Download.Start', {});
        await applyOtaUpdate();
        logDebug('Update.Ota.Download.Success', {});
      } catch (error: any) {
        logDebug('Update.Ota.Download.Error', { message: error.message });
        Alert.alert('Erro', 'Não foi possível aplicar a atualização OTA. Tente novamente pela tela de Atualizações.');
        setIsUpdating(false);
      }
    } else {
      // APK Update
      if (updateResult.apkFileId && updateResult.apkFileName) {
        setIsUpdating(true);
        try {
          logDebug('Update.Apk.Download.Start', { fileId: updateResult.apkFileId, fileName: updateResult.apkFileName });
          await downloadAndInstallApk(updateResult.apkFileId, updateResult.apkFileName);
          logDebug('Update.Apk.Download.Success', {});

          // Se não for obrigatório, podemos fechar o modal após disparar o instalador
          if (!updateResult.isMandatory) {
            setShowModal(false);
            setUpdateResult(null);
          }
        } catch (error: any) {
          logDebug('Update.Apk.Download.Error', { message: error.message });
          Alert.alert('Erro no Download', 'Falha ao baixar o APK: ' + error.message);
        } finally {
          setIsUpdating(false);
        }
      } else {
        logDebug('Update.Apk.Error', { reason: 'Missing file info' });
        Alert.alert('Erro', 'Dados do APK não encontrados. Tente pela tela de Atualizações.');
        if (!updateResult.isMandatory) {
          setShowModal(false);
          setUpdateResult(null);
        }
      }
    }
  };

  if (!updateResult) return null;

  const isMandatory = updateResult.isMandatory;
  const manifest = updateResult.manifest;
  const notes = updateResult.type === 'OTA' ? manifest?.ota?.notes : manifest?.apk?.notes;
  const isOTAIncompatible = updateResult.type === 'APK' && updateResult.manifest?.runtimeVersion !== Updates.runtimeVersion;

  return (
    <>
    {/* Modal para Updates (Obrigatórios ou Login Check) */}
    <Modal
      transparent
      visible={showModal}
      animationType="fade"
      onRequestClose={() => {
        if (!isMandatory) {
            setShowModal(false);
            setUpdateResult(null);
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <FontAwesome
                name={updateResult.type === 'OTA' ? "cloud-download" : "arrow-circle-up"}
                size={48}
                color="#003366"
            />
            <Text style={styles.title}>Atualização Disponível</Text>
            {manifest && (
                <Text style={styles.version}>Versão: {manifest.versionName} (Build {manifest.versionCode})</Text>
            )}
          </View>

          <View style={styles.body}>
            <Text style={styles.notesTitle}>O que há de novo:</Text>
            <Text style={styles.notes}>{notes || 'Melhorias de desempenho e correções de bugs.'}</Text>

            {isMandatory && (
              <View style={styles.mandatoryBadge}>
                <FontAwesome name="exclamation-triangle" size={14} color="#d32f2f" style={{ marginRight: 6 }} />
                <Text style={styles.mandatoryText}>Esta atualização é obrigatória para continuar usando o app.</Text>
              </View>
            )}

            {isOTAIncompatible && (
                <View style={[styles.mandatoryBadge, { backgroundColor: '#e3f2fd', borderColor: '#bbdefb', marginTop: 10 }]}>
                    <FontAwesome name="info-circle" size={14} color="#003366" style={{ marginRight: 6 }} />
                    <Text style={[styles.mandatoryText, { color: '#003366' }]}>
                        Migração de sistema necessária. Instale o novo APK para continuar.
                    </Text>
                </View>
            )}
          </View>

          <View style={styles.footer}>
            {isUpdating ? (
              <View style={styles.updatingContainer}>
                <ActivityIndicator size="large" color="#003366" />
                <Text style={styles.updatingText}>Baixando e aplicando atualização...</Text>
              </View>
            ) : (
              <View style={styles.buttonRow}>
                {!isMandatory && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                        setShowModal(false);
                        setUpdateResult(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Depois</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.updateButton, isMandatory && styles.fullWidth]}
                  onPress={handleUpdate}
                >
                  <Text style={styles.updateButtonText}>
                    {updateResult.type === 'OTA' ? 'Baixar e Aplicar' : 'Baixar Agora'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
    </>
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
    textAlign: 'center',
    flex: 1,
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

export default UpdateAutoChecker;
