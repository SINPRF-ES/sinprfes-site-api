// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useAuth } from '../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { isGestao as checkIsGestao } from '../utils/filiadoUtils';

const CustomDrawerContent = (props) => {
  const { usuario, logout, setBloqueadoPorBiometria } = useAuth();
  const isGestao = checkIsGestao(usuario?.perfil_acesso);

  const handleLogoutPress = () => {
    Alert.alert(
      'Sair da Conta',
      'Tem certeza de que deseja encerrar sua sessão? Você precisará digitar sua senha novamente no próximo acesso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.header}>
        <Image
          source={usuario?.avatar_url ? { uri: usuario.avatar_url } : require('../../assets/icon.webp')}
          style={styles.avatar}
        />
        <Text style={styles.nome}>{usuario?.nome || 'Usuário'}</Text>
        <Text style={styles.status}>{usuario?.situacao || 'ATIVO'}</Text>
      </View>
      <DrawerItemList {...props} />

      {isGestao && (
        <>
          <View style={styles.separator} />
          <DrawerItem
            label="Gestão"
            labelStyle={styles.sectionHeader}
            onPress={() => {}} // Não faz nada, é apenas um título
          />
          <DrawerItem
            label="Novo Filiado"
            icon={({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} />}
            onPress={() => props.navigation.navigate('CriarFiliado')}
          />
          <DrawerItem
            label="Enviar Notificação"
            icon={({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />}
            onPress={() => props.navigation.navigate('NotificacoesPush')}
          />
        </>
      )}

      <View style={styles.separator} />

      <View style={styles.closeAppContainer}>
        <TouchableOpacity
          style={styles.closeAppButton}
          onPress={() => setBloqueadoPorBiometria(true)}
        >
          <Ionicons name="lock-closed-outline" size={20} color="#fff" />
          <Text style={styles.closeAppButtonText}>Fechar App</Text>
        </TouchableOpacity>
      </View>

      <DrawerItem
        label="Sair da conta"
        icon={({ color, size }) => <Ionicons name="log-out-outline" color={color} size={size} />}
        onPress={handleLogoutPress}
        inactiveTintColor="#666"
        labelStyle={{ fontSize: 12 }}
      />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    padding: 20,
    backgroundColor: '#003366',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  nome: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  status: {
    color: '#fff',
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 10,
  },
  sectionHeader: {
    fontWeight: 'bold',
    color: '#003366',
    marginLeft: -16, // Alinha com o texto dos outros itens
  },
  closeAppContainer: {
    paddingHorizontal: 15,
    marginVertical: 10,
  },
  closeAppButton: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  closeAppButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CustomDrawerContent;
