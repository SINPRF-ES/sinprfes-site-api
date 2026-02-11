# FENAPRF MASTER - Regras de Negócio e Domínio

Este documento define as regras institucionais e de domínio do sistema FENAPRF.

## Glossário

- **Membro**: Usuário do sistema, podendo ser da Diretoria, Conselho ou Colaborador.
- **Vínculo**: Relação de um membro com uma entidade (FENAPRF Nacional ou Sindicato Estadual).
- **Assembleia**: Evento deliberativo oficial.
- **Quórum**: Quantidade mínima de membros presentes para validade de atos.
- **Token**: Código alfanumérico de 10 caracteres usado para credenciamento.

## Estados e Ciclos de Vida

### Membro (users)
- **ATIVO**: Cadastro regular e funcional.
- **ARQUIVADO**: Cadastro inativo (histórico preservado). Não pode logar.

### Assembleia (assembleias)
1. **CRIADO**: Registro inicial com Edital.
2. **EM_CREDENCIAMENTO**: Sala aberta para entrada de membros (QR Global ativo).
3. **INICIADO**: Mesa definida e pauta em execução.
4. **SUSPENSA**: Pausa temporária por motivo justificado.
5. **ENCERRADO**: Finalização definitiva com geração de ATA.

## Credenciamento e Quórum

### QR Code Global
- Responsável pela entrada do membro na Assembleia.
- **Não possui validade temporal** (expira apenas quando a assembleia é encerrada ou uma recontagem é solicitada).
- Apenas um QR Global ativo por assembleia.

### Quórum de Votação (Snapshots)
- Gerado no momento de iniciar uma votação ou recontagem específica.
- **Possui validade temporal** (ex.: 10 minutos).
- Serve para garantir que apenas quem estava presente no momento da chamada possa votar naquele item.

## Estrutura Funcional (UF × Branch)

O sistema utiliza a **UF** como principal elo funcional.
- **FENAPRF Nacional**: Escopo NACIONAL (UF='BR').
- **Sindicatos Estaduais**: Escopo UF (ex.: SP, RJ).
- **Branches**:
    - **DIRETORIA**: Membros eleitos com cargos executivos.
    - **DELEGACAO**: Delegados representantes e substitutos.

## Auditoria e Movimentações

Todas as ações críticas (arquivamento, definição de mesa, votações) são registradas em tabelas de auditoria específicas ou na trilha de `user_movimentacoes`.
A exclusão física de registros é evitada em favor de `ON DELETE SET NULL` para preservar a integridade da trilha histórica.
