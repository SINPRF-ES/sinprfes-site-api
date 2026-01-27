import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { getMinhaInscricaoJogos } from '../services/jogosService';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import { getCanonicalFiliadoId } from '../utils/filiadoUtils';

const JogosBanner = () => {
  const navigation = useNavigation<any>();
  const { usuario } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      if (!usuario) return;
      const userId = getCanonicalFiliadoId(usuario);
      const storageKey = `jogos_banner_hidden_${userId}`;

      try {
        // 1. Verificar se o usuário marcou "não mostrar novamente"
        const isHidden = await AsyncStorage.getItem(storageKey);
        if (isHidden === 'true') {
          setLoading(false);
          return;
        }

        // 2. Verificar se já está inscrito
        const inscricao = await getMinhaInscricaoJogos();
        if (!inscricao) {
          setVisible(true);
        }
      } catch (err) {
        logger.error('[JogosBanner.checkStatus]', err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [usuario]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleDontShowAgain = async () => {
    if (!usuario) return;
    const userId = getCanonicalFiliadoId(usuario);
    const storageKey = `jogos_banner_hidden_${userId}`;

    try {
      await AsyncStorage.setItem(storageKey, 'true');
      setVisible(false);
    } catch (err) {
      logger.error('[JogosBanner.dontShowAgain]', err);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Jogos2026');
    setVisible(false);
  };

  if (loading || !visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <MaterialCommunityIcons name="close" size={20} color="#999" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="trophy-outline" size={32} color="#f1c40f" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Jogos PRF 2026</Text>
            <Text style={styles.description}>
              Você ainda não se inscreveu! Participe da maior integração esportiva da categoria.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
            <Text style={styles.registerButtonText}>Inscrever-se</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dontShowButton} onPress={handleDontShowAgain}>
            <Text style={styles.dontShowText}>Não mostrar novamente</Text>
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
    borderLeftColor: '#f1c40f',
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
    justifyContent: 'space-between',
    gap: 10,
  },
  registerButton: {
    backgroundColor: '#003366',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  dontShowButton: {
    paddingVertical: 8,
  },
  dontShowText: {
    color: '#999',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});

export default JogosBanner;
