// mobile/src/navigation/DrawerNavigator.tsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import MeusDadosScreen from '../screens/MeusDadosScreen';
import UsersScreen from '../screens/UsersScreen';
import AssembleiaStack from './AssembleiaStack';
import LogsScreen from '../screens/LogsScreen';
import SegurancaScreen from '../screens/SegurancaScreen';
import CriarUserScreen from '../screens/CriarUserScreen';
import PublicacoesScreen from '../screens/PublicacoesScreen';
import LogisticaScreen from '../screens/LogisticaScreen';
import JogosScreen from '../screens/JogosScreen';
import EstatutoScreen from '../screens/EstatutoScreen';
import AtualizacoesScreen from '../screens/AtualizacoesScreen';
import NotificacoesPushScreen from '../screens/NotificacoesPushScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import ArquivadosScreen from '../screens/ArquivadosScreen';
import CustomDrawerContent from './CustomDrawerContent';
import { useAuth } from '../hooks/useAuth';
import { isGestao, isDiretoria } from '../utils/user';
import { ENABLE_JOGOS, ENABLE_PUSH } from '../config/features';
import { logger } from '../infra/logger';
import { useEffect } from 'react';
import { EMOJIS } from '../utils/emoji';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  const { user } = useAuth();
  const ehGestao = isGestao(user?.perfil_acesso);
  const ehDiretoria = isDiretoria(user?.perfil_acesso);

  useEffect(() => {
    logger.info('NAV_GATE_EVAL', {
      profile: user?.perfil_acesso,
      ehGestao,
      ehDiretoria,
      visibleLogs: ehDiretoria
    });
  }, [user, ehGestao, ehDiretoria]);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerTintColor: '#fff',
        headerStyle: { backgroundColor: '#003366' },
        headerTitleAlign: 'center',
        headerTitleContainerStyle: { paddingHorizontal: 20 },
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
        name="Home"
        component={HomeScreen}
        options={{ title: `${EMOJIS.HOME} Página Inicial` }}
      />
      <Drawer.Screen
        name="MeusDados"
        component={MeusDadosScreen}
        options={{ title: `${EMOJIS.MEUS_DADOS} Meus Dados` }}
      />
      <Drawer.Screen
        name="Users"
        component={UsersScreen}
        options={{ title: `${EMOJIS.MEMBROS} Membros` }}
      />
      <Drawer.Screen
        name="Publicacoes"
        component={PublicacoesScreen}
        options={{
          title: `${EMOJIS.PUBLICACOES} Publicações`,
        }}
      />
      <Drawer.Screen
        name="Logistica"
        component={LogisticaScreen}
        options={{
          title: `${EMOJIS.LOGISTICA} Logística`,
        }}
      />
      {ENABLE_JOGOS && (
        <Drawer.Screen
          name="Jogos2026"
          component={JogosScreen}
          options={{ title: `${EMOJIS.JOGOS} Jogos 2026` }}
        />
      )}
      <Drawer.Screen
        name="Votacao"
        component={AssembleiaStack}
        options={{ title: `${EMOJIS.VOTACOES} Assembleias e Votações`, headerShown: false }}
      />
      <Drawer.Screen
        name="Estatuto"
        component={EstatutoScreen}
        options={{ title: `${EMOJIS.ESTATUTO} Estatuto` }}
      />
      <Drawer.Screen
        name="Seguranca"
        component={SegurancaScreen}
        options={{ title: `${EMOJIS.SEGURANCA} Segurança` }}
      />
      <Drawer.Screen
        name="Atualizacoes"
        component={AtualizacoesScreen}
        options={{ title: `${EMOJIS.ATUALIZACOES} Atualizações` }}
      />
      {/* Tela de Diagnóstico/Logs - Aberto para todos para depuração */}
      <Drawer.Screen
        name="Logs"
        component={LogsScreen}
        options={{
          title: 'Diagnóstico',
          drawerItemStyle: { display: 'none' }
        }}
      />
      {ehGestao && (
        <>
          <Drawer.Screen
            name="Relatorios"
            component={RelatoriosScreen}
            options={{ title: `${EMOJIS.RELATORIOS} Relatórios` }}
          />
          <Drawer.Screen
            name="Arquivados"
            component={ArquivadosScreen}
            options={{
              title: `${EMOJIS.ARQUIVADOS} Arquivados`,
              drawerItemStyle: { display: 'none' }
            }}
          />
          {ENABLE_PUSH && (
            <Drawer.Screen
              name="NotificacoesPush"
              component={NotificacoesPushScreen}
              options={{
                title: 'Notificações',
                drawerItemStyle: { display: 'none' }
              }}
            />
          )}
          <Drawer.Screen
            name="CriarUser"
            component={CriarUserScreen}
            options={{
              title: 'Novo membro',
              drawerItemStyle: { display: 'none' } // Oculta o item da lista padrão
            }}
          />
        </>
      )}
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;
