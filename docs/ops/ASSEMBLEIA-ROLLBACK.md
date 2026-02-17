# ASSEMBLEIA - PLANO DE ROLLBACK

Este documento define os critérios e procedimentos para cancelamento ou reversão de atos em caso de falhas críticas.

## 1. Quando ativar o Rollback?

O rollback deve ser acionado pela Mesa Diretora ou pelo Administrador do Sistema nos seguintes casos:
- **Falha Sistêmica Comprovada:** Erro técnico que impeça o registro de votos de mais de 10% dos presentes.
- **Inconsistência de Quórum:** Divergência grave entre os presentes físicos/virtuais e o registro no banco de dados que comprometa a validade jurídica.
- **Indisponibilidade Prolongada:** Queda do sistema por mais de 30 minutos durante uma votação crítica.

## 2. O que é o Rollback?

**IMPORTANTE:** Rollback neste sistema NÃO significa apagar registros ou editar o banco de dados manualmente.

O procedimento padrão é:
1. **Encerrar a Assembleia:** Utilizar a função de encerramento imediato.
2. **Registrar Auditoria de Falha:** Documentar o motivo técnico/operacional no log de auditoria.
3. **Anulação do Item:** Se a falha ocorreu em um item específico, o Presidente deve declarar o item nulo e reiniciá-lo (se o sistema permitir) ou adiar a deliberação.
4. **Nova Convocação:** Caso a assembleia toda seja comprometida, deve-se seguir o estatuto para uma nova convocação.

## 3. Evidências Preservadas

Para garantir a segurança jurídica, os seguintes dados NUNCA são apagados:
- **Auditoria Append-Only:** Todos os logs de tentativas, erros e sucessos.
- **Logs de Servidor:** Registros com `request_id` para correlação técnica.
- **Snapshot de Estado:** O estado do sistema no momento da falha capturado pelo monitor de diagnóstico.
