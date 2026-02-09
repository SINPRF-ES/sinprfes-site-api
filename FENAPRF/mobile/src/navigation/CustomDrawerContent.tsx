// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useAuth } from '../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { isGestao as checkIsGestao, isDiretoria as checkIsDiretoria } from '../utils/user';
import MemberCard from '../components/MemberCard';
import { ENABLE_PUSH } from '../config/features';
import { EMOJIS } from '../utils/emoji';

const CustomDrawerContent = (props) => {
  const { user, logout, setBloqueadoPorBiometria } = useAuth();
  const ehGestao = checkIsGestao(user?.perfil_acesso);
  const ehDiretoria = checkIsDiretoria(user?.perfil_acesso);

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
        <MemberCard
          member={user as any}
          variant="drawer"
          onPress={() => props.navigation.navigate('MeusDados')}
        />
      </View>
      <DrawerItemList {...props} />

      {ehGestao && (
        <>
          <View style={styles.separator} />
          <DrawerItem
            label={`${EMOJIS.GESTAO} Gestão`}
            labelStyle={styles.sectionHeader}
            onPress={() => {}} // Não faz nada, é apenas um título
          />
          {ENABLE_PUSH && (
            <DrawerItem
              label={`${EMOJIS.NOTIFICACOES} Notificações`}
              onPress={() => props.navigation.navigate('NotificacoesPush')}
            />
          )}
          <DrawerItem
            label={`${EMOJIS.NOVO_MEMBRO} Novo membro`}
            onPress={() => props.navigation.navigate('CriarUser')}
          />
          <DrawerItem
            label={`${EMOJIS.DIAGNOSTICO} Diagnóstico`}
            onPress={() => props.navigation.navigate('Logs')}
          />
        </>
      )}

      <View style={styles.separator} />

      <View style={styles.closeAppContainer}>
        <TouchableOpacity
          style={styles.closeAppButton}
          onPress={() => setBloqueadoPorBiometria(true)}
        >
          <Text style={styles.closeAppButtonText}>{EMOJIS.FECHAR} Fechar App</Text>
        </TouchableOpacity>
      </View>

      <DrawerItem
        label={`${EMOJIS.SAIR} Sair da conta`}
        onPress={handleLogoutPress}
        inactiveTintColor="#666"
        labelStyle={{ fontSize: 12 }}
      />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#003366',
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
