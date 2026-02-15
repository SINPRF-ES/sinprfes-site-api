#!/bin/bash
set -e

echo "🚀 Iniciando verificação de ABI Split..."

# Garantir que estamos no diretório mobile
cd "$(dirname "$0")/.."

# 1. Rodar prebuild para gerar os arquivos nativos
echo "📦 Executando expo prebuild..."
pnpm exec expo prebuild --platform android --clean --no-install

# 2. Caminho do arquivo gerado
GRADLE_FILE="android/app/build.gradle"

if [ ! -f "$GRADLE_FILE" ]; then
    echo "❌ Erro: Arquivo $GRADLE_FILE não encontrado!"
    exit 1
fi

# 3. Verificar presença da configuração de splits
echo "🔍 Verificando configuração no build.gradle..."

# Usando grep para validar os requisitos do desafio
if ! grep -q "splits {" "$GRADLE_FILE"; then
    echo "❌ Erro: Bloco 'splits {' não encontrado no build.gradle."
    exit 1
fi

if ! grep -q "enable true" "$GRADLE_FILE"; then
    echo "❌ Erro: 'enable true' não encontrado dentro do bloco splits."
    exit 1
fi

if ! grep -q "reset()" "$GRADLE_FILE"; then
    echo "❌ Erro: 'reset()' não encontrado dentro do bloco splits."
    exit 1
fi

if ! grep -q "universalApk false" "$GRADLE_FILE"; then
    echo "❌ Erro: 'universalApk false' não encontrado no build.gradle."
    exit 1
fi

if ! grep -q "include \"armeabi-v7a\", \"arm64-v8a\"" "$GRADLE_FILE"; then
    echo "❌ Erro: Arquiteturas split (armeabi-v7a, arm64-v8a) não encontradas corretamente no build.gradle."
    exit 1
fi

# 4. Verificar otimizações de tamanho (via gradle.properties gerado pelo expo-build-properties)
echo "🔍 Verificando otimizações de tamanho (minify/shrink)..."
GRADLE_PROPS="android/gradle.properties"
if grep -q "android.enableMinifyInReleaseBuilds=true" "$GRADLE_PROPS" && \
   grep -q "android.enableShrinkResourcesInReleaseBuilds=true" "$GRADLE_PROPS"; then
    echo "✅ Otimizações de tamanho confirmadas no gradle.properties."
else
    echo "❌ Erro: Otimizações de tamanho não encontradas no gradle.properties."
    exit 1
fi

echo "✅ Verificação concluída com sucesso! ABI Split e otimizações estão configurados corretamente."
