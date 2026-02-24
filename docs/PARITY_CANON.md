# Canon de Paridade — Guardian Soft (SINPRF/ES)

## 1. Visão Geral
O **Canon de Paridade** é o conjunto de regras mandatórias que garantem a consistência funcional, visual e de dados entre o **App Mobile** e o **Site Institucional (Área do Filiado)**. O objetivo é evitar o "drift" (divergência) onde uma plataforma oferece recursos ou regras diferentes da outra.

## 2. Pilares da Paridade

### 2.1. Backend como Única Fonte da Verdade (SSOT)
- Nenhuma lógica de negócio, cálculo de valores, validação de permissão ou normalização de dados deve ser implementada exclusivamente no front-end.
- O App e o Site devem consumir os mesmos endpoints da API (`/api/*`).

### 2.2. Paridade Funcional
- Cada funcionalidade disponível no App deve ter seu equivalente no Site, e vice-versa, respeitando as permissões de acesso.
- Exceções permitidas: Recursos nativos de hardware (ex: Biometria, Push Notifications locais, GPS) podem ter implementações específicas, mas o resultado final (ex: login, recebimento de alertas) deve ser convergente.

### 2.3. Paridade Visual e UX
- A terminologia, emojis decorativos, fluxos de navegação e labels devem ser idênticos.
- O uso de `shared/canon.js` e `shared/format/` é obrigatório para garantir que máscaras e nomes de campos sejam os mesmos.

## 3. Regras de Sincronização

### 3.1. Versionamento e Deploy
- Mudanças em contratos de API devem ser testadas simultaneamente no App e no Site.
- O deploy de novas versões do Backend deve considerar a compatibilidade com versões anteriores do App (devido ao tempo de atualização nas lojas).

### 3.2. Tratamento de Erros
- Mensagens de erro disparadas pelo Backend devem ser exibidas de forma clara em ambas as plataformas, utilizando as strings definidas em `backend/src/utils/textos.js` quando possível.

### 3.3. Permissões
- O `roles.config.js` é o árbitro final. Se um botão é exibido no Site para um perfil X, ele deve ser exibido no App para o mesmo perfil X.

## 4. Governança
Qualquer PULL REQUEST que adicione uma funcionalidade a apenas uma das plataformas sem uma justificativa técnica aceitável (ex: recurso experimental ou específico de hardware) será reprovado sob o **Parity Mode**.
