// mobile/src/components/FiliadoCard.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Button } from 'react-native';
import { Filiado } from '../types/filiado';
import { UserProfile } from '../hooks/useAuth';
import { formatCpf, formatTelefone } from '../shared/format/formatters';
import { normalizeSituacaoFuncional } from '../utils/filiadoUtils';
import { calculateAgeBreakdown, formatISOToBRDateTime } from '../utils/date';

// Adicionando situacaoFuncional para refletir o modelo de dados completo.
interface FiliadoCardProps {
  filiado: Filiado & { situacaoFuncional?: string };
  currentUserProfile: UserProfile;
  onEdit: (filiado: Filiado) => void;
}

const FiliadoCard: React.FC<FiliadoCardProps> = ({ filiado, currentUserProfile, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(currentUserProfile);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const situacaoNormalizada = normalizeSituacaoFuncional(filiado.situacao_funcional || filiado.situacao);

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
  const isArquivado = !!filiado.arquivado_em;

  return (
    <TouchableOpacity style={[styles.card, getLeftBorderStyle(), isArquivado && styles.cardArquivado]} onPress={toggleExpand} activeOpacity={0.7}>
      <View style={styles.headerContainer}>
        <Image
          source={{ uri: filiado.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.infoContainer}>
          <View style={styles.nameAndBadgeContainer}>
            <Text style={styles.nome} numberOfLines={2}>{filiado.nome}</Text>
            <View style={[styles.situacao, getBadgeStyle()]}>
              <Text style={styles.situacaoText}>{situacaoLabel}</Text>
            </View>
          </View>
          <Text style={styles.lotacao}>Lotação: {filiado.lotacao || 'Não informada'}</Text>
          <Text style={styles.detalhe}>Telefone: {formatTelefone(filiado.telefone1) || '—'}</Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {isArquivado && isGestao && (
            <View style={styles.archiveDetails}>
              <Text style={styles.archiveTitle}>📋 Detalhes do arquivamento</Text>
              <Text style={styles.detalhe}>
                <Text style={styles.bold}>Arquivado por:</Text> {filiado.arquivado_por_nome || filiado.arquivado_por || '—'}
              </Text>
              <Text style={styles.detalhe}>
                <Text style={styles.bold}>Arquivado em:</Text> {formatISOToBRDateTime(filiado.arquivado_em)}
              </Text>
              <Text style={[styles.detalhe, { marginBottom: 10 }]}>
                <Text style={styles.bold}>Motivo:</Text> {filiado.arquivado_motivo || '—'}
              </Text>
            </View>
          )}

          {isGestao && (
            <>
              <Text style={styles.detalhe}>CPF: {formatCpf(filiado.cpf || '')}</Text>
              <Text style={styles.detalhe}>Email: {filiado.email1}</Text>
              <Text style={styles.detalhe}>Idade: {calculateAgeBreakdown(filiado.data_nascimento)}</Text>
            </>
          )}

          <View style={styles.footer}>
            {filiado.situacao && (
              <Text style={[styles.situacao, styles[`situacao${filiado.situacao.replace(/\s+/g, '')}`]]}>
                {filiado.situacao}
              </Text>
            )}
            <View style={styles.buttonContainerSpacer} />
            {isGestao && (
              <View style={styles.editButtonContainer}>
                <Button title="✏️ Editar" onPress={() => onEdit(filiado)} color="#003366" />
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(FiliadoCard);

const styles = StyleSheet.create({
  nomeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#eee',

    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderLeftWidth: 5,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoContainer: {
    flex: 1, // Permite que o container de info ocupe o espaço restante
  },
  nameAndBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap', // Permite que o badge quebre a linha se não houver espaço
  },
  nome: {
    fontSize: 16,
    fontWeight: '800',
    color: '#003366',
    flex: 1,
    marginRight: 8,
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
    marginLeft: 8,
  },
  situacaoText: {
    fontSize: 10,
    fontWeight: '800',
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
