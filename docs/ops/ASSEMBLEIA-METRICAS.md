# ASSEMBLEIA - Indicadores Permanentes (Métricas)

Para cada assembleia realizada, os seguintes indicadores devem ser monitorados para garantir a saúde do sistema e a transparência do processo.

## 1. Métricas de Engajamento
- **Nº de Check-ins:** Total de filiados únicos que realizaram check-in.
- **Quórum Atingido:** Se o quórum necessário foi atingido na 1ª ou 2ª chamada.
- **Nº de Pedidos de Palavra:** Volume de interações durante os debates.

## 2. Métricas de Performance e Estabilidade
- **Nº de Reconexões:** Volume de eventos de reconexão reportados pelo app (Socket.IO).
- **Duração Média de Votação:** Tempo médio decorrido entre o início e o fim (manual ou automático) de uma votação.
- **Latência de Voto:** (Opcional) Tempo percebido entre o clique e a confirmação no painel.

## 3. Métricas de Qualidade dos Dados
- **% de Abstenção:** Percentual de filiados elegíveis que não votaram SIM nem NAO em cada item.
- **Erros por Tipo:** Contagem de erros técnicos (ex: falha de token, timeout de API) agrupados por tipo.

## 4. Diagnóstico Administrativo
Utilizar o endpoint `/api/assembleias/:id/diagnostico` durante o evento para monitorar sockets ativos e possíveis inconsistências de mesa ou quórum.
