#!/usr/bin/env bash

set -eox pipefail

echo "🔧 Removiendo bitcode de frameworks después de instalar dependencias..."

# Ejecutar el script de remoción de bitcode
bash ./scripts/remove-bitcode.sh

echo "✅ Hook post-install completado"
