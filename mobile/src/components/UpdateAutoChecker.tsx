import React, { useEffect, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, BackHandler } from 'react-native';
import { checkUpdates, applyOtaUpdate, UpdateCheckResult } from '../services/updateService';
import { carregarUltimoCheckUpdate, salvarUltimoCheckUpdate } from '../services/storageService';
import { FontAwesome } from '@expo/vector-icons';
import { logDebug } from '../utils/filiadoUtils';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 horas

/**
 * Componente global que verifica atualizações automaticamente respeitando throttling.
 */
const UpdateAutoChecker: React.FC = () => {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { autenticado, token, bloqueadoPorBiometria } = useAuth();
  const navigation = useNavigation<any>();

  useEffect(() => {
    // Só roda se houver sessão válida e não estiver bloqueado por biometria
    if (!autenticado || !token || bloqueadoPorBiometria) return;

    const performAutoCheck = async () => {
      try {
        const lastCheck = await carregarUltimoCheckUpdate();
        const now = Date.now();

        if (now - lastCheck < CHECK_INTERVAL) {
          logDebug('AutoCheck.skipThrottle', {
            lastCheck: new Date(lastCheck).toISOString(),
            nextCheck: new Date(lastCheck + CHECK_INTERVAL).toISOString()
          });
          return;
        }

        logDebug('AutoCheck.start', {});
        const result = await checkUpdates();

        if (result) {
            logDebug('AutoCheck.result', {
                hasUpdate: result.hasUpdate,
                type: result.type,
                error: result.error
            });

            if (result.hasUpdate) {
                setUpdateResult(result);
                logDebug('AutoCheck.modalShown', {
                    type: result.type,
                    mandatory: result.isMandatory
                });
            }
        }

        // Registra o check independente de ter update ou não (para respeitar o throttle)
        await salvarUltimoCheckUpdate();
      } catch (error: any) {
        logDebug('AutoCheck.error', { message: error.message });
      }
    };

    const timer = setTimeout(performAutoCheck, 3000);
    return () => clearTimeout(timer);
  }, [autenticado, token, bloqueadoPorBiometria]);

  // Bloquear botão voltar se for obrigatório
  useEffect(() => {
    if (updateResult?.isMandatory) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }
  }, [updateResult]);

  const handleUpdate = async () => {
    if (!updateResult) return;

    if (updateResult.type === 'OTA') {
      setIsUpdating(true);
      try {
        logDebug('AutoCheck.applyingOTA', {});
        await applyOtaUpdate();
      } catch (error: any) {
        logDebug('AutoCheck.otaFailed', { message: error.message });
        Alert.alert('Erro', 'Não foi possível aplicar a atualização. Tente novamente pela tela de Configurações.');
        setIsUpdating(false);
      }
    } else {
      // APK Update
      logDebug('AutoCheck.handlingAPK', { url: updateResult.apkUrl, mandatory: updateResult.isMandatory });

      if (updateResult.apkUrl) {
          Linking.openURL(updateResult.apkUrl);
      }

      // Se não for obrigatório, podemos fechar o modal e opcionalmente levar o usuário para a tela de atualizações
      if (!updateResult.isMandatory) {
          setUpdateResult(null);
          try {
            navigation.navigate('Drawer', { screen: 'Atualizacoes' });
          } catch (e) {}
      }
    }
  };

  if (!updateResult) return null;

  const isMandatory = updateResult.isMandatory;
  const manifest = updateResult.manifest;
  const notes = updateResult.type === 'OTA' ? manifest?.ota?.notes : manifest?.apk?.notes;

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
                    {updateResult.type === 'OTA' ? 'Baixar e Aplicar' : 'Baixar Agora'}
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
