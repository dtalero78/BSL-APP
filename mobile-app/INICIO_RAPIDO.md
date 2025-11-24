# 🚀 Inicio Rápido - App Móvil BSL

## 📲 Paso 1: Instalar Expo Go

Descarga **Expo Go** en tu celular:

- **Android**: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **iOS**: [App Store](https://apps.apple.com/app/expo-go/id982107779)

## 💻 Paso 2: Iniciar el Servidor Backend

Abre una terminal en la raíz del proyecto:

```bash
# Asegúrate de estar en BSL-APP (no en mobile-app)
cd /Users/danieltalero/BSL-APP/BSL-APP

# El servidor ya debe estar corriendo en puerto 3001
# Si no, inícialo con:
npm start
```

Verás algo como:
```
Servidor corriendo en puerto 3001
Web médico: http://localhost:3001/medico.html
Web paciente (test): http://localhost:3001/paciente.html
```

## 📱 Paso 3: Configurar la IP del Servidor

Necesitas encontrar la IP de tu computadora:

```bash
# En Mac/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Busca algo como: 192.168.1.XXX
```

Edita el archivo `mobile-app/config.js`:

```javascript
export const config = {
  SERVER_URL: 'http://192.168.1.XXX:3001', // Cambia XXX por tu IP
};
```

## 🎬 Paso 4: Iniciar Expo

Abre OTRA terminal (deja la del servidor corriendo):

```bash
# Ir a la carpeta mobile-app
cd mobile-app

# Iniciar Expo (primera vez puede tardar)
npx expo start
```

Verás un **QR code** en la terminal.

## 📷 Paso 5: Escanear QR

### Android:
1. Abre **Expo Go** en tu celular
2. Toca "Scan QR code"
3. Escanea el QR de la terminal

### iOS:
1. Abre la **Cámara** nativa
2. Apunta al QR de la terminal
3. Toca la notificación que aparece
4. Se abrirá Expo Go automáticamente

## 🏥 Paso 6: Probar la App

1. **En tu computadora**: Abre http://localhost:3001/medico.html
2. **En tu celular**: La app ya debería estar abierta en Expo Go
3. **En la app móvil**: Presiona el botón grande 📞
4. **En la computadora**: El médico recibirá la notificación

## ⚠️ Solución de Problemas

### "No se conecta al servidor"

✅ **Verifica que estén en la misma red WiFi** (celular y computadora)

✅ **Revisa la IP en config.js**:
```bash
# Confirma tu IP:
ifconfig | grep "inet " | grep -v 127.0.0.1
```

✅ **Verifica que el servidor esté corriendo**:
```bash
# Deberías ver esto:
curl http://localhost:3001/health
# Respuesta: {"status":"ok"}
```

### "No aparece el QR"

✅ **Limpia cache de Expo**:
```bash
npx expo start -c
```

✅ **Si no ves el QR**, abre el navegador en:
```
http://localhost:8081
```

### "Expo Go no se abre"

✅ **Asegúrate de tener Expo Go instalado**

✅ **En iOS**, escanea con la cámara nativa (no desde Expo Go)

✅ **En Android**, escanea desde dentro de Expo Go

### "Error de permisos"

✅ La app pedirá permisos automáticamente

✅ Si no lo hace, ve a:
- **Android**: Ajustes → Apps → Expo Go → Permisos
- **iOS**: Ajustes → Expo Go → Cámara/Micrófono

## 📝 Comandos Útiles

```bash
# Iniciar Expo normalmente
npx expo start

# Limpiar cache
npx expo start -c

# Abrir en simulador (si lo tienes)
npx expo start --ios      # iOS
npx expo start --android  # Android

# Ver logs detallados
npx expo start --dev-client
```

## 🎯 Próximos Pasos

1. ✅ Probar la conexión con Socket.IO
2. 📹 Implementar videollamada completa (ver README.md)
3. 🎨 Personalizar colores y diseño
4. 📦 Build para producción (cuando esté listo)

## 🆘 ¿Necesitas Ayuda?

- **Docs de Expo**: https://docs.expo.dev
- **Troubleshooting**: https://docs.expo.dev/troubleshooting/
- **Forum**: https://forums.expo.dev

---

## 💡 Tips

- El celular y la computadora DEBEN estar en la misma red WiFi
- NO uses "localhost" en config.js, usa tu IP local
- Si cambias config.js, guarda y la app se recargará automáticamente
- Puedes agitar el celular para abrir el menú de desarrollo
