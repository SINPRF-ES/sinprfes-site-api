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
import DrawerNavigator from "./DrawerNavigator"; // Importa o Drawer

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  BiometricLock: undefined;
  Drawer: undefined; // Adiciona a rota do Drawer

  // As telas individuais ainda podem ser necessárias para navegação profunda
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
          <Stack.Screen
            name="Drawer"
            component={DrawerNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
