require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const twilio = require('twilio');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS configuration - permite todas las conexiones
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Twilio config
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'YOUR_ACCOUNT_SID';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'YOUR_AUTH_TOKEN';
const apiKeySid = process.env.TWILIO_API_KEY_SID || 'YOUR_API_KEY_SID';
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || 'YOUR_API_KEY_SECRET';

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

let medicoSocket = null;

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('soy-medico', () => {
    medicoSocket = socket.id;
    console.log('Médico conectado:', socket.id);
    socket.emit('conectado-como-medico');
  });

  socket.on('llamar-medico', (data) => {
    console.log('Paciente solicita llamada:', data);
    if (medicoSocket) {
      io.to(medicoSocket).emit('llamada-entrante', {
        pacienteId: socket.id,
        pacienteNombre: data.nombre || 'Paciente'
      });
    } else {
      socket.emit('medico-no-disponible');
    }
  });

  socket.on('medico-acepta', (data) => {
    console.log('Médico acepta llamada de:', data.pacienteId);
    io.to(data.pacienteId).emit('medico-aceptado', {
      roomName: data.roomName
    });
  });

  socket.on('disconnect', () => {
    if (socket.id === medicoSocket) {
      medicoSocket = null;
      console.log('Médico desconectado');
    }
    console.log('Cliente desconectado:', socket.id);
  });
});

// Generate Twilio token
app.post('/token', (req, res) => {
  const { identity, room } = req.body;

  const token = new AccessToken(
    accountSid,
    apiKeySid,
    apiKeySecret,
    { identity: identity }
  );

  const videoGrant = new VideoGrant({
    room: room
  });

  token.addGrant(videoGrant);

  res.json({
    token: token.toJwt(),
    room: room
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Web médico: http://localhost:${PORT}/medico.html`);
  console.log(`Web paciente (test): http://localhost:${PORT}/paciente.html`);
});
