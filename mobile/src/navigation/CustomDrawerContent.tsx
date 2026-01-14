// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { useAuth } from '../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

const CustomDrawerContent = (props) => {
  const { usuario, logout } = useAuth();
  const isAdmin = usuario?.perfil_acesso !== 'FILIADO';

  const filteredProps = {
    ...props,
    state: {
      ...props.state,
      routes: props.state.routes.filter(route => {
        // Lógica para filtrar rotas de admin se necessário
        // Ex: if (route.name === 'AdminScreen' && !isAdmin) return false;
        return true;
      }),
    },
  };

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
      <DrawerItemList {...filteredProps} />
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
});

export default CustomDrawerContent;
