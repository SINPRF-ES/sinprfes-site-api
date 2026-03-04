// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { isGestao as checkIsGestao, isDiretoria as checkIsDiretoria } from '../utils/filiadoUtils';
import { EMOJI } from '../constants/emojis';
import DrawerItemLabel from '../components/DrawerItemLabel';
import { COLORS } from '../theme/colors';

function formatarData(data: string) {
  if (!data) return '';
  // Formato esperado: YYYY-MM-DD...
  const parts = data.split('T')[0].split('-');
  if (parts.length !== 3) return data;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function maskTelefone(tel: string) {
  if (!tel) return '';
  const cleaned = tel.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return tel;
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

            {usuario.perfil_acesso && (
              <Text style={[styles.subInfo, styles.perfil]}>
                {String(usuario.perfil_acesso).toUpperCase()}
              </Text>
            )}

            {(usuario.situacao_funcional || usuario.situacao) && (
              <Text style={styles.subInfo}>
                ⚖️ {String(usuario.situacao_funcional || usuario.situacao).toUpperCase()}
              </Text>
            )}

            {usuario.telefone1 && (
              <Text style={styles.subInfo}>
                📞 {maskTelefone(usuario.telefone1)}
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
    backgroundColor: '#eaf3ff',
    borderBottomWidth: 1,
    borderBottomColor: '#c7def6',
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
    color: COLORS.textMuted,
    marginTop: 2,
  },
  perfil: {
    fontWeight: '700',
    color: COLORS.prfBlue,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  listContainer: {
    paddingTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  sectionHeader: {
    fontWeight: 'bold',
    color: COLORS.prfBlue,
    marginLeft: -16, // Alinha com o texto dos outros itens
  },
  closeAppContainer: {
    paddingHorizontal: 15,
    marginVertical: 10,
  },
  closeAppButton: {
    backgroundColor: COLORS.prfBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  closeAppButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CustomDrawerContent;
