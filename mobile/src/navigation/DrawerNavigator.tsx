// mobile/src/navigation/DrawerNavigator.tsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import MeusDadosScreen from '../screens/MeusDadosScreen';
import FiliadosScreen from '../screens/FiliadosScreen';
import NoticiasScreen from '../screens/NoticiasScreen';
import AssembleiaStack from './AssembleiaStack';
import LogsScreen from '../screens/LogsScreen';
import SegurancaScreen from '../screens/SegurancaScreen';
import CriarFiliadoScreen from '../screens/CriarFiliadoScreen';
import PublicacoesScreen from '../screens/PublicacoesScreen';
import RessarcimentoScreen from '../screens/RessarcimentoScreen';
import JogosScreen from '../screens/JogosScreen';
import EstatutoScreen from '../screens/EstatutoScreen';
import AtualizacoesScreen from '../screens/AtualizacoesScreen';
import NotificacoesPushScreen from '../screens/NotificacoesPushScreen';
import RepasseScreen from '../screens/RepasseScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import CustomDrawerContent from './CustomDrawerContent';
import { useAuth } from '../hooks/useAuth';
import { isGestao, isDiretoria } from '../utils/filiadoUtils';
import { logger } from '../infra/logger';
import { useEffect } from 'react';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  const { usuario } = useAuth();
  const ehGestao = isGestao(usuario?.perfil_acesso);
  const ehDiretoria = isDiretoria(usuario?.perfil_acesso);

  useEffect(() => {
    logger.info('NAV_GATE_EVAL', {
      profile: usuario?.perfil_acesso,
      ehGestao,
      ehDiretoria,
      visibleLogs: ehDiretoria
    });
  }, [usuario, ehGestao, ehDiretoria]);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerTintColor: '#fff',
        headerStyle: { backgroundColor: '#003366' },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.toggleDrawer()}
            style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}
          >
            <Ionicons name="menu" size={26} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Menu</Text>
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="Início"
        component={HomeScreen}
        options={{ title: '🏠 Página Inicial' }}
      />
      <Drawer.Screen
        name="Noticias"
        component={NoticiasScreen}
        options={{ title: '📰 Notícias' }}
      />
      <Drawer.Screen
        name="MeusDados"
        component={MeusDadosScreen}
        options={{ title: '👤 Meus Dados' }}
      />
      <Drawer.Screen
        name="Filiados"
        component={FiliadosScreen}
        options={{ title: '👥 Filiados' }}
      />
      <Drawer.Screen
        name="Publicacoes"
        component={PublicacoesScreen}
        options={{ title: '📚 Publicações' }}
      />
      <Drawer.Screen
        name="Ressarcimento"
        component={RessarcimentoScreen}
        options={{ title: '💸 Ressarcimento' }}
      />
      <Drawer.Screen
        name="Jogos2026"
        component={JogosScreen}
        options={{ title: '🏆 Jogos 2026' }}
      />
      <Drawer.Screen
        name="Votacao"
        component={AssembleiaStack}
        options={{ title: '🗳️ Assembleias e Votações', headerShown: false }}
      />
      <Drawer.Screen
        name="Estatuto"
        component={EstatutoScreen}
        options={{ title: '⚖️ Estatuto' }}
      />
      <Drawer.Screen
        name="Seguranca"
        component={SegurancaScreen}
        options={{ title: '🛡️ Segurança' }}
      />
      <Drawer.Screen
        name="Atualizacoes"
        component={AtualizacoesScreen}
        options={{ title: '🔄 Atualizações' }}
      />
      {/* Tela de Diagnóstico/Logs - Para ADMIN e DIRETORIA */}
      {ehDiretoria && (
        <Drawer.Screen
          name="Logs"
          component={LogsScreen}
          options={{
            title: 'Diagnóstico do Sistema',
            drawerItemStyle: { display: 'none' }
          }}
        />
      )}
      {ehGestao && (
        <>
          <Drawer.Screen
            name="Repasse"
            component={RepasseScreen}
            options={{ title: '💰 Repasse' }}
          />
          <Drawer.Screen
            name="Relatorios"
            component={RelatoriosScreen}
            options={{ title: '📊 Relatórios' }}
          />
          <Drawer.Screen
            name="NotificacoesPush"
            component={NotificacoesPushScreen}
            options={{
              title: '📢 Notificações',
              drawerItemStyle: { display: 'none' }
            }}
          />
          <Drawer.Screen
            name="CriarFiliado"
            component={CriarFiliadoScreen}
            options={{
              title: '👤 Novo Filiado',
              drawerItemStyle: { display: 'none' } // Oculta o item da lista padrão
            }}
          />
        </>
      )}
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
