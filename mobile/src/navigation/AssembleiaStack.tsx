import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions } from '@react-navigation/native';
import AssembleiasScreen from '../screens/assembleia/AssembleiasScreen';
import AssembleiaDetalheScreen from '../screens/assembleia/AssembleiaDetalheScreen';
import AssembleiaSalaScreen from '../screens/assembleia/AssembleiaSalaScreen';
import CriarAssembleiaScreen from '../screens/assembleia/CriarAssembleiaScreen';
import PropostasScreen from '../screens/assembleia/PropostasScreen';
import CriarItemVotacaoScreen from '../screens/assembleia/CriarItemVotacaoScreen';
import ComporMesaScreen from '../screens/assembleia/ComporMesaScreen';
import PublicacoesScreen from '../screens/PublicacoesScreen';

const Stack = createNativeStackNavigator();

export default function AssembleiaStack() {
  return (
    <Stack.Navigator screenOptions={({ navigation }) => ({
      headerShown: true,
      headerTintColor: '#fff',
      headerStyle: { backgroundColor: '#003366' },
      headerTitleAlign: 'center',
      headerLeft: ({ canGoBack }) => (
        <TouchableOpacity
          onPress={() => canGoBack ? navigation.goBack() : navigation.dispatch(DrawerActions.openDrawer())}
          style={{ flexDirection: 'row', alignItems: 'center', marginLeft: canGoBack ? 0 : 8 }}
        >
          <Ionicons name={canGoBack ? "arrow-back" : "menu"} size={26} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>
            {canGoBack ? "Voltar" : "Menu"}
          </Text>
        </TouchableOpacity>
      ),
    })}>
      <Stack.Screen
        name="AssembleiaList"
        component={AssembleiasScreen}
        options={{ title: 'Assembleias' }}
      />
      <Stack.Screen name="AssembleiaDetalhe" component={AssembleiaDetalheScreen} />
      <Stack.Screen name="AssembleiaSala" component={AssembleiaSalaScreen} />
      <Stack.Screen name="CriarAssembleia" component={CriarAssembleiaScreen} />
      <Stack.Screen name="Propostas" component={PropostasScreen} />
      <Stack.Screen name="CriarItemVotacao" component={CriarItemVotacaoScreen} />
      <Stack.Screen name="ComporMesa" component={ComporMesaScreen} options={{ title: 'Compor Mesa' }} />
      <Stack.Screen name="PublicacoesPicker" component={PublicacoesScreen} options={{ title: 'Selecionar Edital' }} />
    </Stack.Navigator>
  );
}
