# Regras de Negócio - Módulo Assembleia

Este documento descreve as regras de negócio obrigatórias para o funcionamento das assembleias no ecossistema FENAPRF.

## 1. Check-in e Quórum
- **Check-in Global:** O sistema deve suportar um Check-in Global persistente por evento (via QR Code ou Token Global), permitindo que os membros registrem sua presença antecipadamente.
- **Contagem de Quórum:** O quórum é calculado em tempo real com base nos check-ins ativos.
- **Exibição em Tempo Real:** O estado do quórum deve ser visível para todos os participantes na sala de votação.

## 2. Direitos de Voto e Hierarquia
- **Votos por UF:** Cada Unidade Federativa (UF) possui o direito a 2 votos deliberativos.
- **Distribuição por Branch:** Os 2 votos são divididos entre os dois branches (Conselheiros e Delegação), sendo 1 voto para cada branch.
- **Hierarquia de Substituição:** Dentro de cada branch, existe uma hierarquia (Ex: Presidente > Vice-Presidente no branch Conselheiros).
    - Se o titular estiver presente, ele detém o voto.
    - Se o titular estiver ausente, o substituto imediato assume o direito de voto.
    - Caso o titular entre na sessão após o substituto ter realizado uma ação (como uma proposta), o titular deve confirmar ou cancelar tal ação (Lógica de Branch Confirmation).

## 3. Dinâmica das Sessões
- **Abertura e Mesa Diretora:** A sessão inicia com a indicação da Mesa Diretora composta por 4 membros (Presidente, Vice-Presidente, 1º Secretário e 2º Secretário).
    - Membros rejeitados em uma votação para um cargo específico podem ser indicados para outros cargos e votados novamente.
- **Pedir Palavra:** Sistema de fila para oradores, controlado pela Mesa Diretora.
- **Encaminhamento de Propostas:** Membros podem encaminhar propostas para votação (SIM ou NÃO).
- **Justificativa de Ausência:** Membros ausentes devem ter a possibilidade de justificar sua ausência no sistema.

## 4. Votação de Itens
- **Duração:** Cada item de pauta lançado para votação tem uma duração padrão de 2 minutos.
- **Alteração de Voto:** Enquanto a votação estiver aberta, o membro pode alterar seu voto.
- **Encerramento Antecipado:** Se todos os membros aptos (conforme o quórum) realizarem o voto antes do tempo expirar, a votação é encerrada automaticamente.
- **Regra de Omissão (Não Votar = SIM):** Caso um membro presente no quórum não registre seu voto manualmente até o encerramento da votação, o sistema deve computar seu voto automaticamente como **SIM**.

## 5. Auditoria
- Todas as ações (check-ins, votos, mudanças de estado, composições de mesa) devem ser registradas em logs imutáveis de auditoria.
