# 🚀 Cómo Usar la Aplicación

## ✅ Servidor Iniciado

El servidor ya está corriendo en el puerto **3001**.

## 📱 Probar la Aplicación

### Opción 1: En la Misma Computadora (Testing)

1. **Abre el panel del médico:**
   - Ve a: http://localhost:3001/medico.html
   - Deberías ver "✅ Conectado - Disponible para atender"

2. **Abre el panel del paciente en otra pestaña:**
   - Ve a: http://localhost:3001/paciente.html
   - Presiona el botón grande 📞

3. **El médico recibirá la notificación:**
   - Aparecerá una ventana emergente
   - Haz clic en "Aceptar"
   - ¡Videollamada iniciada!

### Opción 2: Desde el Celular (Real)

1. **Encuentra tu IP local:**
   ```bash
   # En Mac/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # En Windows:
   ipconfig
   ```

2. **En el celular:**
   - Asegúrate de estar en la misma red WiFi
   - Abre el navegador del celular
   - Ve a: http://TU_IP:3001/paciente.html
   - Ejemplo: http://192.168.1.100:3001/paciente.html

3. **En la computadora:**
   - Abre: http://localhost:3001/medico.html

4. **Presiona el botón en el celular**
   - El médico recibirá la notificación instantánea
   - Acepta la llamada
   - ¡Videollamada entre celular y computadora!

## 🔧 Comandos Útiles

```bash
# Iniciar servidor
npm start

# Iniciar en modo desarrollo (auto-reload)
npm run dev

# Detener servidor
# Presiona Ctrl+C en la terminal
```

## 📋 URLs Importantes

- **Panel Médico (Computadora):** http://localhost:3001/medico.html
- **Panel Paciente (Móvil/Web):** http://localhost:3001/paciente.html
- **Health Check:** http://localhost:3001/health

## ⚠️ Solución de Problemas

### El video no funciona
- Asegúrate de dar permisos de cámara y micrófono en el navegador
- En móvil, usa HTTPS en producción (Twilio lo requiere)

### No se conecta desde el celular
- Verifica que estén en la misma red WiFi
- Revisa que el firewall no bloquee el puerto 3001
- Usa la IP correcta (no localhost desde el celular)

### El médico no recibe la notificación
- Verifica que la página del médico esté abierta y diga "Conectado"
- Revisa la consola del navegador (F12) para errores

## 📱 Para Convertir a App Móvil

### Opción 1: PWA (Progressive Web App)
La página del paciente ya es responsive. Solo agrega:
- Service Worker para funcionar offline
- Manifest.json para instalar como app

### Opción 2: React Native WebView
```javascript
<WebView
  source={{ uri: 'http://TU_SERVIDOR:3001/paciente.html' }}
  mediaPlaybackRequiresUserAction={false}
  allowsInlineMediaPlayback={true}
/>
```

## 🌐 Desplegar en Producción

### Railway (Recomendado - Gratis)
```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login y deploy
railway login
railway init
railway up
```

### Heroku
```bash
heroku create tu-app-medica
git push heroku main
heroku config:set TWILIO_ACCOUNT_SID=tu_account_sid
heroku config:set TWILIO_AUTH_TOKEN=tu_auth_token
heroku config:set TWILIO_API_KEY_SID=tu_api_key_sid
heroku config:set TWILIO_API_KEY_SECRET=tu_api_key_secret
```

## 🎯 Próximos Pasos

1. ✅ Probar localmente
2. 🌐 Desplegar a producción
3. 📱 Crear app móvil (opcional)
4. 🔒 Agregar autenticación (opcional para producción)
5. 💾 Base de datos para historial (opcional)
