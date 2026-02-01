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
import HomeScreen from "../screens/HomeScreen";
import FiliadosScreen from "../screens/FiliadosScreen";
import MeusDadosScreen from "../screens/MeusDadosScreen";
import CriarFiliadoScreen from "../screens/CriarFiliadoScreen";
import EditarFiliadoScreen from "../screens/EditarFiliadoScreen";
import VotacaoScreen from "../modules/votacao/screens/VotacaoScreen";
import NoticiasScreen from "../screens/NoticiasScreen";
import NoticiaDetalheScreen from "../screens/NoticiaDetalheScreen";
import NoticiaEditorScreen from "../screens/NoticiaEditorScreen";
import ConveniosScreen from "../screens/ConveniosScreen";
import PdfViewerScreen from "../screens/PdfViewerScreen";
import FileViewerScreen from "../screens/FileViewerScreen";
import DrawerNavigator from "./DrawerNavigator"; // Importa o Drawer
import UpdateAutoChecker from "../components/UpdateAutoChecker";

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  BiometricLock: undefined;
  Drawer: undefined; // Adiciona a rota do Drawer

  // As telas individuais ainda podem ser necessárias para navegação profunda
  Home: undefined;
  MeusDados: undefined;
  Noticias: undefined;
  NoticiaDetalhe: { newsId: string };
  NoticiaEditor: { newsId: string | null };
  Convenios: undefined;
  Filiados: undefined;
  CriarFiliado: undefined;
  EditarFiliado: { filiadoId: number };
  Votacao: undefined;
  Atualizacoes: undefined;
  PdfViewer: { localUri: string; title: string };
  FileViewer: { localUri?: string; remoteUrl?: string; title: string; fileId?: string; type?: string; context?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type PendingNav =
  | { screen: "Noticias" }
  | { screen: "Votacao" }
  | null;

export default function RootNavigation() {
  const { autenticado, carregando, bloqueadoPorBiometria } = useAuth();

  const navigationRef =
    useRef<NavigationContainerRef<RootStackParamList> | null>(null);

  const pendingNavRef = useRef<PendingNav>(null);

  function tryConsumePendingNav() {
    const nav = navigationRef.current;
    const pending = pendingNavRef.current;
    if (!nav || !pending || !autenticado || bloqueadoPorBiometria) return;

    if (pending.screen === "Noticias") nav.navigate("Drawer", { screen: "Noticias" });
    // TODO: A rota 'Votacao' também precisa ser aninhada se estiver dentro do Drawer.
    // Assumindo que sim por enquanto. Se 'Votacao' for uma tela no Stack principal, isso precisa ser ajustado.
    if (pending.screen === "Votacao") nav.navigate("Drawer", { screen: "Votacao" });

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
      <UpdateAutoChecker />
      <Stack.Navigator screenOptions={({ navigation }) => ({
        headerTintColor: '#fff',
        headerStyle: { backgroundColor: '#003366' },
        headerTitleAlign: 'center',
        headerLeft: () => {
          const canGoBack = navigation.canGoBack();
          if (!canGoBack) return null;
          return (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="arrow-back" size={26} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>
                Voltar
              </Text>
            </TouchableOpacity>
          );
        }
      })}>
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
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: 'Redefinir Senha' }}
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
              name="CriarFiliado"
              component={CriarFiliadoScreen}
              options={{ title: "Novo Filiado" }}
            />
            <Stack.Screen
              name="EditarFiliado"
              component={EditarFiliadoScreen}
              options={{ title: "Editar Filiado" }}
            />
            <Stack.Screen
              name="PdfViewer"
              component={PdfViewerScreen}
              options={({ route }) => ({ title: route.params.title || "Visualizador PDF" })}
            />
            <Stack.Screen
              name="FileViewer"
              component={FileViewerScreen}
              options={({ route }) => ({ title: route.params.title || "Visualizador" })}
            />
            <Stack.Screen
              name="NoticiaDetalhe"
              component={NoticiaDetalheScreen}
              options={{ title: "Notícia" }}
            />
            <Stack.Screen
              name="NoticiaEditor"
              component={NoticiaEditorScreen}
              options={{ title: "Editor de Notícia" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
