// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { isGestao as checkIsGestao, isDiretoria as checkIsDiretoria } from '../utils/filiadoUtils';
import { EMOJI } from '../constants/emojis';
import DrawerItemLabel from '../components/DrawerItemLabel';

function formatarData(data: string) {
  if (!data) return '';
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR');
}

const CustomDrawerContent = (props) => {
  const { usuario, logout, setBloqueadoPorBiometria } = useAuth();
  const insets = useSafeAreaInsets();
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
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.drawerHeader}>
          <Image
            source={usuario.avatar_url ? { uri: usuario.avatar_url } : (usuario.fotoUrl ? { uri: usuario.fotoUrl } : require('../../assets/logo.png'))}
            style={styles.avatar}
          />

          <View style={styles.userInfo}>
            <Text style={styles.nome} numberOfLines={2}>
              {usuario.nome}
            </Text>

            {usuario.telefone1 && (
              <Text style={styles.subInfo}>
                📞 {usuario.telefone1}
              </Text>
            )}

            {usuario.data_nascimento && (
              <Text style={styles.subInfo}>
                🎂 {formatarData(usuario.data_nascimento)}
              </Text>
            )}

            {usuario.lotacao && (
              <Text style={styles.subInfo}>
                📍 {usuario.lotacao}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.separator} />

      <View style={styles.listContainer}>
        <DrawerItemList {...props} />
      </View>

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
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawerContent: {
    paddingTop: 0,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nome: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  subInfo: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  listContainer: {
    paddingTop: 4,
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
