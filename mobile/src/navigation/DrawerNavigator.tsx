// mobile/src/navigation/DrawerNavigator.tsx
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { HomeScreen, MeusDadosScreen, FiliadosScreen } from '../screens'; // Supondo que exporta assim
import CustomDrawerContent from './CustomDrawerContent';

// Telas existentes que serão usadas no Drawer
import MeusDadosNavigator from './MeusDadosNavigator'; // Exemplo, vamos ajustar para o real

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
