// mobile/src/navigation/DrawerNavigator.tsx
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from '../screens/HomeScreen';
import MeusDadosScreen from '../screens/MeusDadosScreen';
import FiliadosScreen from '../screens/FiliadosScreen';
import NoticiasScreen from '../screens/NoticiasScreen';
import VotacaoScreen from '../modules/votacao/screens/VotacaoScreen';
import LogsScreen from '../screens/LogsScreen';
import SegurancaScreen from '../screens/SegurancaScreen';
import CriarFiliadoScreen from '../screens/CriarFiliadoScreen';
import PublicacoesScreen from '../screens/PublicacoesScreen';
import RessarcimentoScreen from '../screens/RessarcimentoScreen';
import JogosScreen from '../screens/JogosScreen';
import CustomDrawerContent from './CustomDrawerContent';
import { useAuth } from '../hooks/useAuth';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  const { usuario } = useAuth();
  const isGestao = usuario?.perfil_acesso && ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(usuario.perfil_acesso);

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
        name="Noticias"
        component={NoticiasScreen}
        options={{ title: 'Notícias' }}
      />
      <Drawer.Screen
        name="Filiados"
        component={FiliadosScreen}
        options={{ title: 'Listar Filiados' }}
      />
      <Drawer.Screen
        name="Votacao"
        component={VotacaoScreen}
        options={{ title: 'Votação' }}
      />
      <Drawer.Screen
        name="Publicacoes"
        component={PublicacoesScreen}
        options={{ title: 'Publicações' }}
      />
      <Drawer.Screen
        name="Ressarcimento"
        component={RessarcimentoScreen}
        options={{ title: 'Ressarcimento' }}
      />
      <Drawer.Screen
        name="Jogos2026"
        component={JogosScreen}
        options={{ title: 'Jogos 2026' }}
      />
      <Drawer.Screen
        name="Seguranca"
        component={SegurancaScreen}
        options={{ title: 'Segurança' }}
      />
      {/* Tela de Diagnóstico/Logs - Apenas para ADMINS */}
      {usuario?.perfil_acesso === 'ADMIN' && (
        <Drawer.Screen
          name="Logs"
          component={LogsScreen}
          options={{ title: 'Diagnóstico' }}
        />
      )}
      {isGestao && (
        <>
          <Drawer.Screen
            name="CriarFiliado"
            component={CriarFiliadoScreen}
            options={{
              title: 'Novo Filiado',
              drawerItemStyle: { display: 'none' } // Oculta o item da lista padrão
            }}
          />
        </>
      )}
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
