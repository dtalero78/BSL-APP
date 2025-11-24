# 📱 BSL Paciente - App Móvil

Aplicación móvil React Native con Expo para que los pacientes llamen al médico.

## 🚀 Inicio Rápido

### 1. Instalar Expo Go en tu celular

**Android**: https://play.google.com/store/apps/details?id=host.exp.exponent

**iOS**: https://apps.apple.com/app/expo-go/id982107779

### 2. Iniciar la app

```bash
# Asegúrate de estar en la carpeta mobile-app
cd mobile-app

# Iniciar Expo
npx expo start
```

### 3. Escanear QR

- **Android**: Abre Expo Go y escanea el QR desde la app
- **iOS**: Abre la cámara y escanea el QR (te redirigirá a Expo Go)

## ⚙️ Configuración

### Conectar con tu servidor

Edita `config.js`:

```javascript
export const config = {
  // Para desarrollo local (mismo WiFi)
  SERVER_URL: 'http://TU_IP_LOCAL:3001',

  // Para producción
  // SERVER_URL: 'https://tu-app.ondigitalocean.app',
};
```

**Importante**:
- En desarrollo, usa tu IP local (no localhost)
- Encuentra tu IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- El celular y la computadora deben estar en la misma red WiFi

## 📦 Build para Producción

### Android APK

```bash
# Build APK para Android
eas build --platform android --profile preview

# O si no tienes EAS configurado:
npx expo prebuild
cd android
./gradlew assembleRelease
```

### iOS (requiere Mac)

```bash
# Build para iOS
eas build --platform ios --profile preview
```

## 🔧 Desarrollo

### Comandos Útiles

```bash
# Iniciar en modo desarrollo
npm start

# Limpiar cache
npx expo start -c

# Ver logs
npx react-native log-android  # Android
npx react-native log-ios      # iOS
```

### Estructura del Proyecto

```
mobile-app/
├── App.js              # Componente principal
├── config.js           # Configuración del servidor
├── app.json           # Configuración de Expo
├── package.json       # Dependencias
└── assets/            # Imágenes y recursos
```

## 📱 Características

✅ **Socket.IO** - Notificaciones en tiempo real
✅ **Permisos** - Solicita cámara y micrófono automáticamente
✅ **Estado de conexión** - Indica si está conectado al servidor
✅ **Botón grande** - Fácil de presionar para llamar
✅ **Diseño minimalista** - Interfaz simple y clara

## ⚠️ Limitaciones Actuales

La videollamada con Twilio Video SDK requiere implementación nativa más compleja. Tienes 3 opciones:

### Opción 1: WebView (Más Fácil) ✅ Recomendado

Usar la página web existente dentro de un WebView:

```bash
npm install react-native-webview
```

Luego en App.js:
```javascript
import { WebView } from 'react-native-webview';

<WebView
  source={{ uri: 'https://tu-servidor.com/paciente.html' }}
  mediaPlaybackRequiresUserAction={false}
  allowsInlineMediaPlayback={true}
/>
```

### Opción 2: Twilio Native SDK

Instalar SDK nativo de Twilio:
```bash
npm install react-native-twilio-video-webrtc
```

Requiere configuración nativa (más complejo).

### Opción 3: Seguir usando la versión actual

La app actual:
- ✅ Conecta con Socket.IO
- ✅ Notifica al médico
- ✅ Recibe aceptación
- ⚠️ No muestra video (solo simula la llamada)

## 🌐 Deploy con EAS (Expo Application Services)

### 1. Crear cuenta en Expo

```bash
npx expo login
```

### 2. Configurar EAS

```bash
npm install -g eas-cli
eas build:configure
```

### 3. Build y Deploy

```bash
# Build para Android
eas build --platform android

# Build para iOS
eas build --platform ios

# Submit a tiendas
eas submit --platform android
eas submit --platform ios
```

## 🔒 Permisos Requeridos

La app solicita automáticamente:

- **CAMERA** - Para videollamadas
- **RECORD_AUDIO** - Para audio en llamadas
- **INTERNET** - Para conectar con el servidor

## 🐛 Solución de Problemas

### No se conecta al servidor
✅ Verifica que el servidor esté corriendo
✅ Usa tu IP local (no localhost) en desarrollo
✅ Asegúrate de estar en la misma red WiFi

### No pide permisos
✅ Reinstala la app
✅ Revisa configuración en app.json
✅ Verifica permisos manualmente en ajustes del celular

### Error al escanear QR
✅ Asegúrate de tener Expo Go instalado
✅ Intenta con `npm start` y selecciona tunnel

## 📝 Próximos Pasos

1. Implementar WebView para video completo
2. Agregar diseño personalizado
3. Notificaciones push cuando el médico esté disponible
4. Historial de llamadas
5. Chat de texto como alternativa

## 🆘 Soporte

Para más información sobre Expo:
- Docs: https://docs.expo.dev/
- Forum: https://forums.expo.dev/
