// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useAuth } from '../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

const CustomDrawerContent = (props) => {
  const { usuario, logout } = useAuth();
  const isGestao = usuario?.perfil_acesso && ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(usuario.perfil_acesso);

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.header}>
        <Image
          source={usuario?.avatar_url ? { uri: usuario.avatar_url } : require('../../assets/icon.png')}
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
        </>
      )}

      <View style={styles.separator} />
      <DrawerItem
        label="Sair"
        icon={({ color, size }) => <Ionicons name="exit-outline" color={color} size={size} />}
        onPress={logout}
        inactiveTintColor="#c0392b"
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
});

export default CustomDrawerContent;
