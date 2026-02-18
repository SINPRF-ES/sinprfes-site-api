// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useAuth } from '../hooks/useAuth';
import { isGestao as checkIsGestao, isDiretoria as checkIsDiretoria } from '../utils/filiadoUtils';
import { EMOJI } from '../constants/emojis';
import DrawerItemLabel from '../components/DrawerItemLabel';

const CustomDrawerContent = (props) => {
  const { usuario, logout, setBloqueadoPorBiometria } = useAuth();
  const ehGestao = checkIsGestao(usuario?.perfil_acesso);
  const ehDiretoria = checkIsDiretoria(usuario?.perfil_acesso);

  const handleLogoutPress = () => {
    Alert.alert(
      'Sair da Conta',
      'Como deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair (Manter Biometria)',
          onPress: () => logout(false)
        },
        {
          text: 'Remover acesso deste aparelho',
          style: 'destructive',
          onPress: () => logout(true)
        },
      ]
    );
  };

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.header}>
        <Image
          source={usuario?.avatar_url ? { uri: usuario.avatar_url } : require('../../assets/logo.png')}
          style={styles.avatar}
          resizeMode="contain"
        />
        <Text style={styles.nome}>{usuario?.nome || 'Usuário'}</Text>
        <Text style={styles.status}>{usuario?.situacao || 'ATIVO'}</Text>
      </View>
      <DrawerItemList {...props} />

      {ehGestao && (
        <>
          <View style={styles.separator} />
          <DrawerItem
            label={(props) => (
              <DrawerItemLabel
                emoji={EMOJI.GESTAO}
                label="Gestão"
                {...props}
                color={styles.sectionHeader.color}
              />
            )}
            onPress={() => {}} // Não faz nada, é apenas um título
          />
          <DrawerItem
            label={(props) => <DrawerItemLabel emoji={EMOJI.NOTIFICACOES} label="Notificações" {...props} />}
            onPress={() => props.navigation.navigate('NotificacoesPush')}
          />
          <DrawerItem
            label={(props) => <DrawerItemLabel emoji={EMOJI.NOVO_FILIADO} label="Novo Filiado" {...props} />}
            onPress={() => props.navigation.navigate('CriarFiliado')}
          />
          {ehDiretoria && (
            <DrawerItem
              label={(props) => <DrawerItemLabel emoji={EMOJI.DIAGNOSTICO} label="Diagnóstico" {...props} />}
              onPress={() => props.navigation.navigate('Logs')}
            />
          )}
        </>
      )}

      <View style={styles.separator} />

      <View style={styles.closeAppContainer}>
        <TouchableOpacity
          style={styles.closeAppButton}
          onPress={() => setBloqueadoPorBiometria(true)}
        >
          <Text style={styles.closeAppButtonText}>{EMOJI.FECHAR_APP} Fechar App</Text>
        </TouchableOpacity>
      </View>

      <DrawerItem
        label={(props) => <DrawerItemLabel emoji={EMOJI.SAIR} label="Sair da conta" {...props} />}
        onPress={handleLogoutPress}
        inactiveTintColor="#666"
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
