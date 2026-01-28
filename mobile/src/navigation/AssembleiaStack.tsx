import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
    <Stack.Navigator screenOptions={{
      headerShown: true,
      headerTintColor: '#fff',
      headerStyle: { backgroundColor: '#003366' },
      headerTitleAlign: 'center',
    }}>
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
