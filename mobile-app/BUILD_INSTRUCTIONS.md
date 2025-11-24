# 🏗️ Instrucciones de Build - App Móvil BSL

Guía paso a paso para compilar la app móvil con Twilio Video nativo.

## ⚠️ Nota Importante

Esta app usa **Twilio Video SDK nativo** (`react-native-twilio-video-webrtc`), que requiere **compilación nativa**.

**NO funcionará con Expo Go** (la app de desarrollo rápido).

Necesitas hacer un **build nativo** para probar las videollamadas.

## 🎯 Opciones de Build

### 1. EAS Build (Recomendado) ✅

**Ventajas:**
- Build en la nube (no necesitas Mac para iOS)
- Más fácil y rápido
- Maneja automáticamente certificados y provisioning

**Desventajas:**
- Requiere cuenta de Expo
- Límite de builds gratuitos

### 2. Local Build

**Ventajas:**
- Ilimitados builds
- No requiere internet para compilar

**Desventajas:**
- Requiere Android Studio o Xcode
- Más configuración manual
- Para iOS necesitas Mac

---

## 📦 Opción 1: EAS Build (Recomendado)

### Paso 1: Instalación

```bash
# Instalar EAS CLI globalmente
npm install -g eas-cli

# Login en Expo (crea cuenta si no tienes)
npx expo login
```

### Paso 2: Configurar Proyecto

```bash
# Ir a carpeta mobile-app
cd mobile-app

# Configurar EAS (solo primera vez)
eas build:configure
```

Esto creará `eas.json` con los perfiles de build.

### Paso 3: Build Development (para Testing)

**Para Android:**
```bash
# Build APK de desarrollo
eas build --profile development --platform android
```

**Para iOS (requiere cuenta Apple Developer):**
```bash
# Build de desarrollo para iOS
eas build --profile development --platform ios
```

**Tiempo estimado:** 10-20 minutos

**Resultado:** Te dará un link para descargar el APK/IPA

### Paso 4: Instalar en tu Dispositivo

**Android:**
1. Descarga el APK del link que te da EAS
2. Transfiérelo a tu celular
3. Instálalo (permite "Instalar desde fuentes desconocidas")

**iOS:**
1. Descarga el IPA
2. Instala con Apple Configurator o TestFlight

### Paso 5: Ejecutar App

```bash
# Inicia el servidor de desarrollo
npx expo start --dev-client
```

Escanea el QR con tu app compilada (no con Expo Go).

### Paso 6: Build de Producción

Cuando esté listo para publicar:

```bash
# Android (AAB para Play Store)
eas build --platform android

# iOS (para App Store)
eas build --platform ios
```

---

## 🔧 Opción 2: Local Build

### Requisitos Previos

**Para Android:**
- Android Studio instalado
- Java JDK 11+
- Android SDK configurado

**Para iOS:**
- Mac con Xcode 13+
- CocoaPods instalado
- Cuenta Apple Developer

### Paso 1: Generar Archivos Nativos

```bash
cd mobile-app

# Generar carpetas android/ e ios/
npx expo prebuild
```

### Paso 2: Build Android

```bash
cd android

# Build debug APK
./gradlew assembleDebug

# El APK estará en:
# android/app/build/outputs/apk/debug/app-debug.apk

# Instalar en dispositivo conectado
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Paso 3: Build iOS (solo Mac)

```bash
cd ios

# Instalar pods
pod install

# Abrir en Xcode
open BSLPaciente.xcworkspace
```

En Xcode:
1. Selecciona tu equipo de desarrollo
2. Conecta tu iPhone
3. Product → Run

### Paso 4: Ejecutar

```bash
# Terminal 1: Backend
cd ..
npm start

# Terminal 2: Metro bundler
cd mobile-app
npx expo start
```

---

## 🐛 Solución de Problemas

### "Expo Go no muestra el video"

✅ **Correcto.** Necesitas build nativo, no Expo Go.

**Solución:**
```bash
eas build --profile development --platform android
```

### "Error: Could not find or load main class org.gradle.wrapper.GradleWrapperMain"

```bash
cd android
# En Windows:
gradlew.bat wrapper
# En Mac/Linux:
chmod +x gradlew
./gradlew wrapper
```

### "Pod install failed"

```bash
cd ios
rm -rf Pods
pod cache clean --all
pod install --repo-update
```

### "Build falló en EAS"

1. Revisa los logs en el dashboard de EAS
2. Verifica que `app.json` esté correcto
3. Asegúrate de que todas las dependencias estén en `package.json`

### "No tengo cuenta Apple Developer"

Para testing en iPhone sin cuenta:
1. Abre proyecto en Xcode
2. Selecciona "Personal Team"
3. Firma con tu Apple ID personal
4. Solo funciona 7 días, luego debes volver a firmar

---

## 📊 Comparación de Métodos

| Característica | EAS Build | Local Build |
|----------------|-----------|-------------|
| Facilidad | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Velocidad | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| iOS sin Mac | ✅ | ❌ |
| Builds ilimitados | ❌ (límite gratis) | ✅ |
| Requiere internet | ✅ | Solo para deps |
| Certificados iOS | Automático | Manual |

---

## 🎬 Flujo Completo de Desarrollo

### 1. Desarrollo Inicial

```bash
# Trabaja en el código
cd mobile-app
npx expo start
```

**Limitación:** No verás video, solo UI y Socket.IO.

### 2. Testing de Video

```bash
# Build development
eas build --profile development --platform android

# Espera 10-15 mins, descarga APK

# Instala en tu celular

# Inicia dev server
npx expo start --dev-client
```

### 3. Iteración

Cada vez que cambies código:
1. Guarda cambios
2. La app se recarga automáticamente (Fast Refresh)
3. No necesitas rebuild para cambios de código JS

Rebuild solo cuando:
- Cambies dependencias nativas
- Cambies `app.json`
- Cambies código nativo (Android/iOS)

### 4. Producción

```bash
# Build final
eas build --platform android
eas build --platform ios

# Submit a tiendas
eas submit --platform android
eas submit --platform ios
```

---

## 💰 Costos

### EAS Build
- **Free:** 30 builds Android + 15 iOS al mes
- **Production:** $29/mes - Builds ilimitados
- **Enterprise:** $99/mes - Teams y prioridad

### Apple
- **Developer Program:** $99/año (requerido para App Store)

### Google
- **Play Store:** $25 una vez

### Twilio
- **Free:** $15 créditos de prueba
- **Pay as you go:** ~$0.0015/min por participante

---

## 📱 Testing en Producción

### Beta Testing

**Android (Google Play):**
```bash
# Build y submit
eas build --platform android
eas submit --platform android

# Configurar beta track en Play Console
```

**iOS (TestFlight):**
```bash
# Build y submit
eas build --platform ios
eas submit --platform ios

# Configurar testers en App Store Connect
```

---

## 🆘 Recursos

- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Expo Prebuild](https://docs.expo.dev/workflow/prebuild/)
- [Twilio Video Android](https://www.twilio.com/docs/video/android)
- [Twilio Video iOS](https://www.twilio.com/docs/video/ios)

---

## 📝 Checklist Pre-Build

Antes de hacer tu primer build:

- [ ] Servidor backend está corriendo
- [ ] Has probado conexión Socket.IO
- [ ] `config.js` apunta a tu servidor
- [ ] Credenciales de Twilio configuradas en backend
- [ ] Cuenta de Expo creada (para EAS)
- [ ] Android Studio instalado (para local Android)
- [ ] Xcode instalado (para local iOS)
- [ ] Permisos configurados en `app.json`

---

¡Listo para compilar! 🚀

Si tienes problemas, revisa la sección de Solución de Problemas o abre un issue en GitHub.
