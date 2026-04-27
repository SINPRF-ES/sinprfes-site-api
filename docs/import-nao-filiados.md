# Importação de PRFs Não Filiados (SINPRF-ES)

## Modelo de planilha
Use **CSV (recomendado)** ou XLSX com cabeçalho na primeira linha.

Campos aceitos:
- `nome` (**obrigatório**)
- `cpf` (opcional)
- `matricula` (opcional; mapeada para `siape` no schema atual)
- `email` (opcional)
- `telefone` (opcional)
- `lotacao` (opcional, quando a coluna existir no banco)

Exemplo CSV:

```csv
nome,cpf,matricula,email,telefone,lotacao
Maria Exemplo,12345678901,1234567,maria@email.com,27999998888,SEDE
José Sem Documento,,,,,
```

## Comando
Importação real:

```bash
node backend/scripts/import-nao-filiados.js ./nao-filiados.csv
```

Simulação (sem persistir):

```bash
node backend/scripts/import-nao-filiados.js ./nao-filiados.csv --dry-run
```

## Cuidados
- O script **não sobrescreve** registros existentes.
- Duplicidade:
  - com CPF já existente: linha é ignorada;
  - com matrícula/SIAPE já existente: linha é ignorada;
  - sem CPF e sem matrícula: pode sinalizar possível duplicidade por nome (apenas aviso).
- Todos os registros entram com `situacao_sindical = NAO_FILIADO` (editável depois por gestão, quando aplicável).
- O fluxo do backend mantém `NAO_FILIADO` e `FILIADO_OUTRO_SINDICATO` sem login, fora de assembleias e fora de push coletivo.
- Para `FILIADO_OUTRO_SINDICATO`, a UF externa (`uf_sindicato_externo`) deve ser UF brasileira válida e diferente de `ES`.


## Cadastro manual (sem importação)

Além do script de importação, o cadastro também pode ser feito manualmente nas telas de gestão (site/app) com classificação sindical explícita:

- `NAO_FILIADO`
- `FILIADO_OUTRO_SINDICATO` (com `uf_sindicato_externo`)

Isso permite incluir pessoas para fins de relatórios e estatísticas sem tratá-las como filiadas efetivas do SINPRF/ES.

## Exemplo de execução

```bash
node backend/scripts/import-nao-filiados.js ./dados/nao-filiados.csv --dry-run
```

Saída resumida esperada:
- total de linhas lidas;
- total importado;
- total ignorado por duplicidade;
- total inválido;
- erros/avisos por linha.
