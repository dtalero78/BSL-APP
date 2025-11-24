#!/bin/bash

# Script para remover bitcode de frameworks precompilados
# Necesario porque Apple ya no acepta bitcode desde Xcode 14

set -e

echo "🔧 Removiendo bitcode de frameworks..."

# Buscar el framework de Twilio en node_modules
TWILIO_FRAMEWORK="node_modules/react-native-twilio-video-webrtc/ios/TwilioVideo.framework/TwilioVideo"

if [ -f "$TWILIO_FRAMEWORK" ]; then
    echo "📦 Encontrado TwilioVideo framework"

    # Usar xcrun para remover el bitcode
    if command -v xcrun &> /dev/null; then
        echo "🔨 Removiendo bitcode con xcrun..."
        xcrun bitcode_strip "$TWILIO_FRAMEWORK" -r -o "$TWILIO_FRAMEWORK"
        echo "✅ Bitcode removido exitosamente"
    else
        echo "⚠️  xcrun no disponible, el bitcode no se pudo remover"
        echo "   Esto es normal si estás en Linux/Windows"
        echo "   EAS Build lo manejará en la nube"
    fi
else
    echo "⚠️  Framework de Twilio no encontrado en: $TWILIO_FRAMEWORK"
fi

echo "✨ Script completado"
