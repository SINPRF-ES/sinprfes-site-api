// src/navigation/index.tsx
import React, { useEffect, useRef } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { Button } from "react-native";

import { useAuth } from "../hooks/useAuth";

import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import BiometricLockScreen from "../screens/BiometricLockScreen";
import HomeScreen from "../screens/HomeScreen";
import FiliadosScreen from "../screens/FiliadosScreen";
import MeusDadosScreen from "../screens/MeusDadosScreen";
import CriarFiliadoScreen from "../screens/CriarFiliadoScreen";
import EditarFiliadoScreen from "../screens/EditarFiliadoScreen";
import VotacaoScreen from "../modules/votacao/screens/VotacaoScreen";
import NoticiasScreen from "../screens/NoticiasScreen";
import ConveniosScreen from "../screens/ConveniosScreen";

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  BiometricLock: undefined;

  Home: undefined;
  MeusDados: undefined;
  Noticias: undefined;
  Convenios: undefined;

  Filiados: undefined;
  CriarFiliado: undefined;
  EditarFiliado: { filiadoId: number };

  Votacao: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type PendingNav =
  | { screen: "Noticias" }
  | { screen: "Votacao" }
  | null;

export default function RootNavigation() {
  const { autenticado, carregando, bloqueadoPorBiometria } = useAuth() as any;

  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList> | null>(null);

  const pendingNavRef = useRef<PendingNav>(null);

  function tryConsumePendingNav() {
    const nav = navigationRef.current;
    const pending = pendingNavRef.current;
    if (!nav || !pending || !autenticado || bloqueadoPorBiometria) return;
    if (pending.screen === "Noticias") nav.navigate("Noticias");
    if (pending.screen === "Votacao") nav.navigate("Votacao");
    pendingNavRef.current = null;
  }

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response?.notification?.request?.content?.data as any;
      if (data?.screen === "Noticias") pendingNavRef.current = { screen: "Noticias" };
      else if (data?.screen === "Votacao") pendingNavRef.current = { screen: "Votacao" };
      tryConsumePendingNav();
    });
    return () => sub.remove();
  }, [autenticado, bloqueadoPorBiometria]);

  useEffect(() => {
    tryConsumePendingNav();
  }, [autenticado, bloqueadoPorBiometria]);

  if (carregando) return null;

  return (
    <NavigationContainer
      ref={(ref) => {
        navigationRef.current = ref;
        tryConsumePendingNav();
      }}
    >
      <Stack.Navigator>
        {!autenticado ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Recuperar Senha' }}
            />
          </>
        ) : bloqueadoPorBiometria ? (
          <Stack.Screen
            name="BiometricLock"
            component={BiometricLockScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                title: "SINPRF/ES",
                headerRight: () => {
                  const { logout } = useAuth();
                  return <Button onPress={logout} title="Sair" color="#c00" />;
                },
              }}
            />
            <Stack.Screen name="MeusDados" component={MeusDadosScreen} options={{ title: "Meus Dados" }} />
            <Stack.Screen name="Noticias" component={NoticiasScreen} options={{ title: "Notícias" }} />
            <Stack.Screen name="Convenios" component={ConveniosScreen} options={{ title: "Convênios" }} />
            <Stack.Screen name="Filiados" component={FiliadosScreen} options={{ title: "Filiados" }} />
            <Stack.Screen name="CriarFiliado" component={CriarFiliadoScreen} options={{ title: "Novo Filiado" }} />
            <Stack.Screen name="EditarFiliado" component={EditarFiliadoScreen} options={{ title: "Editar Filiado" }} />
            <Stack.Screen name="Votacao" component={VotacaoScreen} options={{ title: "Assembleias e Votações" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
