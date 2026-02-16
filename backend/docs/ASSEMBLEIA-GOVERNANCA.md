# Governança e Responsabilidades - Módulo de Assembleias

Este documento estabelece as regras de operação e as responsabilidades sobre o sistema de votação digital do SINPRF-ES.

## 1. Atribuições de Perfis

- **DIRETORIA:**
    - Responsável pela abertura e encerramento administrativo da assembleia.
    - Autorizada a definir a composição da mesa diretora.
    - Responsável por garantir que o edital esteja anexado corretamente.

- **PRESIDENTE DA MESA:**
    - Responsável por iniciar e encerrar cada item de votação.
    - Autorizado a solicitar recontagem (invalidação de quórum) em caso de drift de conexão ou segurança.
    - Responsável pela ordem cronológica das deliberações.

- **ADMIN/SUPORTE TÉCNICO:**
    - Responsável pela manutenção da infraestrutura (Socket.IO, Banco de Dados).
    - Não possui poder de voto ou interferência no quórum.

## 2. Procedimentos de Contingência

- **Queda de Internet (Presidente):** Se a mesa cair, o Secretário ou outro Diretor presente deve assumir o comando. O sistema preserva o estado (reidratação automática).
- **Queda de Internet (Filiado):** O filiado pode reconectar e o sistema restaurará seu status de check-in e voto, desde que a votação ainda esteja ativa.
- **Questionamento Jurídico:** Em caso de dúvida sobre um resultado, a tabela `assembleia_auditoria` deve ser exportada. Ela contém cada voto e cada mudança de estado com timestamp e requestId.

## 3. Retenção de Dados

- **Logs de Auditoria:** Devem ser mantidos por no mínimo 5 anos.
- **Relatórios:** Não são armazenados no servidor por segurança; devem ser mantidos em cópias físicas ou em serviços de armazenamento seguro do sindicato.

## 4. Localização da Verdade
Em caso de divergência entre a interface do aplicativo e o banco de dados, prevalece o registro do **Banco de Dados (Backend)**.
