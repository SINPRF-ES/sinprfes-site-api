# Revisão do trabalho do Jules — CMS Notícias / Editar Início

## Resultado geral
**Atendido parcialmente.**

O trabalho resolve partes centrais (fonte de dados do CMS Home, rotação editorial no backend, URL pública estável e renderização da notícia atual), mas **não cumpre integralmente** os requisitos do prompt original.

## O que foi atendido
1. **Causa raiz do descompasso CMS x Site foi corrigida**: a Home no CMS deixou de usar `content_blocks` e passou a consumir `/api/noticias` filtrando notícia `ATUAL` de audiência `PUBLICA`.
2. **Rotação editorial** no backend: ao criar nova notícia, as atuais da mesma audiência são arquivadas e a nova entra como `ATUAL`.
3. **URL pública estável (`public_ref`)**: geração com timestamp + slug e sem regeneração quando já existe.
4. **Home pública mantém o bloco de notícia e bloco de Instagram em ordem (notícia em cima, Instagram abaixo)**.

## Pendências e desvios relevantes
1. **Fluxo com zero notícia atual ficou quebrado no CMS Home**
   - Em `renderBlocks`, se não houver blocos/notícias, a função retorna antes de renderizar a toolbar.
   - Consequência: o botão **"+ Incluir nova notícia" não aparece** quando mais é necessário.

2. **Tela de Editar Início ainda pode renderizar mais de um card**
   - O CMS mapeia todas as notícias retornadas e faz `forEach` para renderizar cards.
   - Sem `LIMIT 1` no fetch da Home do CMS e sem truncar localmente, dados legados inconsistentes ainda podem gerar múltiplos cards, contrariando o requisito estrito de "apenas um único card".

3. **Regra de fotos foi reduzida para apenas `capa_url` no fluxo da Home**
   - O requisito pedia edição de "fotos" (plural) com contrato do módulo.
   - No Home CMS ficou apenas campo de URL da capa; não há interface para gerenciar coleção de mídias (`noticia_midias`) nesse fluxo.

4. **Paridade 1:1 com app não foi demonstrada de forma verificável no código/testes**
   - Não há artefato de validação cruzada com o app (checklist técnico, teste de contrato compartilhado, ou mudanças coordenadas no app).

## Conclusão objetiva
A entrega do Jules **melhora bastante** e elimina o principal desvio estrutural (CMS Home vs `noticias`), mas **não encerra o prompt como 100% atendido** devido às lacunas acima (principalmente criação quando não existe notícia atual e garantia rígida de card único no CMS).
