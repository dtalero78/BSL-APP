import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import io from 'socket.io-client';
import { config } from './config';

export default function App() {
  const [status, setStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('Conectando...');
  const [hasPermission, setHasPermission] = useState(false);
  const [calling, setCalling] = useState(false);
  const [inCall, setInCall] = useState(false);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const roomRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
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
        console.log('Médico aceptó la llamada');
        setStatusMessage('Conectando con el médico...');
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
      // Obtener token de Twilio
      const response = await fetch(`${config.SERVER_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identity: 'paciente',
          room: roomName
        })
      });

      const data = await response.json();

      // Para Twilio Video en React Native necesitarías usar react-native-twilio-video-webrtc
      // Como es una implementación más compleja, te recomendaría usar WebView
      // o implementar react-native-twilio-video-webrtc

      setInCall(true);
      setCalling(false);
      setStatusMessage('En llamada con el médico');

      Alert.alert(
        'Videollamada',
        'La videollamada debería iniciarse aquí. Para una implementación completa de video, considera usar react-native-twilio-video-webrtc o WebView.',
        [
          {
            text: 'Finalizar',
            onPress: endCall
          }
        ]
      );

    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Error', 'No se pudo iniciar la videollamada: ' + error.message);
      setCalling(false);
      setStatusMessage('Error al conectar video');
    }
  };

  const endCall = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setInCall(false);
    setCalling(false);
    setStatusMessage('Presiona el botón para llamar al médico');
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

        {inCall && (
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={endCall}
          >
            <Text style={styles.endCallButtonText}>
              Finalizar Llamada
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
  endCallButton: {
    marginTop: 20,
    paddingHorizontal: 40,
    paddingVertical: 15,
    backgroundColor: '#dc3545',
    borderRadius: 25,
  },
  endCallButtonText: {
    color: '#fff',
    fontSize: 18,
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
});
