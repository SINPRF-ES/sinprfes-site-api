// mobile/src/navigation/DrawerNavigator.tsx
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from '../screens/HomeScreen';
import MeusDadosScreen from '../screens/MeusDadosScreen';
import FiliadosScreen from '../screens/FiliadosScreen';
import CustomDrawerContent from './CustomDrawerContent';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: '#fff',
        headerStyle: { backgroundColor: '#003366' },
      }}
    >
      <Drawer.Screen
        name="Início"
        component={HomeScreen}
        options={{ title: 'Área do Filiado' }}
      />
      <Drawer.Screen
        name="MeusDados"
        component={MeusDadosScreen}
        options={{ title: 'Meus Dados' }}
      />
      <Drawer.Screen
        name="Filiados"
        component={FiliadosScreen}
        options={{ title: 'Listar Filiados' }}
      />
      {/* Adicionar outras telas aqui conforme necessário */}
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
