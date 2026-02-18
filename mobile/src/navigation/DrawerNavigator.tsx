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
import { EMOJI } from '../constants/emojis';
import DrawerItemLabel from '../components/DrawerItemLabel';

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
        options={{
          title: 'Página Inicial',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.HOME} label="Página Inicial" {...props} />
        }}
      />
      <Drawer.Screen
        name="Noticias"
        component={NoticiasScreen}
        options={{
          title: 'Notícias',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.NOTICIAS} label="Notícias" {...props} />
        }}
      />
      <Drawer.Screen
        name="MeusDados"
        component={MeusDadosScreen}
        options={{
          title: 'Meus Dados',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.MEUS_DADOS} label="Meus Dados" {...props} />
        }}
      />
      <Drawer.Screen
        name="Filiados"
        component={FiliadosScreen}
        options={{
          title: 'Filiados',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.FILIADOS} label="Filiados" {...props} />
        }}
      />
      <Drawer.Screen
        name="Publicacoes"
        component={PublicacoesScreen}
        options={{
          title: 'Publicações',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.PUBLICACOES} label="Publicações" {...props} />
        }}
      />
      <Drawer.Screen
        name="Ressarcimento"
        component={RessarcimentoScreen}
        options={{
          title: 'Ressarcimento',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.RESSARCIMENTO} label="Ressarcimento" {...props} />
        }}
      />
      <Drawer.Screen
        name="Jogos2026"
        component={JogosScreen}
        options={{
          title: 'Jogos 2026',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.JOGOS} label="Jogos 2026" {...props} />
        }}
      />
      <Drawer.Screen
        name="Votacao"
        component={AssembleiaStack}
        options={{
          title: 'Assembleias e Votações',
          headerShown: false,
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.ASSEMBLEIA} label="Assembleias e Votações" {...props} />
        }}
      />
      <Drawer.Screen
        name="Estatuto"
        component={EstatutoScreen}
        options={{
          title: 'Estatuto',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.ESTATUTO} label="Estatuto" {...props} />
        }}
      />
      <Drawer.Screen
        name="Seguranca"
        component={SegurancaScreen}
        options={{
          title: 'Segurança',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.SEGURANCA} label="Segurança" {...props} />
        }}
      />
      <Drawer.Screen
        name="Atualizacoes"
        component={AtualizacoesScreen}
        options={{
          title: 'Atualizações',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.ATUALIZACOES} label="Atualizações" {...props} />
        }}
      />
      {/* Tela de Diagnóstico/Logs - Para ADMIN e DIRETORIA */}
      {ehDiretoria && (
        <Drawer.Screen
          name="Logs"
          component={LogsScreen}
          options={{
            title: 'Diagnóstico do Sistema',
            headerTitleStyle: { fontSize: 16 },
            drawerItemStyle: { display: 'none' }
          }}
        />
      )}
      {ehGestao && (
        <>
          <Drawer.Screen
            name="Repasse"
            component={RepasseScreen}
            options={{
              title: 'Repasse',
              drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.REPASSE} label="Repasse" {...props} />
            }}
          />
          <Drawer.Screen
            name="Relatorios"
            component={RelatoriosScreen}
            options={{
              title: 'Relatórios',
              drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.RELATORIOS} label="Relatórios" {...props} />
            }}
          />
          <Drawer.Screen
            name="NotificacoesPush"
            component={NotificacoesPushScreen}
            options={{
              title: 'Notificações',
              drawerItemStyle: { display: 'none' }
            }}
          />
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
