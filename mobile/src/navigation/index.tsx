import React, { useEffect, useRef } from 'react';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { TouchableOpacity, Text } from 'react-native';
import { COLORS } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';

import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import BiometricLockScreen from '../screens/BiometricLockScreen';

import DrawerNavigator from './DrawerNavigator';
import type { DrawerParamList } from './types';

import CriarFiliadoScreen from '../screens/CriarFiliadoScreen';
import EditarFiliadoScreen from '../screens/EditarFiliadoScreen';
import PdfViewerScreen from '../screens/PdfViewerScreen';
import FileViewerScreen from '../screens/FileViewerScreen';
import InformeDetalheScreen from '../screens/InformeDetalheScreen';
import InformeEditorScreen from '../screens/InformeEditorScreen';
import VotacaoDetalheScreen from '../screens/VotacaoDetalheScreen';

import UpdateAutoChecker from '../components/UpdateAutoChecker';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  BiometricLock: undefined;

  Drawer: NavigatorScreenParams<DrawerParamList>;

  // Telas fora do Drawer (fluxos “deep” / auxiliares)
  CriarFiliado: undefined;
  EditarFiliado: { filiadoId: number };
  PdfViewer: { localUri: string; title: string };
  FileViewer: { localUri?: string; remoteUrl?: string; title: string; fileId?: string; type?: string; context?: string };
  InformeDetalhe: { newsId?: string; publicRef?: string; module?: 'informes' | 'aniversarios' };
  InformeEditor: { newsId: string | null; module?: 'informes' | 'aniversarios' };
  VotacaoDetalhe: { id: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type PendingNav =
  | { screen: 'Noticias' }
  | { screen: 'Votacao' }
  | null;

export default function RootNavigation() {
  const { autenticado, carregando, bloqueadoPorBiometria } = useAuth();

  const navigationRef = useRef<NavigationContainerRef<RootStackParamList> | null>(null);
  const pendingNavRef = useRef<PendingNav>(null);

  function tryConsumePendingNav() {
    const nav = navigationRef.current;
    const pending = pendingNavRef.current;
    if (!nav || !pending || !autenticado || bloqueadoPorBiometria) return;

    nav.navigate('Drawer', { screen: pending.screen });
    pendingNavRef.current = null;
  }

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data as any;

      if (data?.screen === 'Noticias') pendingNavRef.current = { screen: 'Noticias' };
      else if (data?.screen === 'Votacao') pendingNavRef.current = { screen: 'Votacao' };

      tryConsumePendingNav();
    });

    return () => sub.remove();
  }, [autenticado, bloqueadoPorBiometria]);

  useEffect(() => {
    tryConsumePendingNav();
  }, [autenticado, bloqueadoPorBiometria]);

  if (carregando) return null;

  return (
    <NavigationContainer<RootStackParamList>
      ref={(ref) => {
        navigationRef.current = ref;
        tryConsumePendingNav();
      }}
    >
      <UpdateAutoChecker />

      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          headerTintColor: COLORS.white,
          headerStyle: { backgroundColor: COLORS.prfBlue },
          headerTitleAlign: 'center',
          headerLeft: () => {
            const canGoBack = navigation.canGoBack();
            if (!canGoBack) return null;

            return (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Ionicons name="arrow-back" size={26} color={COLORS.white} />
                <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>
                  Voltar
                </Text>
              </TouchableOpacity>
            );
          },
        })}
      >
        {!autenticado ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Recuperar Senha' }} />
          </>
        ) : bloqueadoPorBiometria ? (
          <Stack.Screen name="BiometricLock" component={BiometricLockScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Drawer" component={DrawerNavigator} options={{ headerShown: false }} />

            <Stack.Screen name="CriarFiliado" component={CriarFiliadoScreen} options={{ title: 'Novo Filiado' }} />
            <Stack.Screen name="EditarFiliado" component={EditarFiliadoScreen} options={{ title: 'Editar Filiado' }} />

            <Stack.Screen
              name="PdfViewer"
              component={PdfViewerScreen}
              options={({ route }) => ({ title: route.params.title || 'Visualizador PDF' })}
            />
            <Stack.Screen
              name="FileViewer"
              component={FileViewerScreen}
              options={({ route }) => ({ title: route.params.title || 'Visualizador' })}
            />

            <Stack.Screen name="InformeDetalhe" component={InformeDetalheScreen} options={{ title: 'Informe' }} />
            <Stack.Screen name="InformeEditor" component={InformeEditorScreen} options={{ title: 'Editor de Informe' }} />
            <Stack.Screen name="VotacaoDetalhe" component={VotacaoDetalheScreen} options={{ title: 'Detalhe da Votação' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
