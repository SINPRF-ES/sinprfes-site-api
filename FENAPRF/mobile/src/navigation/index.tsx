// src/navigation/index.tsx
import React, { useEffect, useRef } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../hooks/useAuth";

import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import BiometricLockScreen from "../screens/BiometricLockScreen";
import CriarUserScreen from "../screens/CriarUserScreen";
import EditarUserScreen from "../screens/EditarUserScreen";
import PdfViewerScreen from "../screens/PdfViewerScreen";
import FileViewerScreen from "../screens/FileViewerScreen";
import DrawerNavigator from "./DrawerNavigator";
import UpdateAutoChecker from "../components/UpdateAutoChecker";
import { ENABLE_PUSH } from "../config/features";

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  BiometricLock: undefined;
  Drawer: undefined;

  // Telas individuais para navegação profunda
  Home: undefined;
  MeusDados: undefined;
  Users: undefined;
  Arquivados: { refresh?: boolean };
  CriarUser: undefined;
  EditarUser: { userId: string };
  Votacao: undefined;
  Atualizacoes: undefined;
  PdfViewer: { localUri: string; title: string };
  FileViewer: {
    localUri?: string;
    remoteUrl?: string;
    title: string;
    fileId?: string;
    type?: string;
    context?: string;
  };
  ResetPassword: { token?: string; isFirstAccess?: boolean; cpf?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type PendingNav = { screen: "Votacao" } | null;

const linking = {
  prefixes: ["fenaprf://", "https://fenaprf-sistema.onrender.com"],
  config: {
    screens: {
      ResetPassword: {
        path: "redefinir-senha.html",
        parse: {
          token: (token: string) => token,
        },
      },
    },
  },
};

export default function RootNavigation() {
  const { autenticado, carregando, bloqueadoPorBiometria } = useAuth();

  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList> | null>(null);

  const pendingNavRef = useRef<PendingNav>(null);

  function tryConsumePendingNav() {
    const nav = navigationRef.current;
    const pending = pendingNavRef.current;
    if (!nav || !pending || !autenticado || bloqueadoPorBiometria) return;

    // Se 'Votacao' estiver aninhada no Drawer:
    if (pending.screen === "Votacao") {
      nav.navigate("Drawer" as never, { screen: "Votacao" } as never);
    }

    pendingNavRef.current = null;
  }

  useEffect(() => {
    if (!ENABLE_PUSH) return;

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data as any;
        if (data?.screen === "Votacao") pendingNavRef.current = { screen: "Votacao" };
        tryConsumePendingNav();
      }
    );

    return () => sub.remove();
  }, [autenticado, bloqueadoPorBiometria]);

  useEffect(() => {
    tryConsumePendingNav();
  }, [autenticado, bloqueadoPorBiometria]);

  if (carregando) return null;

  return (
    <NavigationContainer
      linking={linking}
      ref={(ref) => {
        navigationRef.current = ref;
        tryConsumePendingNav();
      }}
    >
      {/* ✅ Precisa estar dentro do NavigationContainer */}
      <UpdateAutoChecker />

      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          headerTintColor: "#fff",
          headerStyle: { backgroundColor: "#003366" },
          headerTitleAlign: "center",
          headerLeft: () => {
            const canGoBack = navigation.canGoBack();
            if (!canGoBack) return null;
            return (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons name="arrow-back" size={26} color="#fff" />
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: "bold",
                    marginLeft: 4,
                  }}
                >
                  Voltar
                </Text>
              </TouchableOpacity>
            );
          },
        })}
      >
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
              options={{ title: "Recuperar Senha" }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: "Redefinir Senha" }}
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
              name="Drawer"
              component={DrawerNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CriarUser"
              component={CriarUserScreen}
              options={{ title: "Novo Membro" }}
            />
            <Stack.Screen
              name="EditarUser"
              component={EditarUserScreen}
              options={{ title: "Editar Membro" }}
            />
            <Stack.Screen
              name="PdfViewer"
              component={PdfViewerScreen}
              options={({ route }) => ({
                title: route.params.title || "Visualizador PDF",
              })}
            />
            <Stack.Screen
              name="FileViewer"
              component={FileViewerScreen}
              options={({ route }) => ({
                title: route.params.title || "Visualizador",
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
