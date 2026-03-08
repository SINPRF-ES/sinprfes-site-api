import React, { useEffect } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../theme/colors';

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
import PushDiagnosticScreen from '../screens/PushDiagnosticScreen';
import RepasseScreen from '../screens/RepasseScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import ConsultaProcessualScreen from '../screens/ConsultaProcessualScreen';

import CustomDrawerContent from './CustomDrawerContent';
import DrawerItemLabel from '../components/DrawerItemLabel';

import { useAuth } from '../hooks/useAuth';
import { isGestao, isDiretoria } from '../utils/filiadoUtils';
import { logger } from '../infra/logger';
import { EMOJI } from '../constants/emojis';

import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

export default function DrawerNavigator() {
  const { usuario } = useAuth();
  const ehGestaoUsuario = isGestao(usuario?.perfil_acesso);
  const ehDiretoriaUsuario = isDiretoria(usuario?.perfil_acesso);
  const isComunicador = (usuario?.perfil_acesso || '').toUpperCase() === 'COMUNICADOR';

  useEffect(() => {
    logger.info('NAV_GATE_EVAL', {
      profile: usuario?.perfil_acesso,
      ehGestao: ehGestaoUsuario,
      ehDiretoria: ehDiretoriaUsuario,
      visibleLogs: ehDiretoriaUsuario,
    });
  }, [usuario?.perfil_acesso, ehGestaoUsuario, ehDiretoriaUsuario]);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerTintColor: COLORS.white,
        headerStyle: { backgroundColor: COLORS.prfBlue },
        headerTitleAlign: 'center',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.toggleDrawer()}
            style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}
          >
            <Ionicons name="menu" size={26} color={COLORS.white} />
            <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Menu</Text>
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="Início"
        component={HomeScreen}
        options={{
          title: 'Página Inicial',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.HOME} label="Página Inicial" {...props} />,
        }}
      />

      <Drawer.Screen
        name="Noticias"
        component={NoticiasScreen}
        options={{
          title: 'Informes',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.NOTICIAS} label="Informes" {...props} />,
        }}
      />

      <Drawer.Screen
        name="MeusDados"
        component={MeusDadosScreen}
        options={{
          title: 'Meus Dados',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.MEUS_DADOS} label="Meus Dados" {...props} />,
        }}
      />

      {!isComunicador && (
      <Drawer.Screen
        name="Filiados"
        component={FiliadosScreen}
        options={{
          title: 'Filiados',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.FILIADOS} label="Filiados" {...props} />,
        }}
      />
      )}

      {!isComunicador && (
      <Drawer.Screen
        name="Publicacoes"
        component={PublicacoesScreen}
        options={{
          title: 'Publicações',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.PUBLICACOES} label="Publicações" {...props} />,
        }}
      />
      )}

      <Drawer.Screen
        name="Ressarcimento"
        component={RessarcimentoScreen}
        options={{
          title: 'Ressarcimento',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.RESSARCIMENTO} label="Ressarcimento" {...props} />,
        }}
      />

      {!isComunicador && (
      <Drawer.Screen
        name="Jogos2026"
        component={JogosScreen}
        options={{
          title: 'Jogos 2026',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.JOGOS} label="Jogos 2026" {...props} />,
        }}
      />
      )}

      {!isComunicador && (
      <Drawer.Screen
        name="Votacao"
        component={AssembleiaStack}
        options={{
          title: 'Assembleias e Votações',
          headerShown: false,
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.ASSEMBLEIA} label="Assembleias e Votações" {...props} />,
        }}
      />
      )}

      <Drawer.Screen
        name="Estatuto"
        component={EstatutoScreen}
        options={{
          title: 'Estatuto',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.ESTATUTO} label="Estatuto" {...props} />,
        }}
      />

      <Drawer.Screen
        name="Seguranca"
        component={SegurancaScreen}
        options={{
          title: 'Segurança',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.SEGURANCA} label="Segurança" {...props} />,
        }}
      />

      <Drawer.Screen
        name="Atualizacoes"
        component={AtualizacoesScreen}
        options={{
          title: 'Atualizações',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.ATUALIZACOES} label="Atualizações" {...props} />,
        }}
      />


      {ehDiretoriaUsuario && (
        <Drawer.Screen
          name="ConsultaProcessual"
          component={ConsultaProcessualScreen}
          options={{
            title: 'Consulta Processual',
            drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.CONSULTA_PROCESSUAL} label="Consulta Processual" {...props} />,
          }}
        />
      )}

      {ehDiretoriaUsuario && (
        <Drawer.Screen
          name="Logs"
          component={LogsScreen}
          options={{
            title: 'Diagnóstico do Sistema',
            headerTitleStyle: { fontSize: 16 },
            drawerItemStyle: { display: 'none' },
          }}
        />
      )}

      {!isComunicador && (
      <Drawer.Screen
        name="Repasse"
        component={RepasseScreen}
        options={{
          title: 'Repasse',
          drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.REPASSE} label="Repasse" {...props} />,
        }}
      />
      )}

      {ehGestaoUsuario && (
        <>
          <Drawer.Screen
            name="PushDiagnostic"
            component={PushDiagnosticScreen}
            options={{
              title: 'Diagnóstico de Push',
              drawerItemStyle: { display: 'none' },
            }}
          />

          <Drawer.Screen
            name="Relatorios"
            component={RelatoriosScreen}
            options={{
              title: 'Relatórios',
              drawerLabel: (props) => <DrawerItemLabel emoji={EMOJI.RELATORIOS} label="Relatórios" {...props} />,
            }}
          />

          <Drawer.Screen
            name="NotificacoesPush"
            component={NotificacoesPushScreen}
            options={{
              title: 'Notificações',
              drawerItemStyle: { display: 'none' },
            }}
          />

          <Drawer.Screen
            name="CriarFiliado"
            component={CriarFiliadoScreen}
            options={{
              title: 'Novo Filiado',
              drawerItemStyle: { display: 'none' },
            }}
          />
        </>
      )}
    </Drawer.Navigator>
  );
}
