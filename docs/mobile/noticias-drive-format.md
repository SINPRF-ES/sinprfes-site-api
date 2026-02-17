# Formato de Notícias via Google Drive

Para criar uma nova notícia que apareça no aplicativo, siga a estrutura abaixo no Google Drive.

## Localização
As notícias devem ser criadas dentro da pasta: `Publicações/Noticias/`.

## Estrutura de cada Notícia
Cada notícia deve ser uma subpasta dentro de `Noticias/`. O nome da pasta pode ser o "slug" da notícia (ex: `2026-04-join-prf`).

Dentro da pasta da notícia:

1.  **post.json** (Obrigatório): Contém os metadados e o texto da notícia.
2.  **cover.jpg** ou **cover.png** (Opcional): Imagem de capa que aparecerá na listagem e no topo do detalhe.
3.  **gallery/** (Opcional): Subpasta contendo imagens adicionais que serão exibidas em um carrossel.

## Formato do post.json

O arquivo deve ser um JSON válido com a seguinte estrutura:

```json
{
  "id": "slug-da-noticia",
  "title": "Título da Notícia",
  "summary": "Resumo curto que aparece na listagem.",
  "publishedAt": "2026-01-29T00:00:00-03:00",
  "bodyMarkdown": "Conteúdo completo em **Markdown**.\n\nAceita formatação básica.",
  "tags": ["tag1", "tag2"]
}
```

## Recomendações
- Use imagens de boa qualidade para a capa.
- O campo `publishedAt` define a ordem de exibição (mais recentes primeiro).
- O `id` no JSON deve preferencialmente ser igual ao nome da pasta.
