// mobile/src/components/UserCard.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Button } from 'react-native';
import { User, UserProfile } from '../types/user';
import { formatCpf, formatTelefone } from '../shared/format/formatters';
import { normalizeSituacaoFuncional, getBandeiraUF } from '../utils/userUtils';
import { calculateAgeBreakdown, formatISOToBRDateTime } from '../utils/date';

// Adicionando situacaoFuncional para refletir o modelo de dados completo.
interface UserCardProps {
  user: User & { situacaoFuncional?: string };
  currentUserProfile: UserProfile;
  onEdit: (user: User) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, currentUserProfile, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(currentUserProfile);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const situacaoNormalizada = normalizeSituacaoFuncional(user.situacao_funcional || user.situacao);

  const getBadgeStyle = () => {
    switch (situacaoNormalizada) {
      case 'ATIVO':
        return styles.situacaoATIVO;
      case 'VETERANO':
        return styles.situacaoVETERANO;
      case 'PENSIONISTA':
        return styles.situacaoPENSIONISTA;
      default:
        return styles.situacaoDefault;
    }
  };

  const getLeftBorderStyle = () => {
    switch (situacaoNormalizada) {
      case 'ATIVO':
        return { borderLeftColor: '#27ae60' };
      case 'VETERANO':
        return { borderLeftColor: '#f39c12' };
      case 'PENSIONISTA':
        return { borderLeftColor: '#e91e63' };
      default:
        return { borderLeftColor: '#95a5a6' };
    }
  };

  const situacaoLabel = situacaoNormalizada || 'NÃO INFORMADO';
  const isArquivado = !!user.arquivado_em;

  return (
    <TouchableOpacity style={[styles.card, getLeftBorderStyle(), isArquivado && styles.cardArquivado]} onPress={toggleExpand} activeOpacity={0.7}>
      <View style={styles.headerContainer}>
        <Image
          source={{ uri: user.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.infoContainer}>
          <View style={styles.nameAndBadgeContainer}>
            <Text style={styles.nome} numberOfLines={2}>{user.name}</Text>
            <View style={[styles.situacao, getBadgeStyle()]}>
              <Text style={styles.situacaoText}>{situacaoLabel}</Text>
            </View>
          </View>
          <Text style={styles.lotacao}>Lotação: {user.lotacao || 'Não informada'}</Text>
          <Text style={styles.detalhe}>Telefone: {formatTelefone(user.telefone1) || '—'}</Text>
        </View>
        <View style={styles.ufStack}>
          <Text style={styles.ufText}>{user.perfil_acesso === 'DIRETORIA' || user.perfil_acesso === 'COLABORADOR' ? 'BR' : (user.uf || '—')}</Text>
          {getBandeiraUF(user.uf, user.perfil_acesso) ? (
            <Image source={{ uri: getBandeiraUF(user.uf, user.perfil_acesso) }} style={styles.flagIcon} />
          ) : null}
        </View>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {isArquivado && isGestao && (
            <View style={styles.archiveDetails}>
              <Text style={styles.archiveTitle}>📋 Detalhes do arquivamento</Text>
              <Text style={styles.detalhe}>
                <Text style={styles.bold}>Arquivado por:</Text> {user.arquivado_por_nome || user.arquivado_por || '—'}
              </Text>
              <Text style={styles.detalhe}>
                <Text style={styles.bold}>Arquivado em:</Text> {formatISOToBRDateTime(user.arquivado_em)}
              </Text>
              <Text style={[styles.detalhe, { marginBottom: 10 }]}>
                <Text style={styles.bold}>Motivo:</Text> {user.arquivado_motivo || '—'}
              </Text>
            </View>
          )}

          {isGestao && (
            <>
              <Text style={styles.detalhe}>CPF: {formatCpf(user.cpf || '')}</Text>
              <Text style={styles.detalhe}>Email: {user.email}</Text>
              <Text style={styles.detalhe}>Idade: {calculateAgeBreakdown(user.data_nascimento)}</Text>
            </>
          )}

          <View style={styles.footer}>
            {user.situacao && (
              <Text style={[styles.situacao, styles[`situacao${user.situacao.replace(/\s+/g, '')}`]]}>
                {user.situacao}
              </Text>
            )}
            <View style={styles.buttonContainerSpacer} />
            {isGestao && (
              <View style={styles.editButtonContainer}>
                <Button title="✏️ Editar" onPress={() => onEdit(user)} color="#003366" />
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(UserCard);

const styles = StyleSheet.create({
  nomeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    borderLeftWidth: 5,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Garante alinhamento vertical
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  infoContainer: {
    flex: 1, // Permite que o container de info ocupe o espaço restante
  },
  ufStack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    minWidth: 40,
  },
  ufText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
  },
  flagIcon: {
    width: 24,
    height: 16,
    borderRadius: 2,
  },
  nameAndBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap', // Permite que o badge quebre a linha se não houver espaço
  },
  nome: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1, // Faz o nome ocupar o espaço e quebrar a linha
    marginRight: 8, // Espaçamento entre o nome e o badge
  },
  lotacao: {
    fontSize: 14,
    color: '#666',
  },
  detalhe: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
  cardArquivado: {
    backgroundColor: '#f8f9fa',
    borderLeftColor: '#6c757d',
  },
  archiveDetails: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ffeeba',
  },
  archiveTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 5,
  },
  expandedContent: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  editButtonContainer: {
    // Adicionado para alinhar o botão
  },
  buttonContainerSpacer: {
    flex: 1,
  },
  situacao: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  situacaoText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  situacaoATIVO: {
    backgroundColor: '#27ae60', // Verde
  },
  situacaoVETERANO: {
    backgroundColor: '#f39c12', // Amarelo
  },
  situacaoPENSIONISTA: {
    backgroundColor: '#e91e63', // Rosa
  },
  situacaoDefault: {
    backgroundColor: '#95a5a6', // Cinza
  },
});
