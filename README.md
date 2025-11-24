# BSL-APP - Aplicación Médica de Videollamadas

Aplicación minimalista para videollamadas entre paciente (móvil/web) y médico usando Twilio Video y Socket.IO.

## Características

- ✅ **Notificación en tiempo real**: El médico recibe notificación instantánea cuando un paciente llama
- ✅ **Videollamada con Twilio**: Comunicación por video/audio de alta calidad
- ✅ **Sin autenticación compleja**: Sistema súper simple sin JWT
- ✅ **Responsive**: Funciona en móvil y escritorio

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

1. **Médico**: Abre en el navegador `http://localhost:3000/medico.html`
2. **Paciente**: Abre en móvil/navegador `http://localhost:3000/paciente.html`
3. El paciente presiona el botón para llamar
4. El médico recibe notificación y puede aceptar/rechazar
5. ¡Videollamada iniciada!

## Despliegue en Producción

Para usar en producción:

1. Despliega en Heroku, Railway, o similar
2. Configura las variables de entorno
3. Para móvil: envuelve `paciente.html` en React Native WebView o usa PWA

## Estructura del Proyecto

```
BSL-APP/
├── server/
│   └── index.js          # Servidor Express + Socket.IO
├── public/
│   ├── medico.html       # Interfaz del médico
│   └── paciente.html     # Interfaz del paciente
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
