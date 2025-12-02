require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const twilio = require('twilio');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS configuration - permite todas las conexiones
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  // Optimizaciones para muchas conexiones
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6
});

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL config
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 25060,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'defaultdb',
  ssl: { rejectUnauthorized: false }
});

// Twilio config
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'YOUR_ACCOUNT_SID';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'YOUR_AUTH_TOKEN';
const apiKeySid = process.env.TWILIO_API_KEY_SID || 'YOUR_API_KEY_SID';
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || 'YOUR_API_KEY_SECRET';

const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

// ============================================
// ESTRUCTURAS DE DATOS OPTIMIZADAS
// ============================================

// Map para médicos: socketId -> { nombre, disponible, enLlamada }
const medicos = new Map();

// Map para pacientes en cola: socketId -> { nombre, timestamp, posicion }
const pacientesEnCola = new Map();

// Array ordenado para mantener el orden de la cola (solo socketIds)
let colaOrden = [];

// Rate limiting: socketId -> { count, lastReset }
const rateLimits = new Map();

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
  RATE_LIMIT_MAX: 30,        // máximo de eventos por ventana
  RATE_LIMIT_WINDOW: 10000,  // ventana de 10 segundos
  THROTTLE_DELAY: 100,       // delay mínimo entre notificaciones masivas
  MAX_COLA_SIZE: 500,        // máximo pacientes en cola
  MAX_NOMBRE_LENGTH: 50      // máximo caracteres en nombre
};

// ============================================
// UTILIDADES
// ============================================

// Validar y sanitizar string
function sanitizeString(str, maxLength = CONFIG.MAX_NOMBRE_LENGTH) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength).replace(/[<>]/g, '');
}

// Rate limiting por socket
function checkRateLimit(socketId) {
  const now = Date.now();
  let limit = rateLimits.get(socketId);

  if (!limit || now - limit.lastReset > CONFIG.RATE_LIMIT_WINDOW) {
    limit = { count: 0, lastReset: now };
  }

  limit.count++;
  rateLimits.set(socketId, limit);

  return limit.count <= CONFIG.RATE_LIMIT_MAX;
}

// Limpiar rate limits antiguos (cada minuto)
setInterval(() => {
  const now = Date.now();
  for (const [socketId, limit] of rateLimits) {
    if (now - limit.lastReset > CONFIG.RATE_LIMIT_WINDOW * 2) {
      rateLimits.delete(socketId);
    }
  }
}, 60000);

// ============================================
// NOTIFICACIONES OPTIMIZADAS CON THROTTLING
// ============================================

let notificacionPendiente = false;
let ultimaNotificacion = 0;

function programarNotificacion() {
  if (notificacionPendiente) return;

  const ahora = Date.now();
  const tiempoDesdeUltima = ahora - ultimaNotificacion;
  const delay = Math.max(0, CONFIG.THROTTLE_DELAY - tiempoDesdeUltima);

  notificacionPendiente = true;

  setTimeout(() => {
    notificacionPendiente = false;
    ultimaNotificacion = Date.now();
    ejecutarNotificaciones();
  }, delay);
}

function ejecutarNotificaciones() {
  // Construir info de cola una sola vez
  const ahora = Date.now();
  const medicosDisponibles = Array.from(medicos.values()).filter(m => m.disponible).length;

  const colaInfo = colaOrden.map((socketId, index) => {
    const paciente = pacientesEnCola.get(socketId);
    if (!paciente) return null;
    return {
      posicion: index + 1,
      pacienteId: socketId,
      nombre: paciente.nombre,
      esperando: Math.floor((ahora - paciente.timestamp) / 1000)
    };
  }).filter(Boolean);

  // Notificar a médicos usando room
  io.to('medicos').emit('actualizar-cola', colaInfo);

  // Notificar a cada paciente su posición
  colaOrden.forEach((socketId, index) => {
    io.to(socketId).emit('posicion-cola', {
      posicion: index + 1,
      total: colaOrden.length,
      medicosDisponibles
    });
  });
}

// ============================================
// GESTIÓN DE COLA OPTIMIZADA
// ============================================

function agregarPacienteACola(socketId, nombre) {
  if (pacientesEnCola.has(socketId)) {
    return pacientesEnCola.get(socketId);
  }

  if (colaOrden.length >= CONFIG.MAX_COLA_SIZE) {
    return null; // Cola llena
  }

  const paciente = {
    nombre: sanitizeString(nombre) || 'Paciente',
    timestamp: Date.now(),
    posicion: colaOrden.length + 1
  };

  pacientesEnCola.set(socketId, paciente);
  colaOrden.push(socketId);

  return paciente;
}

function removerPacienteDeCola(socketId) {
  if (!pacientesEnCola.has(socketId)) return false;

  pacientesEnCola.delete(socketId);
  const index = colaOrden.indexOf(socketId);
  if (index > -1) {
    colaOrden.splice(index, 1);
  }

  return true;
}

function obtenerPosicionEnCola(socketId) {
  const index = colaOrden.indexOf(socketId);
  return index > -1 ? index + 1 : -1;
}

// ============================================
// SOCKET.IO CONNECTION
// ============================================

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Médico se registra
  socket.on('soy-medico', (data) => {
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', { mensaje: 'Demasiadas solicitudes' });
      return;
    }

    const nombre = sanitizeString(data?.nombre) || 'Médico';
    medicos.set(socket.id, { nombre, disponible: true, enLlamada: false });

    // Unir al room de médicos para notificaciones eficientes
    socket.join('medicos');

    console.log('Médico conectado:', socket.id, nombre);
    socket.emit('conectado-como-medico', { medicosActivos: medicos.size });

    programarNotificacion();
  });

  // Paciente solicita llamada
  socket.on('llamar-medico', (data) => {
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', { mensaje: 'Demasiadas solicitudes' });
      return;
    }

    console.log('Paciente solicita llamada:', data);

    // Verificar si hay médicos conectados
    if (medicos.size === 0) {
      socket.emit('medico-no-disponible', { mensaje: 'No hay médicos conectados' });
      return;
    }

    // Agregar a la cola
    const nombre = sanitizeString(data?.nombre) || 'Paciente';
    const paciente = agregarPacienteACola(socket.id, nombre);

    if (!paciente) {
      socket.emit('error', { mensaje: 'Cola llena, intente más tarde' });
      return;
    }

    console.log('Paciente agregado a cola. Total en cola:', colaOrden.length);

    // Unir al room de pacientes
    socket.join('pacientes');

    // Notificar posición al paciente inmediatamente
    const posicion = obtenerPosicionEnCola(socket.id);
    const medicosDisponibles = Array.from(medicos.values()).filter(m => m.disponible).length;

    socket.emit('en-cola', {
      posicion,
      total: colaOrden.length,
      medicosDisponibles
    });

    // Programar notificación a médicos
    programarNotificacion();
  });

  // Paciente cancela llamada
  socket.on('cancelar-llamada', () => {
    if (!checkRateLimit(socket.id)) return;

    if (removerPacienteDeCola(socket.id)) {
      socket.leave('pacientes');
      console.log('Paciente canceló llamada. Total en cola:', colaOrden.length);
      programarNotificacion();
    }
  });

  // Médico acepta paciente
  socket.on('medico-acepta', (data) => {
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', { mensaje: 'Demasiadas solicitudes' });
      return;
    }

    const pacienteId = data?.pacienteId;
    const roomName = sanitizeString(data?.roomName, 100);

    if (!pacienteId || !roomName) {
      socket.emit('error', { mensaje: 'Datos inválidos' });
      return;
    }

    console.log('Médico acepta llamada de:', pacienteId);

    // Marcar médico como ocupado
    const medico = medicos.get(socket.id);
    if (medico) {
      medico.disponible = false;
      medico.enLlamada = true;
    }

    // Remover paciente de la cola
    removerPacienteDeCola(pacienteId);

    // Notificar al paciente
    io.to(pacienteId).emit('medico-aceptado', { roomName });

    // Actualizar cola para todos
    programarNotificacion();
  });

  // Llamada terminada
  socket.on('llamada-terminada', () => {
    if (!checkRateLimit(socket.id)) return;

    const medico = medicos.get(socket.id);
    if (medico) {
      medico.disponible = true;
      medico.enLlamada = false;
      console.log('Médico disponible nuevamente:', socket.id);
      programarNotificacion();
    }
  });

  // Solicitar cola (para actualización manual)
  socket.on('solicitar-cola', () => {
    if (!checkRateLimit(socket.id)) return;

    // Solo responder si es médico
    if (medicos.has(socket.id)) {
      const ahora = Date.now();
      const colaInfo = colaOrden.map((socketId, index) => {
        const paciente = pacientesEnCola.get(socketId);
        if (!paciente) return null;
        return {
          posicion: index + 1,
          pacienteId: socketId,
          nombre: paciente.nombre,
          esperando: Math.floor((ahora - paciente.timestamp) / 1000)
        };
      }).filter(Boolean);

      socket.emit('actualizar-cola', colaInfo);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    // Si era médico, removerlo
    if (medicos.has(socket.id)) {
      medicos.delete(socket.id);
      console.log('Médico desconectado:', socket.id, 'Médicos restantes:', medicos.size);
      programarNotificacion();
    }

    // Si era paciente en cola, removerlo
    if (pacientesEnCola.has(socket.id)) {
      removerPacienteDeCola(socket.id);
      console.log('Paciente desconectado de cola. Total en cola:', colaOrden.length);
      programarNotificacion();
    }

    // Limpiar rate limit
    rateLimits.delete(socket.id);

    console.log('Cliente desconectado:', socket.id);
  });
});

// ============================================
// API ENDPOINTS
// ============================================

// Generate Twilio token
app.post('/token', (req, res) => {
  try {
    const { identity, room } = req.body;

    // Validar entrada
    if (!identity || !room) {
      return res.status(400).json({ error: 'identity y room son requeridos' });
    }

    const sanitizedIdentity = sanitizeString(identity, 100);
    const sanitizedRoom = sanitizeString(room, 100);

    if (!sanitizedIdentity || !sanitizedRoom) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const token = new AccessToken(
      accountSid,
      apiKeySid,
      apiKeySecret,
      { identity: sanitizedIdentity }
    );

    const videoGrant = new VideoGrant({
      room: sanitizedRoom
    });

    token.addGrant(videoGrant);

    res.json({
      token: token.toJwt(),
      room: sanitizedRoom
    });
  } catch (error) {
    console.error('Error generando token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Agendar consulta
app.post('/agendar-consulta', async (req, res) => {
  try {
    const {
      primerNombre,
      segundoNombre,
      primerApellido,
      segundoApellido,
      numeroId,
      celular,
      tipoConsulta,
      mes,
      dia,
      hora
    } = req.body;

    // Validar campos requeridos
    if (!primerNombre || !primerApellido || !numeroId || !celular || !tipoConsulta || !mes || !dia || !hora) {
      return res.status(400).json({ error: 'Todos los campos obligatorios son requeridos' });
    }

    // Sanitizar datos
    const sanitizedData = {
      primerNombre: sanitizeString(primerNombre),
      segundoNombre: sanitizeString(segundoNombre) || null,
      primerApellido: sanitizeString(primerApellido),
      segundoApellido: sanitizeString(segundoApellido) || null,
      numeroId: sanitizeString(numeroId),
      celular: sanitizeString(celular, 20),
      tipoExamen: sanitizeString(tipoConsulta, 255)
    };

    // Construir fecha de consulta
    const year = new Date().getFullYear();
    const fechaConsulta = new Date(`${year}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${hora}:00`);

    // Generar ID único
    const id = uuidv4();

    // Insertar en base de datos
    const query = `
      INSERT INTO "HistoriaClinica" (
        "_id", "primerNombre", "segundoNombre", "primerApellido", "segundoApellido",
        "numeroId", "celular", "tipoExamen", "fechaConsulta", "atendido", "pvEstado"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING "_id"
    `;

    const values = [
      id,
      sanitizedData.primerNombre,
      sanitizedData.segundoNombre,
      sanitizedData.primerApellido,
      sanitizedData.segundoApellido,
      sanitizedData.numeroId,
      sanitizedData.celular,
      sanitizedData.tipoExamen,
      fechaConsulta,
      'pendiente',
      'agendado'
    ];

    const result = await pool.query(query, values);

    console.log('Consulta agendada:', result.rows[0]._id);

    res.json({
      success: true,
      message: 'Consulta agendada exitosamente',
      id: result.rows[0]._id,
      fechaConsulta: fechaConsulta.toISOString()
    });

  } catch (error) {
    console.error('Error agendando consulta:', error);
    res.status(500).json({ error: 'Error al agendar la consulta' });
  }
});

// Buscar certificado por número de documento
app.get('/buscar-certificado/:numeroId', async (req, res) => {
  try {
    const { numeroId } = req.params;

    if (!numeroId) {
      return res.status(400).json({ error: 'Número de documento requerido' });
    }

    const sanitizedNumeroId = sanitizeString(numeroId, 50);

    const query = `
      SELECT "_id", "primerNombre", "primerApellido", "numeroId"
      FROM "HistoriaClinica"
      WHERE "numeroId" = $1
      ORDER BY "_createdDate" DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [sanitizedNumeroId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No se encontró registro con ese número de documento',
        found: false
      });
    }

    const record = result.rows[0];

    res.json({
      success: true,
      found: true,
      id: record._id,
      nombre: `${record.primerNombre} ${record.primerApellido}`,
      numeroId: record.numeroId,
      certificadoUrl: `https://bsl-utilidades-yp78a.ondigitalocean.app/generar-certificado-desde-wix/${record._id}`
    });

  } catch (error) {
    console.error('Error buscando certificado:', error);
    res.status(500).json({ error: 'Error al buscar el certificado' });
  }
});

// Health check con estadísticas
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    stats: {
      medicosConectados: medicos.size,
      medicosDisponibles: Array.from(medicos.values()).filter(m => m.disponible).length,
      pacientesEnCola: colaOrden.length,
      conexionesActivas: io.engine.clientsCount
    }
  });
});

// Stats endpoint para monitoreo
app.get('/stats', (req, res) => {
  const medicosInfo = Array.from(medicos.entries()).map(([id, m]) => ({
    id: id.slice(0, 8) + '...',
    disponible: m.disponible,
    enLlamada: m.enLlamada
  }));

  res.json({
    medicos: medicosInfo,
    colaLength: colaOrden.length,
    conexiones: io.engine.clientsCount,
    memoria: process.memoryUsage()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Web médico: http://localhost:${PORT}/medico.html`);
  console.log(`Web paciente (test): http://localhost:${PORT}/paciente.html`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Stats: http://localhost:${PORT}/stats`);
});
