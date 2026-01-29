import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, BackHandler, Animated } from 'react-native';
import { checkUpdates, applyOtaUpdate, UpdateCheckResult, reportUpdateAutoCheck } from '../services/updateService';
import { carregarUltimoCheckUpdate, salvarUltimoCheckUpdate } from '../services/storageService';
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  const { autenticado, token, bloqueadoPorBiometria } = useAuth();
  const prevAutenticado = useRef(autenticado);
  const navigation = useNavigation<any>();

  useEffect(() => {
    // Só roda se houver sessão válida e não estiver bloqueado por biometria
    if (!autenticado || !token || bloqueadoPorBiometria) {
      if (!autenticado || !token) {
        logDebug('UpdateCheck.auto.skip', { reason: 'noToken' });
      }
      prevAutenticado.current = autenticado;
      return;
    }

    const isLoginTrigger = !prevAutenticado.current && autenticado;
    prevAutenticado.current = autenticado;

    const performAutoCheck = async () => {
      try {
        const lastCheck = await carregarUltimoCheckUpdate();
        const now = Date.now();

        // Se for gatilho de login, ignoramos o throttle de 6h
        if (!isLoginTrigger && (now - lastCheck < CHECK_INTERVAL)) {
          logDebug('UpdateCheck.auto.skip', { reason: 'throttled' });
          return;
        }

        await reportUpdateAutoCheck('start');

        // checkUpdates('auto') já lida com logDebug('UpdateCheck.auto.*') internamente
        const result = await checkUpdates('auto');

        if (result) {
            await reportUpdateAutoCheck(result.hasUpdate ? 'success' : 'no_update', {
                hasUpdate: result.hasUpdate,
                type: result.type,
                isMandatory: result.isMandatory,
                error: result.error
            });

            if (result.hasUpdate) {
                setUpdateResult(result);

                // No LOGIN, sempre mostramos o modal amigável (mesmo se opcional).
                // Em checks de background periódicos, usamos o banner para opcionais.
                if (result.isMandatory || isLoginTrigger) {
                    setShowModal(true);
                } else {
                    setShowBanner(true);
                    Animated.spring(bannerAnim, {
                        toValue: 50,
                        useNativeDriver: true,
                    }).start();

                    setTimeout(() => {
                        handleCloseBanner();
                    }, 8000);
                }
            }
        }

        await salvarUltimoCheckUpdate();
      } catch (error: any) {
        logDebug('UpdateCheck.auto.error', { message: error.message });
        await reportUpdateAutoCheck('error', { message: error.message });
      }
    };

    const delay = isLoginTrigger ? 1000 : 5000;
    const timer = setTimeout(performAutoCheck, delay);
    return () => clearTimeout(timer);
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

  const handleCloseBanner = () => {
    Animated.timing(bannerAnim, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowBanner(false));
  };

  const handleOpenUpdates = () => {
    handleCloseBanner();
    try {
      navigation.navigate('Drawer', { screen: 'Atualizacoes' });
    } catch (e: any) {
      logDebug('AutoCheck.navError', { message: e.message });
    }
  };

  if (!updateResult) return null;

  const isMandatory = updateResult.isMandatory;
  const manifest = updateResult.manifest;
  const notes = updateResult.type === 'OTA' ? manifest?.ota?.notes : manifest?.apk?.notes;

  return (
    <>
    {/* Banner Discreto para Updates Opcionais (Background Check) */}
    {showBanner && (
      <Animated.View style={[styles.bannerContainer, { transform: [{ translateY: bannerAnim }] }]}>
        <View style={styles.bannerContent}>
          <MaterialCommunityIcons name="update" size={24} color="#003366" />
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Atualização disponível</Text>
            <Text style={styles.bannerSub}>Uma nova versão está pronta.</Text>
          </View>
          <TouchableOpacity style={styles.bannerButton} onPress={handleOpenUpdates}>
            <Text style={styles.bannerButtonText}>VER</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCloseBanner} style={styles.bannerClose}>
            <MaterialCommunityIcons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    )}

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
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    zIndex: 9999,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    padding: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
  },
  bannerSub: {
    fontSize: 12,
    color: '#666',
  },
  bannerButton: {
    backgroundColor: '#003366',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bannerClose: {
    padding: 4,
  },
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
