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
- Todos os registros entram com `situacao_sindical = NAO_FILIADO`.
- O fluxo já existente no backend mantém `NAO_FILIADO` sem login, fora de assembleias e fora de push coletivo.

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
