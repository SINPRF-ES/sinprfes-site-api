# Jobs e Automações Backend

Este documento descreve os processos em segundo plano (jobs) e automações agendadas do sistema.

## 1. Notificação de Aniversariantes (`BIRTHDAY_SCAN`)

Responsável por identificar filiados que fazem aniversário no dia atual e enviar uma mensagem de congratulações.

### 1.1. Agendamento
- **Frequência:** Diário.
- **Horário:** 08:00 (America/Sao_Paulo).
- **Timezone:** O job utiliza explicitamente o fuso horário de Brasília para determinar o dia e a hora da execução, independentemente do horário do servidor (UTC).

### 1.2. Mecanismo de Lock (Execução Única)
Para garantir que o job rode exatamente uma vez por dia, mesmo em ambientes com múltiplos containers ou reinicializações frequentes (ex: Render/Heroku), utilizamos a tabela `job_runs` no PostgreSQL.

- **Fluxo:**
  1. O job inicia uma transação.
  2. Tenta adquirir um lock na linha correspondente a `BIRTHDAY_SCAN`.
  3. Verifica se o campo `last_run_date` é igual à data atual (DD/MM/AAAA).
  4. Se for igual, o job aborta a execução (`Skip`).
  5. Se for diferente, executa o envio, atualiza `last_run_date` e comita a transação.

### 1.3. Logs de Operação
- `BirthdayJobStart`: Início do processamento.
- `BirthdayJobEnd`: Conclusão com sucesso (inclui contagem de emails).
- `BirthdayJobSkipAlreadyRanToday`: Ignorado pois já foi executado hoje.
- `BirthdayJobError`: Falha crítica no processamento.

---

## 2. Configurações de Boot

Por padrão, jobs agendados **NÃO** devem rodar automaticamente na inicialização do servidor em ambientes de produção para evitar picos de carga ou duplicidade em escalas horizontais.

- **Variável de Ambiente:** `BIRTHDAY_SCAN_ON_BOOT=true` (Habilita execução forçada no boot, útil para testes).
