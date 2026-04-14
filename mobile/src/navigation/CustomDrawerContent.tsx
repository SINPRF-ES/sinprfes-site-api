// mobile/src/navigation/CustomDrawerContent.tsx
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { isGestao as checkIsGestao, isDiretoria as checkIsDiretoria } from '../utils/filiadoUtils';
import { EMOJI } from '../constants/emojis';
import DrawerItemLabel from '../components/DrawerItemLabel';
import { COLORS } from '../theme/colors';

const SECTION_META = {
  principal: { title: 'Área do Filiado', emoji: '🏠', backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  servicos: { title: 'Serviços e Participação', emoji: '🧩', backgroundColor: 'rgba(0, 51, 102, 0.08)' },
  gestao: { title: 'Gestão', emoji: '🛠️', backgroundColor: 'rgba(0, 0, 0, 0.05)' },
} as const;

const NAV_STRUCTURE = [
  { key: 'inicio', routeName: 'Início', label: 'Página Inicial', emoji: EMOJI.HOME, section: 'principal', order: 10 },
  { key: 'meus-dados', routeName: 'MeusDados', label: 'Meus Dados', emoji: EMOJI.MEUS_DADOS, section: 'principal', order: 20 },
  { key: 'filiados', routeName: 'Filiados', label: 'Filiados', emoji: EMOJI.FILIADOS, section: 'principal', order: 30 },
  { key: 'informes', routeName: 'Noticias', label: 'Informes', emoji: EMOJI.NOTICIAS, section: 'principal', order: 40 },
  { key: 'aniversarios', routeName: 'Aniversarios', label: 'Aniversários', emoji: EMOJI.ANIVERSARIOS, section: 'principal', order: 45 },
  { key: 'publicacoes', routeName: 'Publicacoes', label: 'Publicações', emoji: EMOJI.PUBLICACOES, section: 'principal', order: 50 },
  { key: 'convenios', routeName: 'Convenios', label: 'Convênios', emoji: EMOJI.CONVENIOS, section: 'principal', order: 60 },
  { key: 'estatuto', routeName: 'Estatuto', label: 'Estatuto', emoji: EMOJI.ESTATUTO, section: 'principal', order: 70 },
  { key: 'seguranca', routeName: 'Seguranca', label: 'Segurança', emoji: EMOJI.SEGURANCA, section: 'principal', order: 80 },
  { key: 'atualizacoes', routeName: 'Atualizacoes', label: 'Atualizações', emoji: EMOJI.ATUALIZACOES, section: 'principal', order: 90 },
  { key: 'ressarcimento', routeName: 'Ressarcimento', label: 'Ressarcimento', emoji: EMOJI.RESSARCIMENTO, section: 'servicos', order: 100 },
  { key: 'assembleias', routeName: 'Votacao', label: 'Assembleias e Votações', emoji: EMOJI.ASSEMBLEIA, section: 'servicos', order: 110 },
  { key: 'enquetes', routeName: 'Enquetes', label: 'Enquetes', emoji: EMOJI.ENQUETES, section: 'servicos', order: 120 },
  { key: 'jogos', routeName: 'Jogos2026', label: 'Jogos 2026', emoji: EMOJI.JOGOS, section: 'servicos', order: 130 },
  { key: 'repasse', routeName: 'Repasse', label: 'Repasse', emoji: EMOJI.REPASSE, section: 'servicos', order: 140 },
  { key: 'consulta-processual', routeName: 'ConsultaProcessual', label: 'Consulta Processual', emoji: EMOJI.CONSULTA_PROCESSUAL, section: 'gestao', order: 150 },
  { key: 'estatisticas', routeName: 'Estatisticas', label: 'Estatísticas', emoji: EMOJI.ESTATISTICAS, section: 'gestao', order: 160 },
  { key: 'relatorios', routeName: 'Relatorios', label: 'Relatórios', emoji: EMOJI.RELATORIOS, section: 'gestao', order: 170 },
  { key: 'notificacoes', routeName: 'NotificacoesPush', label: 'Notificações', emoji: EMOJI.NOTIFICACOES, section: 'gestao', order: 180 },
  { key: 'novo-filiado', routeName: 'CriarFiliado', label: 'Novo Filiado', emoji: EMOJI.NOVO_FILIADO, section: 'gestao', order: 190 },
  { key: 'cms', routeName: 'CMSSite', label: 'Site (CMS)', emoji: EMOJI.CMS, section: 'gestao', order: 200 },
  { key: 'diagnostico', routeName: 'Logs', label: 'Diagnóstico', emoji: EMOJI.GESTAO, section: 'gestao', order: 210 },
] as const;

function formatarData(data: string) {
  if (!data) return '';
  // Formato esperado: YYYY-MM-DD...
  const parts = data.split('T')[0].split('-');
  if (parts.length !== 3) return data;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function maskTelefone(tel: string) {
  if (!tel) return '';
  const cleaned = tel.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return tel;
}

const CustomDrawerContent = (props) => {
  const { usuario, logout, setBloqueadoPorBiometria } = useAuth();
  const insets = useSafeAreaInsets();
  const ehGestao = checkIsGestao(usuario?.perfil_acesso);
  const ehDiretoria = checkIsDiretoria(usuario?.perfil_acesso);
  const currentRouteName = props.state?.routes?.[props.state.index]?.name;
  const routeSet = new Set((props.state?.routes || []).map((route) => route.name));

  const handleLogoutPress = () => {
    Alert.alert(
      'Sair da Conta',
      'Como deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair (Manter Biometria)',
          onPress: () => logout(false)
        },
        {
          text: 'Remover acesso deste aparelho',
          style: 'destructive',
          onPress: () => logout(true)
        },
      ]
    );
  };

  const groupedNavItems = NAV_STRUCTURE
    .filter((item) => routeSet.has(item.routeName))
    .filter((item) => {
      if (item.routeName === 'NotificacoesPush' || item.routeName === 'CriarFiliado') return ehGestao;
      if (item.routeName === 'Jogos2026') return ehGestao;
      if (item.routeName === 'Logs') return ehDiretoria;
      return true;
    })
    .sort((a, b) => a.order - b.order)
    .reduce((acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {} as Record<string, Array<typeof NAV_STRUCTURE[number]>>);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.drawerHeader}>
          <Image
            source={usuario.avatar_url ? { uri: usuario.avatar_url } : (usuario.fotoUrl ? { uri: usuario.fotoUrl } : require('../../assets/logo.png'))}
            style={styles.avatar}
          />

          <View style={styles.userInfo}>
            <Text style={styles.nome} numberOfLines={2}>
              {usuario.nome}
            </Text>

            {usuario.perfil_acesso && (
              <Text style={[styles.subInfo, styles.perfil]}>
                {String(usuario.perfil_acesso).toUpperCase()}
              </Text>
            )}

            {(usuario.situacao_funcional || usuario.situacao) && (
              <Text style={styles.subInfo}>
                ⚖️ {String(usuario.situacao_funcional || usuario.situacao).toUpperCase()}
              </Text>
            )}

            {usuario.telefone1 && (
              <Text style={styles.subInfo}>
                📞 {maskTelefone(usuario.telefone1)}
              </Text>
            )}

            {usuario.data_nascimento && (
              <Text style={styles.subInfo}>
                🎂 {formatarData(usuario.data_nascimento)}
              </Text>
            )}

            {usuario.lotacao && (
              <Text style={styles.subInfo}>
                📍 {usuario.lotacao}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.separator} />

      <View style={styles.listContainer}>
        {(Object.keys(SECTION_META) as Array<keyof typeof SECTION_META>).map((sectionKey) => {
          const sectionItems = groupedNavItems[sectionKey] || [];
          if (!sectionItems.length) return null;

          const sectionMeta = SECTION_META[sectionKey];
          return (
            <View key={sectionKey} style={[styles.sectionBlock, { backgroundColor: sectionMeta.backgroundColor }]}>
              <Text style={styles.sectionHeader}>{sectionMeta.emoji} {sectionMeta.title}</Text>
              {sectionItems.map((item) => {
                const isFocused = currentRouteName === item.routeName;
                return (
                  <DrawerItem
                    key={item.key}
                    focused={isFocused}
                    activeTintColor={COLORS.prfBlue}
                    inactiveTintColor={COLORS.text}
                    activeBackgroundColor="rgba(0, 51, 102, 0.12)"
                    label={(labelProps) => <DrawerItemLabel emoji={item.emoji} label={item.label} {...labelProps} />}
                    onPress={() => props.navigation.navigate(item.routeName as never)}
                  />
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={styles.separator} />

      <View style={styles.closeAppContainer}>
        <TouchableOpacity
          style={styles.closeAppButton}
          onPress={() => setBloqueadoPorBiometria(true)}
        >
          <Text style={styles.closeAppButtonText}>{EMOJI.FECHAR_APP} Fechar App</Text>
        </TouchableOpacity>
      </View>

        <DrawerItem
          label={(props) => <DrawerItemLabel emoji={EMOJI.SAIR} label="Sair da conta" {...props} />}
          onPress={handleLogoutPress}
          inactiveTintColor="#666"
        />
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawerContent: {
    paddingTop: 0,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf3ff',
    borderBottomWidth: 1,
    borderBottomColor: '#c7def6',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  nome: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  subInfo: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  perfil: {
    fontWeight: '700',
    color: COLORS.prfBlue,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  listContainer: {
    paddingTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 10,
  },
  sectionHeader: {
    fontWeight: '800',
    color: COLORS.prfBlue,
    marginLeft: 16,
    marginTop: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  sectionBlock: {
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
  },
  closeAppContainer: {
    paddingHorizontal: 15,
    marginVertical: 10,
  },
  closeAppButton: {
    backgroundColor: COLORS.prfBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  closeAppButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default CustomDrawerContent;
