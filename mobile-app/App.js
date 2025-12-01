import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Image
} from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import io from 'socket.io-client';
import {
  TwilioVideo,
  TwilioVideoLocalView,
  TwilioVideoParticipantView
} from 'react-native-twilio-video-webrtc';
import { config } from './config';

const { width, height } = Dimensions.get('window');

// Paleta de colores BSL
const colors = {
  laPalma: '#16a330',
  oliveDrab: '#5bae27',
  bahamaBlue: '#00668e',
  greenHaze: '#039874',
  abbey: '#4c4c4d',
  funGreen: '#007b35',
  persianGreen: '#02969b',
  bondiBlue: '#008fb7',
  white: '#ffffff',
  lightGray: '#f5f5f5',
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [status, setStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('Conectando...');
  const [hasPermission, setHasPermission] = useState(false);
  const [calling, setCalling] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [videoTracks, setVideoTracks] = useState(new Map());
  const [queuePosition, setQueuePosition] = useState(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [medicosDisponibles, setMedicosDisponibles] = useState(0);

  const socketRef = useRef(null);
  const twilioRef = useRef(null);
  const roomNameRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (twilioRef.current) {
        twilioRef.current.disconnect();
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const audioPermission = await Audio.requestPermissionsAsync();

      if (cameraPermission.status === 'granted' && audioPermission.status === 'granted') {
        setHasPermission(true);
      } else {
        Alert.alert(
          'Permisos Necesarios',
          'La app necesita acceso a la cámara y micrófono para funcionar.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const connectSocket = () => {
    try {
      const socket = io(config.SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      socket.on('connect', () => {
        console.log('Socket conectado');
        setStatus('connected');
        setStatusMessage('Conectado');
      });

      socket.on('disconnect', () => {
        console.log('Socket desconectado');
        setStatus('disconnected');
        setStatusMessage('Desconectado del servidor');
      });

      socket.on('medico-no-disponible', (data) => {
        setCalling(false);
        setQueuePosition(null);
        const mensaje = data?.mensaje || 'No hay médicos disponibles en este momento.';
        setStatusMessage(mensaje);
        Alert.alert('No Disponible', mensaje);
      });

      socket.on('en-cola', (data) => {
        console.log('En cola:', data);
        setQueuePosition(data.posicion);
        setQueueTotal(data.total);
        setMedicosDisponibles(data.medicosDisponibles);
        setStatusMessage(`En cola: posición ${data.posicion} de ${data.total}`);
      });

      socket.on('posicion-cola', (data) => {
        console.log('Posición actualizada:', data);
        setQueuePosition(data.posicion);
        setQueueTotal(data.total);
        setMedicosDisponibles(data.medicosDisponibles);
        setStatusMessage(`En cola: posición ${data.posicion} de ${data.total}`);
      });

      socket.on('medico-aceptado', async (data) => {
        console.log('Médico aceptó la llamada:', data);
        roomNameRef.current = data.roomName;
        setQueuePosition(null);
        setStatusMessage('Conectando videollamada...');
        await startVideoCall(data.roomName);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setStatus('error');
        setStatusMessage('Error de conexión');
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('Error connecting socket:', error);
      setStatusMessage('Error al conectar con el servidor');
    }
  };

  const handleUrgenciaMedica = () => {
    if (!hasPermission) {
      Alert.alert('Permisos Requeridos', 'Por favor, otorga permisos de cámara y micrófono.');
      requestPermissions();
      return;
    }

    if (status !== 'connected') {
      Alert.alert('Sin Conexión', 'No estás conectado al servidor. Verifica tu conexión a internet.');
      return;
    }

    setCurrentScreen('urgencia');
    llamarMedico();
  };

  const handleAgendarConsulta = () => {
    Alert.alert('Próximamente', 'Esta función estará disponible pronto.');
  };

  const handleDescargarCertificado = () => {
    Alert.alert('Próximamente', 'Esta función estará disponible pronto.');
  };

  const llamarMedico = () => {
    if (calling) return;

    setCalling(true);
    setStatusMessage('Buscando médico disponible...');

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('llamar-medico', {
        nombre: 'Paciente'
      });
    } else {
      setCalling(false);
      setStatusMessage('No conectado al servidor');
      Alert.alert('Error', 'No estás conectado al servidor. Verifica tu conexión.');
    }
  };

  const startVideoCall = async (roomName) => {
    try {
      console.log('Solicitando token de Twilio...');

      const response = await fetch(`${config.SERVER_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: 'paciente-' + Date.now(),
          room: roomName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Token recibido, conectando a sala:', roomName);

      if (twilioRef.current) {
        twilioRef.current.connect({
          roomName: roomName,
          accessToken: data.token,
          enableAudio: true,
          enableVideo: true
        });
      }

    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Error', 'No se pudo iniciar la videollamada: ' + error.message);
      setCalling(false);
      setStatusMessage('Error al conectar video');
    }
  };

  const endCall = () => {
    console.log('Finalizando llamada');
    if (twilioRef.current) {
      twilioRef.current.disconnect();
    }
    setInCall(false);
    setCalling(false);
    setVideoTracks(new Map());
    setQueuePosition(null);
    setCurrentScreen('home');
    setStatusMessage('Conectado');
  };

  const cancelarLlamada = () => {
    console.log('Cancelando llamada');
    if (socketRef.current) {
      socketRef.current.emit('cancelar-llamada');
    }
    setCalling(false);
    setQueuePosition(null);
    setCurrentScreen('home');
    setStatusMessage('Conectado');
  };

  const toggleAudio = () => {
    if (twilioRef.current) {
      twilioRef.current.setLocalAudioEnabled(!isAudioEnabled)
        .then(enabled => {
          setIsAudioEnabled(enabled);
          console.log('Audio:', enabled ? 'habilitado' : 'deshabilitado');
        });
    }
  };

  const toggleVideo = () => {
    if (twilioRef.current) {
      twilioRef.current.setLocalVideoEnabled(!isVideoEnabled)
        .then(enabled => {
          setIsVideoEnabled(enabled);
          console.log('Video:', enabled ? 'habilitado' : 'deshabilitado');
        });
    }
  };

  const flipCamera = () => {
    if (twilioRef.current) {
      twilioRef.current.flipCamera();
    }
  };

  // Eventos de Twilio Video
  const onRoomDidConnect = ({ roomName, error }) => {
    if (error) {
      console.error('Error conectando a sala:', error);
      Alert.alert('Error', 'No se pudo conectar a la videollamada');
      setCalling(false);
      return;
    }

    console.log('Conectado a sala:', roomName);
    setInCall(true);
    setCalling(false);
    setStatusMessage('En llamada con el médico');
  };

  const onRoomDidDisconnect = ({ roomName, error }) => {
    console.log('Desconectado de sala:', roomName);
    if (error) {
      console.error('Error al desconectar:', error);
    }
    setInCall(false);
    setCalling(false);
    setVideoTracks(new Map());
    setQueuePosition(null);
    setCurrentScreen('home');
    setStatusMessage('Llamada finalizada');
  };

  const onRoomDidFailToConnect = ({ roomName, error }) => {
    console.error('Fallo al conectar a sala:', error);
    Alert.alert('Error de Conexión', 'No se pudo conectar a la videollamada: ' + error);
    setInCall(false);
    setCalling(false);
    setCurrentScreen('home');
  };

  const onParticipantAddedVideoTrack = ({ participant, track }) => {
    console.log('Video track agregado:', participant.identity, track.trackSid);

    setVideoTracks(prevTracks => {
      const newTracks = new Map(prevTracks);
      newTracks.set(track.trackSid, {
        participantSid: participant.sid,
        videoTrackSid: track.trackSid,
        participantIdentity: participant.identity
      });
      return newTracks;
    });
  };

  const onParticipantRemovedVideoTrack = ({ participant, track }) => {
    console.log('Video track removido:', participant.identity, track.trackSid);

    setVideoTracks(prevTracks => {
      const newTracks = new Map(prevTracks);
      newTracks.delete(track.trackSid);
      return newTracks;
    });
  };

  // Pantalla Home
  const renderHome = () => (
    <View style={styles.homeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Logo centrado */}
      <View style={styles.logoContainer}>
        <Image
          source={require('./assets/bsl-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Botones en la parte inferior */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: colors.laPalma }]}
          onPress={handleUrgenciaMedica}
        >
          <Text style={styles.mainButtonText}>Urgencia Médica</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainButton, styles.outlineButton]}
          onPress={handleAgendarConsulta}
        >
          <Text style={[styles.mainButtonText, styles.outlineButtonText]}>Agendar Consulta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainButton, styles.outlineButton]}
          onPress={handleDescargarCertificado}
        >
          <Text style={[styles.mainButtonText, styles.outlineButtonText]}>Descargar Certificado</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Pantalla de Urgencia (esperando médico)
  const renderUrgencia = () => (
    <View style={styles.urgenciaContainer}>
      <StatusBar barStyle="light-content" backgroundColor={colors.greenHaze} />

      <TouchableOpacity style={styles.backButton} onPress={cancelarLlamada}>
        <Text style={styles.backButtonText}>← Volver</Text>
      </TouchableOpacity>

      <View style={styles.urgenciaContent}>
        <ActivityIndicator size="large" color={colors.white} />
        <Text style={styles.urgenciaTitle}>Buscando médico</Text>
        <Text style={styles.urgenciaSubtitle}>{statusMessage}</Text>

        {queuePosition && (
          <View style={styles.queueInfo}>
            <Text style={styles.queuePosition}>
              Posición {queuePosition} de {queueTotal}
            </Text>
            <Text style={styles.queueMedicos}>
              {medicosDisponibles > 0
                ? `${medicosDisponibles} médico(s) disponible(s)`
                : 'Esperando médico disponible...'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cancelContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={cancelarLlamada}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Pantalla de videollamada
  const renderVideoCall = () => (
    <View style={styles.videoContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Video remoto (médico) - pantalla completa */}
      {Array.from(videoTracks, ([trackSid, trackIdentifier]) => (
        <TwilioVideoParticipantView
          style={styles.remoteVideo}
          key={trackSid}
          trackIdentifier={trackIdentifier}
        />
      ))}

      {/* Video local (paciente) - esquina */}
      <TwilioVideoLocalView
        enabled={true}
        style={styles.localVideo}
      />

      {/* Controles */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, !isAudioEnabled && styles.controlButtonOff]}
          onPress={toggleAudio}
        >
          <Text style={styles.controlButtonText}>
            {isAudioEnabled ? '🎤' : '🔇'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={endCall}
        >
          <Text style={styles.controlButtonText}>📞</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !isVideoEnabled && styles.controlButtonOff]}
          onPress={toggleVideo}
        >
          <Text style={styles.controlButtonText}>
            {isVideoEnabled ? '📹' : '🚫'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={flipCamera}
        >
          <Text style={styles.controlButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {currentScreen === 'home' && !inCall && renderHome()}
      {currentScreen === 'urgencia' && !inCall && renderUrgencia()}
      {inCall && renderVideoCall()}

      {/* Componente TwilioVideo - invisible pero necesario */}
      <TwilioVideo
        ref={twilioRef}
        onRoomDidConnect={onRoomDidConnect}
        onRoomDidDisconnect={onRoomDidDisconnect}
        onRoomDidFailToConnect={onRoomDidFailToConnect}
        onParticipantAddedVideoTrack={onParticipantAddedVideoTrack}
        onParticipantRemovedVideoTrack={onParticipantRemovedVideoTrack}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // Home Screen
  homeContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: width * 0.7,
    height: width * 0.5,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    gap: 12,
  },
  mainButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.abbey,
  },
  outlineButtonText: {
    color: colors.abbey,
  },

  // Urgencia Screen
  urgenciaContainer: {
    flex: 1,
    backgroundColor: colors.greenHaze,
  },
  backButton: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  urgenciaContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  urgenciaTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 30,
    marginBottom: 10,
  },
  urgenciaSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  queueInfo: {
    marginTop: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
  },
  queuePosition: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
  },
  queueMedicos: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  cancelContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Video Call Screen
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
    width: width,
    height: height,
  },
  localVideo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.white,
  },
  controls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(220,53,69,0.8)',
  },
  endCallButton: {
    backgroundColor: '#dc3545',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  controlButtonText: {
    fontSize: 28,
  },
});
