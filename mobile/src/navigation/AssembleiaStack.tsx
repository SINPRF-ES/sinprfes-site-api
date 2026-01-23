import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AssembleiasScreen from '../screens/assembleia/AssembleiasScreen';
import AssembleiaDetalheScreen from '../screens/assembleia/AssembleiaDetalheScreen';
import AssembleiaSalaScreen from '../screens/assembleia/AssembleiaSalaScreen';
import CriarAssembleiaScreen from '../screens/assembleia/CriarAssembleiaScreen';
import PropostasScreen from '../screens/assembleia/PropostasScreen';
import CriarItemVotacaoScreen from '../screens/assembleia/CriarItemVotacaoScreen';

const Stack = createNativeStackNavigator();

export default function AssembleiaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AssembleiaList" component={AssembleiasScreen} />
      <Stack.Screen name="AssembleiaDetalhe" component={AssembleiaDetalheScreen} />
      <Stack.Screen name="AssembleiaSala" component={AssembleiaSalaScreen} />
      <Stack.Screen name="CriarAssembleia" component={CriarAssembleiaScreen} />
      <Stack.Screen name="Propostas" component={PropostasScreen} />
      <Stack.Screen name="CriarItemVotacao" component={CriarItemVotacaoScreen} />
    </Stack.Navigator>
  );
}
