# BSL-APP - Aplicación Médica de Videollamadas

Aplicación minimalista para videollamadas entre paciente (móvil/web) y médico usando Twilio Video y Socket.IO.

## 📱 Componentes del Proyecto

1. **Servidor Backend** - Node.js + Express + Socket.IO
2. **Panel Médico Web** - Interfaz web para computadora
3. **Panel Paciente Web** - Interfaz responsive para navegador
4. **App Móvil Nativa** - React Native con Expo (carpeta `/mobile-app`)

## Características

- ✅ **Notificación en tiempo real**: El médico recibe notificación instantánea cuando un paciente llama
- ✅ **Videollamada con Twilio**: Comunicación por video/audio de alta calidad
- ✅ **Sin autenticación compleja**: Sistema súper simple sin JWT
- ✅ **Responsive**: Funciona en móvil y escritorio
- ✅ **App Móvil Nativa**: React Native con Expo para iOS y Android

## Requisitos

- Node.js 14+
- Cuenta de Twilio (gratis para testing)

## Configuración de Twilio

1. Crea una cuenta en [Twilio](https://www.twilio.com/try-twilio)
2. Ve a la consola y obtén:
   - Account SID
   - Auth Token
3. Crea una API Key:
   - Ve a Account → API Keys → Create API Key
   - Guarda el SID y Secret

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Twilio

# Iniciar servidor
npm start
```

## Uso

### Servidor y Panel Web

1. **Médico**: Abre en el navegador `http://localhost:3001/medico.html`
2. **Paciente Web**: Abre en móvil/navegador `http://localhost:3001/paciente.html`
3. El paciente presiona el botón para llamar
4. El médico recibe notificación y puede aceptar/rechazar
5. ¡Videollamada iniciada!

### App Móvil Nativa (Recomendado)

```bash
# Entrar a la carpeta mobile-app
cd mobile-app

# Instalar dependencias
npm install

# Iniciar Expo
npx expo start

# Escanear QR con Expo Go en tu celular
```

Ver instrucciones completas en [mobile-app/README.md](mobile-app/README.md)

## Despliegue en Producción

### Backend
- Ver [DEPLOY_DIGITAL_OCEAN.md](DEPLOY_DIGITAL_OCEAN.md) para instrucciones completas
- Digital Ocean App Platform (Recomendado)
- O Droplet con Nginx

### App Móvil
- Build con EAS: `eas build --platform android`
- O APK directo con `npx expo prebuild`

## Estructura del Proyecto

```
BSL-APP/
├── server/
│   └── index.js              # Servidor Express + Socket.IO
├── public/
│   ├── medico.html           # Interfaz del médico (web)
│   └── paciente.html         # Interfaz del paciente (web)
├── mobile-app/               # App móvil React Native
│   ├── App.js                # Componente principal
│   ├── config.js             # Configuración
│   ├── app.json              # Config de Expo
│   └── README.md             # Instrucciones móvil
├── DEPLOY_DIGITAL_OCEAN.md   # Guía de despliegue
├── COMO_USAR.md              # Guía de uso
├── package.json
└── README.md
```

## Tecnologías

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML, CSS, JavaScript vanilla
- **Video**: Twilio Video SDK
- **Tiempo real**: Socket.IO

## Nota Importante

Esta es una versión minimalista para desarrollo. Para producción considera:
- Autenticación adecuada
- Base de datos para historial
- Cifrado de comunicaciones
- Validación de identidad médica
- Cumplimiento HIPAA/normativas locales
