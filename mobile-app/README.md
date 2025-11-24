# 📱 BSL Paciente - App Móvil con Twilio Video

Aplicación móvil React Native con Expo para que los pacientes llamen al médico con **videollamadas reales usando Twilio Video SDK nativo**.

## ✨ Características

✅ **Videollamadas Reales** - Twilio Video SDK nativo integrado
✅ **Socket.IO** - Notificaciones en tiempo real
✅ **Controles de Video** - Mute, cámara on/off, flip camera
✅ **UI Minimalista** - Botón grande y fácil de usar
✅ **Permisos Nativos** - Manejo automático de permisos

## 🚀 Inicio Rápido

### 1. Instalar Expo Go en tu celular

**Android**: https://play.google.com/store/apps/details?id=host.exp.exponent

**iOS**: https://apps.apple.com/app/expo-go/id982107779

### 2. Instalar dependencias

```bash
# Asegúrate de estar en la carpeta mobile-app
cd mobile-app

# Instalar dependencias
npm install
```

### 3. Configurar servidor

Edita `config.js`:

```javascript
export const config = {
  // Para desarrollo local (mismo WiFi)
  SERVER_URL: 'http://TU_IP_LOCAL:3001',

  // Para producción
  // SERVER_URL: 'https://tu-app.ondigitalocean.app',
};
```

**Encontrar tu IP:**
```bash
# Mac/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows:
ipconfig
```

### 4. Iniciar en modo desarrollo

```bash
# Iniciar Expo
npx expo start
```

### 5. Escanear QR

- **Android**: Abre Expo Go → Escanea QR
- **iOS**: Abre Cámara → Escanea QR → Abre en Expo Go

## 🎥 Funcionalidades de Video

La app incluye videollamadas completas con:

- 📹 **Video bidireccional** - Ver y ser visto por el médico
- 🎤 **Audio bidireccional** - Hablar y escuchar
- 🔇 **Mute/Unmute** - Control de micrófono
- 📷 **Video on/off** - Apagar cámara si es necesario
- 🔄 **Flip camera** - Cambiar entre cámara frontal/trasera
- 📞 **Finalizar llamada** - Terminar videollamada

## 📦 Build para Producción

### Requisitos Previos

1. **Instalar EAS CLI:**
```bash
npm install -g eas-cli
```

2. **Login en Expo:**
```bash
npx expo login
```

### Build Development (para testing)

```bash
# Configurar EAS (solo la primera vez)
eas build:configure

# Build para Android (APK)
eas build --profile development --platform android

# Build para iOS (requiere Mac y cuenta de desarrollador)
eas build --profile development --platform ios
```

### Build Production

```bash
# Android APK/AAB
eas build --platform android

# iOS (requiere cuenta Apple Developer)
eas build --platform ios
```

**Nota:** El build de producción requiere compilación nativa porque usa `react-native-twilio-video-webrtc`. No funcionará con Expo Go, solo con builds compilados.

## 🔧 Desarrollo

### Estructura del Proyecto

```
mobile-app/
├── App.js                    # Componente principal con Twilio Video
├── config.js                 # Configuración del servidor
├── app.json                  # Configuración de Expo y plugins
├── package.json              # Dependencias
└── assets/                   # Imágenes y recursos
```

### Dependencias Principales

- **react-native-twilio-video-webrtc** - SDK nativo de Twilio Video
- **socket.io-client** - Comunicación en tiempo real
- **expo-camera** - Permisos de cámara
- **expo-av** - Permisos de audio
- **expo-build-properties** - Configuración nativa

### Comandos Útiles

```bash
# Iniciar con cache limpio
npx expo start -c

# Ver en simulador (si está instalado)
npx expo start --ios
npx expo start --android

# Ver logs
npx expo start --dev-client

# Actualizar dependencias
npm update
```

## ⚙️ Configuración Avanzada

### iOS Deployment Target

La app requiere iOS 11.0 o superior (configurado en app.json).

### Android Min SDK

Android requiere minSdkVersion 21 (Android 5.0+).

### Permisos

Configurados automáticamente:
- CAMERA
- RECORD_AUDIO
- INTERNET
- MODIFY_AUDIO_SETTINGS

## 🐛 Solución de Problemas

### "No se conecta al servidor"

✅ Verifica que servidor esté corriendo: `curl http://localhost:3001/health`
✅ Usa tu IP local, no localhost
✅ Asegúrate de estar en la misma red WiFi

### "El video no se muestra"

✅ Verifica permisos de cámara/micrófono
✅ Revisa logs: `npx expo start` (ver errores en consola)
✅ Asegúrate de que el médico también esté conectado

### "Error: Task ':react-native-twilio-video-webrtc:...' "

Esto es normal en Expo Go. Para probar video real necesitas:
```bash
eas build --profile development --platform android
```

### "No funciona en Expo Go"

**Correcto.** Twilio Video requiere módulos nativos que no están en Expo Go.

**Opciones:**
1. **Development Build**: `eas build --profile development` (recomendado)
2. **Prebuild**: `npx expo prebuild` → Android Studio/Xcode

## 📱 Testing en Dispositivo Real

### Opción 1: Development Build (Recomendado)

```bash
# Build e instalar en tu dispositivo
eas build --profile development --platform android
eas build --profile development --platform ios

# Después de instalar, ejecuta:
npx expo start --dev-client
```

### Opción 2: Local Build

```bash
# Generar archivos nativos
npx expo prebuild

# Android
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk

# iOS (requiere Mac)
cd ios && pod install
# Abrir en Xcode y ejecutar
```

## 🌐 Deploy en Stores

### Google Play Store

```bash
# Build AAB para Play Store
eas build --platform android --profile production

# Submit a Google Play
eas submit --platform android
```

### Apple App Store

```bash
# Build para App Store (requiere cuenta Apple Developer $99/año)
eas build --platform ios --profile production

# Submit a App Store
eas submit --platform ios
```

## 📚 Documentación de Referencia

### Twilio Video SDK
- [GitHub oficial](https://github.com/blackuy/react-native-twilio-video-webrtc)
- [npm package](https://www.npmjs.com/package/react-native-twilio-video-webrtc)
- [Twilio Video Docs](https://www.twilio.com/docs/video)

### Expo
- [Expo Docs](https://docs.expo.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Config Plugins](https://docs.expo.dev/config-plugins/introduction/)

## 🔒 Seguridad

- Los tokens de Twilio se generan en el backend (no expuestos en el cliente)
- La comunicación Socket.IO usa WebSocket seguro en producción
- Los videos no se graban ni almacenan (solo transmisión en vivo)

## 🎯 Próximos Pasos

1. ✅ Probar en development build
2. 📸 Agregar captura de pantalla durante llamada
3. 📊 Métricas de calidad de llamada
4. 💬 Chat de texto como complemento
5. 📝 Historial de llamadas
6. 🔔 Notificaciones push cuando médico está disponible

## 🆘 Soporte

- **Issues**: Abre un issue en GitHub
- **Expo Forum**: https://forums.expo.dev/
- **Twilio Support**: https://support.twilio.com/

---

## 📝 Notas de Implementación

Esta app usa el SDK nativo de Twilio Video (`react-native-twilio-video-webrtc`), que proporciona:

- ✅ Mejor rendimiento que WebRTC en navegador
- ✅ Menor latencia
- ✅ Mejor manejo de recursos
- ✅ Soporte nativo para iOS y Android

**Limitación:** Requiere build nativo (no funciona con Expo Go en desarrollo).

**Solución:** Usa EAS Development Build para testing en desarrollo.
