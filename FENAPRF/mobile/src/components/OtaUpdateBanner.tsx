import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, DeviceEventEmitter, Linking, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UpdateCheckResult, applyOtaUpdate } from '../services/updateService';
import { logger } from '../infra/logger';

const OtaUpdateBanner = () => {
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const loadStoredUpdate = async () => {
      try {
        const stored = await AsyncStorage.getItem('@fenaprf/ota_update_available');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUpdate(parsed);
          logger.info('OTA_UPDATE_AVAILABLE_SHOWN', { type: parsed.type, versionCode: parsed.manifest?.versionCode });
        }
      } catch (e) {
        console.warn('[OtaUpdateBanner] Error loading stored update', e);
      }
    };

    loadStoredUpdate();

    const sub = DeviceEventEmitter.addListener('ota_update_detected', (data: UpdateCheckResult | null) => {
      setUpdate(data);
      setHidden(false); // Reset hidden state when a new update is detected
      if (data) {
        logger.info('OTA_UPDATE_AVAILABLE_SHOWN', { type: data.type, versionCode: data.manifest?.versionCode });
      }
    });

    return () => sub.remove();
  }, []);

  const handleClose = () => {
    setHidden(true);
    logger.info('OTA_UPDATE_DISMISSED', { type: update?.type });
  };

  const handleUpdate = async () => {
    if (!update) return;

    logger.info('OTA_UPDATE_TRIGGERED', { type: update.type });

    if (update.type === 'OTA') {
      try {
        await applyOtaUpdate();
      } catch (error: any) {
        Alert.alert('Erro', 'Não foi possível aplicar a atualização. Tente novamente pela tela de Configurações.');
      }
    } else if (update.apkUrl) {
      Linking.openURL(update.apkUrl);
      setHidden(true);
    }
  };

  if (!update || hidden) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <MaterialCommunityIcons name="close" size={20} color="#999" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="update" size={32} color="#f1c40f" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Atualização disponível</Text>
            <Text style={styles.description} numberOfLines={2}>
              Uma nova versão ({update.manifest?.versionName || 'disponível'}) está pronta para ser instalada.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Atualizar Agora</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
    borderLeftWidth: 4,
    borderLeftColor: '#003366',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#003366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  updateButton: {
    backgroundColor: '#003366',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default OtaUpdateBanner;
