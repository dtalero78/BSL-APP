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
  Dimensions
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

export default function App() {
  const [status, setStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('Conectando...');
  const [hasPermission, setHasPermission] = useState(false);
  const [calling, setCalling] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [videoTracks, setVideoTracks] = useState(new Map());

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
        setStatusMessage('Presiona el botón para llamar al médico');
      });

      socket.on('disconnect', () => {
        console.log('Socket desconectado');
        setStatus('disconnected');
        setStatusMessage('Desconectado del servidor');
      });

      socket.on('medico-no-disponible', () => {
        setCalling(false);
        setStatusMessage('Médico no disponible. Intenta más tarde.');
        Alert.alert('No Disponible', 'El médico no está disponible en este momento.');
      });

      socket.on('medico-aceptado', async (data) => {
        console.log('Médico aceptó la llamada:', data);
        roomNameRef.current = data.roomName;
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

  const llamarMedico = () => {
    if (!hasPermission) {
      Alert.alert('Permisos Requeridos', 'Por favor, otorga permisos de cámara y micrófono.');
      return;
    }

    if (calling) return;

    setCalling(true);
    setStatusMessage('Llamando al médico...');

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

      // Obtener token de Twilio
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

      // Conectar a la sala de Twilio
      // Nota: No pasar enableAudio/enableVideo aquí debido a bug en iOS
      // El audio y video se habilitan por defecto
      if (twilioRef.current) {
        twilioRef.current.connect({
          roomName: roomName,
          accessToken: data.token
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
    setStatusMessage('Presiona el botón para llamar al médico');
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
    setStatusMessage('Llamada finalizada');
  };

  const onRoomDidFailToConnect = ({ roomName, error }) => {
    console.error('Fallo al conectar a sala:', error);
    Alert.alert('Error de Conexión', 'No se pudo conectar a la videollamada: ' + error);
    setInCall(false);
    setCalling(false);
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

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#28a745';
      case 'disconnected': return '#dc3545';
      case 'error': return '#ffc107';
      default: return '#6c757d';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {!inCall && (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>🏥 Atención Médica</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>
                {status === 'connected' ? '● Conectado' : '○ Desconectado'}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            <TouchableOpacity
              style={[
                styles.callButton,
                calling && styles.callingButton,
                !hasPermission && styles.disabledButton
              ]}
              onPress={llamarMedico}
              disabled={calling || !hasPermission || status !== 'connected'}
            >
              {calling ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Text style={styles.callButtonIcon}>📞</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.statusMessage}>{statusMessage}</Text>

            {!hasPermission && (
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermissions}
              >
                <Text style={styles.permissionButtonText}>
                  Otorgar Permisos
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Presiona el botón para llamar al médico
            </Text>
            <Text style={styles.footerSubtext}>
              Asegúrate de estar en un lugar tranquilo
            </Text>
          </View>
        </>
      )}

      {inCall && (
        <View style={styles.videoContainer}>
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
      )}

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
    backgroundColor: '#667eea',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  callButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#28a745',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  callingButton: {
    backgroundColor: '#ffc107',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
    opacity: 0.5,
  },
  callButtonIcon: {
    fontSize: 80,
  },
  statusMessage: {
    fontSize: 20,
    color: '#fff',
    marginTop: 30,
    textAlign: 'center',
    fontWeight: '500',
  },
  permissionButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  footerSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
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
    borderColor: '#fff',
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
