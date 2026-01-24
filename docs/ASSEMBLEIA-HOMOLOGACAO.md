# Roteiro de Homologação Institucional - Módulo de Assembleias

Este documento define o roteiro obrigatório de validação para a liberação do sistema de Assembleias e Votações do SINPRF-ES.

## 1. Objetivo
Validar se o sistema atende aos requisitos do estatuto e à segurança jurídica necessária para a realização de assembleias gerais.

## 2. Perfis Envolvidos
- **Presidente/Diretoria:** Comando da sessão.
- **Filiados:** Participantes votantes.
- **Observador:** Auditores ou perfil técnico.

## 3. Passo a Passo da Homologação

### Fase 1: Preparação
1.  [ ] Criar assembleia no sistema (Perfil Diretor).
2.  [ ] Verificar se o evento aparece na listagem para todos os perfis.

### Fase 2: Credenciamento (Abertura)
3.  [ ] Diretor aciona comando "Abrir Assembleia".
4.  [ ] Sistema gera token de 6 dígitos.
5.  [ ] Filiados inserem o token e realizam check-in.
6.  [ ] Validar se o contador de presentes atualiza em tempo real.

### Fase 3: Composição da Mesa
7.  [ ] Diretor escolhe o Presidente e o Secretário da mesa entre os presentes.
8.  [ ] Validar se apenas os que fizeram check-in aparecem na lista de escolha.

### Fase 4: Execução (Deliberações)
9.  [ ] Presidente aciona "Iniciar Execução" (Fase 3).
10. [ ] Presidente inicia um item de votação (ex: "Aprovação de Ata").
11. [ ] Filiados votam (SIM/NÃO).
12. [ ] Validar se o voto nominal aparece em tempo real.
13. [ ] Realizar uma "Recontagem" (Presidente).
14. [ ] Verificar se todos os check-ins anteriores foram invalidados.
15. [ ] Realizar novo check-in e novo item de votação.

### Fase 5: Encerramento e Relatório
16. [ ] Presidente encerra a assembleia.
17. [ ] Tentar realizar um voto após encerramento (deve ser bloqueado).
18. [ ] Gestor solicita o relatório da assembleia.
19. [ ] Verificar se os códigos de rastreabilidade (Request ID / Auth Code) foram gerados.

## 4. Checklist de Aceite
- ( ) O sistema é intuitivo para o filiado?
- ( ) Os votos foram registrados corretamente?
- ( ) A auditoria registrou todos os passos?

## 5. Aprovação
Nome: ___________________________________
Cargo: __________________________________
Data: ____/____/2026
Assinatura: _____________________________
