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

// Estado del sistema
let medicos = new Map(); // socketId -> { nombre, disponible, enLlamada }
let colaPacientes = []; // [{ socketId, nombre, timestamp }]

// Función para notificar a todos los médicos sobre la cola
function notificarColaAMedicos() {
  const colaInfo = colaPacientes.map((p, index) => ({
    posicion: index + 1,
    pacienteId: p.socketId,
    nombre: p.nombre,
    esperando: Math.floor((Date.now() - p.timestamp) / 1000)
  }));

  medicos.forEach((medico, socketId) => {
    io.to(socketId).emit('actualizar-cola', colaInfo);
  });
}

// Función para notificar a pacientes su posición
function notificarPosicionAPacientes() {
  colaPacientes.forEach((paciente, index) => {
    io.to(paciente.socketId).emit('posicion-cola', {
      posicion: index + 1,
      total: colaPacientes.length,
      medicosDisponibles: Array.from(medicos.values()).filter(m => m.disponible).length
    });
  });
}

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  socket.on('soy-medico', (data) => {
    const nombre = data?.nombre || 'Médico';
    medicos.set(socket.id, { nombre, disponible: true, enLlamada: false });
    console.log('Médico conectado:', socket.id, nombre);
    socket.emit('conectado-como-medico', { medicosActivos: medicos.size });
    notificarColaAMedicos();
    notificarPosicionAPacientes();
  });

  socket.on('llamar-medico', (data) => {
    console.log('Paciente solicita llamada:', data);

    // Verificar si hay médicos conectados
    if (medicos.size === 0) {
      socket.emit('medico-no-disponible', { mensaje: 'No hay médicos conectados' });
      return;
    }

    // Agregar a la cola si no está ya
    const yaEnCola = colaPacientes.find(p => p.socketId === socket.id);
    if (!yaEnCola) {
      colaPacientes.push({
        socketId: socket.id,
        nombre: data.nombre || 'Paciente',
        timestamp: Date.now()
      });
      console.log('Paciente agregado a cola. Total en cola:', colaPacientes.length);
    }

    // Notificar posición al paciente
    const posicion = colaPacientes.findIndex(p => p.socketId === socket.id) + 1;
    socket.emit('en-cola', {
      posicion,
      total: colaPacientes.length,
      medicosDisponibles: Array.from(medicos.values()).filter(m => m.disponible).length
    });

    // Notificar a todos los médicos
    notificarColaAMedicos();
    notificarPosicionAPacientes();
  });

  socket.on('cancelar-llamada', () => {
    colaPacientes = colaPacientes.filter(p => p.socketId !== socket.id);
    console.log('Paciente canceló llamada. Total en cola:', colaPacientes.length);
    notificarColaAMedicos();
    notificarPosicionAPacientes();
  });

  socket.on('medico-acepta', (data) => {
    console.log('Médico acepta llamada de:', data.pacienteId);

    // Marcar médico como ocupado
    const medico = medicos.get(socket.id);
    if (medico) {
      medico.disponible = false;
      medico.enLlamada = true;
    }

    // Remover paciente de la cola
    colaPacientes = colaPacientes.filter(p => p.socketId !== data.pacienteId);

    // Notificar al paciente
    io.to(data.pacienteId).emit('medico-aceptado', {
      roomName: data.roomName
    });

    // Actualizar cola para todos
    notificarColaAMedicos();
    notificarPosicionAPacientes();
  });

  socket.on('llamada-terminada', () => {
    const medico = medicos.get(socket.id);
    if (medico) {
      medico.disponible = true;
      medico.enLlamada = false;
      console.log('Médico disponible nuevamente:', socket.id);
      notificarColaAMedicos();
      notificarPosicionAPacientes();
    }
  });

  socket.on('disconnect', () => {
    // Si era médico, removerlo
    if (medicos.has(socket.id)) {
      medicos.delete(socket.id);
      console.log('Médico desconectado:', socket.id, 'Médicos restantes:', medicos.size);
      notificarPosicionAPacientes();
    }

    // Si era paciente en cola, removerlo
    const eraEnCola = colaPacientes.find(p => p.socketId === socket.id);
    if (eraEnCola) {
      colaPacientes = colaPacientes.filter(p => p.socketId !== socket.id);
      console.log('Paciente desconectado de cola. Total en cola:', colaPacientes.length);
      notificarColaAMedicos();
      notificarPosicionAPacientes();
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
