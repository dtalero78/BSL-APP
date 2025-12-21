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
  ImageBackground,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import io from 'socket.io-client';
import { WebView } from 'react-native-webview';
import { config } from './config';
import { Feather } from '@expo/vector-icons';

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
  const [currentScreen, setCurrentScreen] = useState('loading');
  const [status, setStatus] = useState('disconnected');
  const [statusMessage, setStatusMessage] = useState('Conectando...');
  const [hasPermission, setHasPermission] = useState(false);
  const [calling, setCalling] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [queuePosition, setQueuePosition] = useState(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [medicosDisponibles, setMedicosDisponibles] = useState(0);

  // Estado del usuario registrado
  const [userData, setUserData] = useState(null);
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');

  // Estado del formulario de agendar consulta
  const [formData, setFormData] = useState({
    primerNombre: '',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
    numeroId: '',
    celular: '',
    tipoConsulta: 'Ocupacional',
    modalidad: 'virtual',
    fecha: '',
    hora: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para turnos disponibles
  const [turnosDisponibles, setTurnosDisponibles] = useState([]);
  const [loadingTurnos, setLoadingTurnos] = useState(false);
  const [fechasProximas, setFechasProximas] = useState([]);

  // Estado para descargar certificado
  const [certificadoNumeroId, setCertificadoNumeroId] = useState('');
  const [isSearchingCertificado, setIsSearchingCertificado] = useState(false);

  const socketRef = useRef(null);
  const webViewRef = useRef(null);
  const roomNameRef = useRef(null);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    checkUserRegistration();
    requestPermissions();
    connectSocket();
    registerForPushNotifications();

    // Listener para notificaciones recibidas mientras la app está abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificación recibida:', notification);
    });

    // Listener para cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuario tocó notificación:', response);
      const data = response.notification.request.content.data;
      // Navegar según el tipo de notificación
      if (data?.type === 'medico-acepto') {
        // La app ya maneja esto por socket
      } else if (data?.type === 'recordatorio-cita') {
        setCurrentScreen('home');
      } else if (data?.type === 'certificado-listo') {
        setCurrentScreen('certificado');
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Registrar para notificaciones push
  const registerForPushNotifications = async () => {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications solo funcionan en dispositivos físicos');
        return;
      }

      // Verificar permisos existentes
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Pedir permisos si no los tiene
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('No se otorgaron permisos para notificaciones');
        return;
      }

      // Obtener el token de Expo Push
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      console.log('Push token:', token.data);

      // Guardar token localmente
      await AsyncStorage.setItem('pushToken', token.data);

      // Configurar canal de Android
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#16a330',
        });
      }

      return token.data;
    } catch (error) {
      console.error('Error registrando push notifications:', error);
    }
  };

  const checkUserRegistration = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('userData');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserData(user);
        setCurrentScreen('home');
      } else {
        setCurrentScreen('register');
      }
    } catch (error) {
      console.error('Error checking user registration:', error);
      setCurrentScreen('register');
    }
  };

  const handleRegister = async () => {
    if (!registerName.trim()) {
      Alert.alert('Campo Requerido', 'Por favor ingrese su nombre.');
      return;
    }
    if (!registerPhone.trim()) {
      Alert.alert('Campo Requerido', 'Por favor ingrese su número de celular.');
      return;
    }

    try {
      // Obtener push token
      const pushToken = await AsyncStorage.getItem('pushToken');

      const user = {
        nombre: registerName.trim(),
        celular: registerPhone.trim(),
        pushToken: pushToken
      };

      // Registrar usuario en el servidor
      try {
        await fetch(`${config.SERVER_URL}/registrar-usuario`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
      } catch (e) {
        console.log('No se pudo registrar en servidor:', e);
      }

      await AsyncStorage.setItem('userData', JSON.stringify(user));
      setUserData(user);
      setCurrentScreen('home');
    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Error', 'No se pudo guardar la información. Intente nuevamente.');
    }
  };

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
    // Generar próximos 14 días
    const proximos = [];
    const hoy = new Date();
    for (let i = 0; i < 14; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      const fechaStr = fecha.toISOString().split('T')[0];
      const diaSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][fecha.getDay()];
      const diaNum = fecha.getDate();
      const mes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][fecha.getMonth()];
      proximos.push({ fecha: fechaStr, diaSemana, diaNum, mes });
    }
    setFechasProximas(proximos);
    setCurrentScreen('agendar');
  };

  const updateFormField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Cargar turnos disponibles cuando cambia fecha o modalidad
  const cargarTurnosDisponibles = async (fecha, modalidad) => {
    if (!fecha) return;

    setLoadingTurnos(true);
    setTurnosDisponibles([]);

    try {
      const response = await fetch(
        `${config.PLATAFORMA_URL}/api/turnos-disponibles?fecha=${fecha}&modalidad=${modalidad}`
      );
      const data = await response.json();

      if (data.success && data.turnos) {
        // Filtrar solo horas con médicos disponibles
        const horasDisponibles = data.turnos
          .filter(t => t.disponible === true || t.cantidadDisponibles > 0)
          .map(t => t.hora);
        setTurnosDisponibles(horasDisponibles);
      } else {
        setTurnosDisponibles([]);
      }
    } catch (error) {
      console.error('Error cargando turnos:', error);
      setTurnosDisponibles([]);
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Cuando cambia fecha o modalidad, cargar turnos
  const handleFechaChange = (fecha) => {
    updateFormField('fecha', fecha);
    updateFormField('hora', ''); // Reset hora al cambiar fecha
    cargarTurnosDisponibles(fecha, formData.modalidad);
  };

  const handleModalidadChange = (modalidad) => {
    updateFormField('modalidad', modalidad);
    updateFormField('hora', ''); // Reset hora al cambiar modalidad
    if (formData.fecha) {
      cargarTurnosDisponibles(formData.fecha, modalidad);
    }
  };

  const submitAgendarConsulta = async () => {
    // Validar campos requeridos
    if (!formData.primerNombre || !formData.primerApellido || !formData.numeroId ||
        !formData.celular || !formData.fecha || !formData.hora) {
      Alert.alert('Campos Requeridos', 'Por favor complete todos los campos obligatorios.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Usar endpoint de BSL-PLATAFORMA para crear orden con asignación automática
      const response = await fetch(`${config.PLATAFORMA_URL}/api/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primerNombre: formData.primerNombre,
          segundoNombre: formData.segundoNombre,
          primerApellido: formData.primerApellido,
          segundoApellido: formData.segundoApellido,
          numeroId: formData.numeroId,
          celular: formData.celular,
          tipoExamen: formData.tipoConsulta,
          modalidad: formData.modalidad,
          fechaAtencion: formData.fecha,
          horaAtencion: formData.hora,
          asignarMedicoAuto: true // Asignación automática de médico
        })
      });

      const data = await response.json();

      if (data.success) {
        const fechaFormateada = new Date(formData.fecha).toLocaleDateString('es-CO', {
          weekday: 'long', day: 'numeric', month: 'long'
        });
        Alert.alert(
          'Consulta Agendada',
          `Su consulta ${formData.modalidad} ha sido agendada para el ${fechaFormateada} a las ${formData.hora}.${data.medico ? `\n\nMédico asignado: ${data.medico}` : ''}`,
          [{ text: 'OK', onPress: () => {
            setCurrentScreen('home');
            setFormData({
              primerNombre: '',
              segundoNombre: '',
              primerApellido: '',
              segundoApellido: '',
              numeroId: '',
              celular: '',
              tipoConsulta: 'Ocupacional',
              modalidad: 'virtual',
              fecha: '',
              hora: ''
            });
            setTurnosDisponibles([]);
          }}]
        );
      } else {
        Alert.alert('Error', data.error || 'No se pudo agendar la consulta.');
      }
    } catch (error) {
      console.error('Error agendando consulta:', error);
      Alert.alert('Error', 'Error de conexión. Por favor intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDescargarCertificado = () => {
    setCurrentScreen('certificado');
  };

  const buscarCertificado = async () => {
    if (!certificadoNumeroId.trim()) {
      Alert.alert('Campo Requerido', 'Por favor ingrese su número de documento.');
      return;
    }

    setIsSearchingCertificado(true);

    try {
      const response = await fetch(`${config.SERVER_URL}/buscar-certificado/${certificadoNumeroId.trim()}`);
      const data = await response.json();

      if (data.success && data.found) {
        Alert.alert(
          'Certificado Encontrado',
          `Se encontró el certificado para ${data.nombre}.\n\n¿Desea descargarlo?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Descargar',
              onPress: () => Linking.openURL(data.certificadoUrl)
            }
          ]
        );
      } else {
        Alert.alert('No Encontrado', data.error || 'No se encontró un certificado con ese número de documento.');
      }
    } catch (error) {
      console.error('Error buscando certificado:', error);
      Alert.alert('Error', 'Error de conexión. Por favor intente nuevamente.');
    } finally {
      setIsSearchingCertificado(false);
    }
  };

  const llamarMedico = async () => {
    if (calling) return;

    setCalling(true);
    setStatusMessage('Buscando médico disponible...');

    if (socketRef.current && socketRef.current.connected) {
      const pushToken = await AsyncStorage.getItem('pushToken');
      socketRef.current.emit('llamar-medico', {
        nombre: userData?.nombre || 'Paciente',
        celular: userData?.celular,
        pushToken: pushToken
      });
    } else {
      setCalling(false);
      setStatusMessage('No conectado al servidor');
      Alert.alert('Error', 'No estás conectado al servidor. Verifica tu conexión.');
    }
  };

  // WebView se conecta automáticamente, esta función ya no es necesaria
  // pero la mantenemos para compatibilidad con el flujo existente
  const startVideoCall = async (roomName) => {
    console.log('=== INICIANDO VIDEO CALL EN NAVEGADOR ===');
    console.log('Room name:', roomName);
    roomNameRef.current = roomName;

    // Generar identity único para el paciente
    const identity = 'paciente-' + Date.now();

    // Abrir la videollamada en el navegador del dispositivo
    const videoUrl = `${config.SERVER_URL}/paciente-mobile.html?room=${roomName}&identity=${identity}`;
    console.log('Abriendo URL:', videoUrl);

    try {
      await Linking.openURL(videoUrl);
      // Actualizar estado en la app
      setCalling(false);
      setStatusMessage('Videollamada abierta en navegador');
      // Mostrar instrucciones al usuario
      Alert.alert(
        'Videollamada Iniciada',
        'La videollamada se ha abierto en tu navegador. Cuando termines, regresa a esta app.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error abriendo navegador:', error);
      Alert.alert('Error', 'No se pudo abrir el navegador');
      setCalling(false);
    }
  };

  const endCall = () => {
    console.log('Finalizando llamada');

    // Enviar mensaje al WebView para desconectar
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'HANGUP' }));
    }

    setInCall(false);
    setCalling(false);
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
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);

    // Enviar mensaje al WebView
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'TOGGLE_AUDIO',
        enabled: newState
      }));
    }

    console.log('Audio:', newState ? 'habilitado' : 'deshabilitado');
  };

  const flipCamera = () => {
    // Enviar mensaje al WebView para cambiar cámara
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'FLIP_CAMERA' }));
    }
    console.log('Flip camera solicitado');
  };

  // Handler para mensajes del WebView
  const handleWebViewMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Mensaje del WebView:', message);

      switch (message.type) {
        case 'ROOM_CONNECTED':
          console.log('=== WEBVIEW: Conectado a sala ===');
          console.log('Room name:', message.roomName);
          setInCall(true);
          setCalling(false);
          setStatusMessage('En llamada con el médico');
          break;

        case 'ROOM_DISCONNECTED':
          console.log('=== WEBVIEW: Desconectado de sala ===');
          setInCall(false);
          setCalling(false);
          setQueuePosition(null);
          setCurrentScreen('home');
          setStatusMessage('Llamada finalizada');
          break;

        case 'ERROR':
          console.error('=== WEBVIEW: Error ===', message.error);
          Alert.alert('Error de Conexión', message.error);
          setInCall(false);
          setCalling(false);
          setCurrentScreen('home');
          break;

        default:
          console.log('Mensaje desconocido del WebView:', message.type);
      }
    } catch (error) {
      console.error('Error procesando mensaje del WebView:', error);
    }
  };

  // Pantalla de carga inicial
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ActivityIndicator size="large" color={colors.laPalma} />
    </View>
  );

  // Pantalla de Registro
  const renderRegister = () => (
    <ImageBackground
      source={require('./assets/home-bg.png')}
      style={styles.homeContainer}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <KeyboardAvoidingView
        style={styles.registerContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Espacio flexible */}
        <View style={styles.spacer} />

        {/* Formulario de registro */}
        <View style={styles.registerForm}>
          <Text style={styles.registerTitle}>Bienvenido</Text>
          <Text style={styles.registerSubtitle}>
            Para continuar, ingrese sus datos
          </Text>

          <TextInput
            style={styles.registerInput}
            value={registerName}
            onChangeText={setRegisterName}
            placeholder="Su nombre"
            placeholderTextColor="#999"
            autoCapitalize="words"
          />

          <TextInput
            style={styles.registerInput}
            value={registerPhone}
            onChangeText={setRegisterPhone}
            placeholder="Número de celular"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: colors.laPalma }]}
            onPress={handleRegister}
          >
            <Text style={styles.mainButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );

  // Pantalla Home
  const renderHome = () => (
    <ImageBackground
      source={require('./assets/home-bg.png')}
      style={styles.homeContainer}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Espacio flexible para empujar botones hacia abajo */}
      <View style={styles.spacer} />

      {/* Botones en la parte inferior */}
      <View style={styles.buttonsContainer}>
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

        <TouchableOpacity
          style={[styles.mainButton, { backgroundColor: colors.laPalma }]}
          onPress={handleUrgenciaMedica}
        >
          <Text style={styles.mainButtonText}>Urgencia Médica</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
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

  // Pantalla de Agendar Consulta
  const renderAgendarConsulta = () => (
    <KeyboardAvoidingView
      style={styles.formContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.formHeader}>
        <TouchableOpacity onPress={() => setCurrentScreen('home')}>
          <Text style={styles.formBackText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>Agendar Consulta</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formContent}>
          <Text style={styles.formSectionTitle}>Datos Personales</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Primer Nombre *</Text>
              <TextInput
                style={styles.input}
                value={formData.primerNombre}
                onChangeText={(v) => updateFormField('primerNombre', v)}
                placeholder="Ej: Juan"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Segundo Nombre</Text>
              <TextInput
                style={styles.input}
                value={formData.segundoNombre}
                onChangeText={(v) => updateFormField('segundoNombre', v)}
                placeholder="Ej: Carlos"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Primer Apellido *</Text>
              <TextInput
                style={styles.input}
                value={formData.primerApellido}
                onChangeText={(v) => updateFormField('primerApellido', v)}
                placeholder="Ej: Pérez"
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Segundo Apellido</Text>
              <TextInput
                style={styles.input}
                value={formData.segundoApellido}
                onChangeText={(v) => updateFormField('segundoApellido', v)}
                placeholder="Ej: García"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Número de Identificación *</Text>
          <TextInput
            style={styles.input}
            value={formData.numeroId}
            onChangeText={(v) => updateFormField('numeroId', v)}
            placeholder="Ej: 1234567890"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>Celular *</Text>
          <TextInput
            style={styles.input}
            value={formData.celular}
            onChangeText={(v) => updateFormField('celular', v)}
            placeholder="Ej: 3001234567"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
          />

          <Text style={styles.formSectionTitle}>Tipo de Consulta</Text>

          <View style={styles.tipoConsultaRow}>
            <TouchableOpacity
              style={[
                styles.tipoConsultaBtn,
                formData.tipoConsulta === 'Ocupacional' && styles.tipoConsultaBtnActive
              ]}
              onPress={() => updateFormField('tipoConsulta', 'Ocupacional')}
            >
              <Text style={[
                styles.tipoConsultaText,
                formData.tipoConsulta === 'Ocupacional' && styles.tipoConsultaTextActive
              ]}>Ocupacional</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tipoConsultaBtn,
                formData.tipoConsulta === 'Medicina General' && styles.tipoConsultaBtnActive
              ]}
              onPress={() => updateFormField('tipoConsulta', 'Medicina General')}
            >
              <Text style={[
                styles.tipoConsultaText,
                formData.tipoConsulta === 'Medicina General' && styles.tipoConsultaTextActive
              ]}>Medicina General</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formSectionTitle}>Modalidad</Text>

          <View style={styles.tipoConsultaRow}>
            <TouchableOpacity
              style={[
                styles.tipoConsultaBtn,
                formData.modalidad === 'virtual' && styles.tipoConsultaBtnActive
              ]}
              onPress={() => handleModalidadChange('virtual')}
            >
              <Text style={[
                styles.tipoConsultaText,
                formData.modalidad === 'virtual' && styles.tipoConsultaTextActive
              ]}>🖥️ Virtual</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tipoConsultaBtn,
                formData.modalidad === 'presencial' && styles.tipoConsultaBtnActive
              ]}
              onPress={() => handleModalidadChange('presencial')}
            >
              <Text style={[
                styles.tipoConsultaText,
                formData.modalidad === 'presencial' && styles.tipoConsultaTextActive
              ]}>🏥 Presencial</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formSectionTitle}>Selecciona una Fecha *</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.fechasScroll}
          >
            {fechasProximas.map((item) => (
              <TouchableOpacity
                key={item.fecha}
                style={[
                  styles.fechaCard,
                  formData.fecha === item.fecha && styles.fechaCardActive
                ]}
                onPress={() => handleFechaChange(item.fecha)}
              >
                <Text style={[
                  styles.fechaDiaSemana,
                  formData.fecha === item.fecha && styles.fechaTextActive
                ]}>{item.diaSemana}</Text>
                <Text style={[
                  styles.fechaDiaNum,
                  formData.fecha === item.fecha && styles.fechaTextActive
                ]}>{item.diaNum}</Text>
                <Text style={[
                  styles.fechaMes,
                  formData.fecha === item.fecha && styles.fechaTextActive
                ]}>{item.mes}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {formData.fecha && (
            <>
              <Text style={styles.formSectionTitle}>Selecciona una Hora *</Text>

              {loadingTurnos ? (
                <View style={styles.loadingTurnos}>
                  <ActivityIndicator color={colors.greenHaze} />
                  <Text style={styles.loadingTurnosText}>Cargando horarios disponibles...</Text>
                </View>
              ) : turnosDisponibles.length > 0 ? (
                <View style={styles.horasGrid}>
                  {turnosDisponibles.map((hora) => (
                    <TouchableOpacity
                      key={hora}
                      style={[
                        styles.horaCard,
                        formData.hora === hora && styles.horaCardActive
                      ]}
                      onPress={() => updateFormField('hora', hora)}
                    >
                      <Text style={[
                        styles.horaText,
                        formData.hora === hora && styles.horaTextActive
                      ]}>{hora}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.noTurnos}>
                  <Text style={styles.noTurnosText}>
                    No hay turnos disponibles para esta fecha y modalidad.
                  </Text>
                  <Text style={styles.noTurnosSubtext}>
                    Por favor selecciona otra fecha.
                  </Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={submitAgendarConsulta}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Agendar Consulta</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Pantalla de Descargar Certificado
  const renderCertificado = () => (
    <KeyboardAvoidingView
      style={styles.formContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.formHeader}>
        <TouchableOpacity onPress={() => {
          setCurrentScreen('home');
          setCertificadoNumeroId('');
        }}>
          <Text style={styles.formBackText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>Descargar Certificado</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.certificadoContent}>
        <Text style={styles.certificadoDescription}>
          Ingrese su número de documento para buscar y descargar su certificado médico.
        </Text>

        <Text style={styles.inputLabel}>Número de Documento *</Text>
        <TextInput
          style={styles.input}
          value={certificadoNumeroId}
          onChangeText={setCertificadoNumeroId}
          placeholder="Ej: 1234567890"
          placeholderTextColor="#999"
          keyboardType="numeric"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.submitButton, isSearchingCertificado && styles.submitButtonDisabled]}
          onPress={buscarCertificado}
          disabled={isSearchingCertificado}
        >
          {isSearchingCertificado ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Buscar Certificado</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // Pantalla de videollamada estilo Zoom
  const renderVideoCall = () => {
    const roomName = roomNameRef.current;
    const identity = 'paciente-' + Date.now();

    return (
      <View style={styles.videoContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* WebView con el video */}
        <WebView
          ref={webViewRef}
          source={{
            uri: `${config.SERVER_URL}/paciente-mobile.html?room=${roomName}&identity=${identity}`
          }}
          onMessage={handleWebViewMessage}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaCapture="camera,microphone"
          allowsProtectedMedia={true}
          startInLoadingState={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
          }}
          onLoadEnd={() => {
            console.log('WebView cargado completamente');
          }}
          style={styles.webView}
        />

        {/* Barra de controles inferior estilo Zoom */}
        <View style={styles.controlsBar}>
          <TouchableOpacity
            style={[styles.controlItem, !isAudioEnabled && styles.controlItemOff]}
            onPress={toggleAudio}
          >
            <Feather
              name={isAudioEnabled ? 'mic' : 'mic-off'}
              size={24}
              color={isAudioEnabled ? '#fff' : '#ff4d4d'}
            />
            <Text style={[styles.controlLabel, !isAudioEnabled && styles.controlLabelOff]}>
              {isAudioEnabled ? 'Mute' : 'Unmute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlItem}
            onPress={flipCamera}
          >
            <Feather name="refresh-cw" size={24} color="#fff" />
            <Text style={styles.controlLabel}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endCallButton}
            onPress={endCall}
          >
            <Feather name="phone-off" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {currentScreen === 'loading' && renderLoading()}
      {currentScreen === 'register' && renderRegister()}
      {currentScreen === 'home' && !inCall && renderHome()}
      {currentScreen === 'urgencia' && !inCall && renderUrgencia()}
      {currentScreen === 'agendar' && !inCall && renderAgendarConsulta()}
      {currentScreen === 'certificado' && !inCall && renderCertificado()}
      {inCall && renderVideoCall()}
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
  },
  spacer: {
    flex: 1,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    gap: 12,
  },
  mainButton: {
    paddingVertical: 18,
    borderRadius: 8,
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
    borderWidth: 1,
    borderColor: 'rgba(76, 76, 77, 0.4)',
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
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Video Call Screen - Zoom Style
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 15,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  headerBackButton: {
    padding: 8,
  },
  headerBackText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  encryptedIcon: {
    fontSize: 12,
    marginRight: 5,
  },
  encryptedText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  headerEndButton: {
    backgroundColor: '#e53935',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  headerEndText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    flex: 1,
    width: width,
    height: height,
  },
  waitingDoctor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingDoctorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '500',
  },
  localVideoWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 15,
    width: 100,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#333',
  },
  localVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  controlsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 15,
    backgroundColor: '#232323',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  controlItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  controlItemOff: {
    opacity: 0.7,
  },
  controlIconOff: {
    opacity: 0.5,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '400',
  },
  controlLabelOff: {
    color: '#ff4444',
  },
  endCallButton: {
    backgroundColor: '#e53935',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  endCallText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Formulario Agendar Consulta
  formContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: colors.white,
  },
  formBackText: {
    color: colors.laPalma,
    fontSize: 16,
    fontWeight: '500',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.abbey,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.abbey,
    marginTop: 20,
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 5,
  },
  inputHalf: {
    flex: 1,
  },
  inputThird: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.abbey,
    backgroundColor: '#fafafa',
  },
  tipoConsultaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tipoConsultaBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  tipoConsultaBtnActive: {
    backgroundColor: colors.laPalma,
    borderColor: colors.laPalma,
  },
  tipoConsultaText: {
    fontSize: 14,
    color: colors.abbey,
    fontWeight: '500',
  },
  tipoConsultaTextActive: {
    color: colors.white,
  },

  // Estilos para selector de fechas
  fechasScroll: {
    marginBottom: 20,
  },
  fechaCard: {
    width: 70,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  fechaCardActive: {
    backgroundColor: colors.laPalma,
    borderColor: colors.laPalma,
  },
  fechaDiaSemana: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fechaDiaNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.abbey,
  },
  fechaMes: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fechaTextActive: {
    color: colors.white,
  },

  // Estilos para selector de horas
  horasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  horaCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
    minWidth: 70,
    alignItems: 'center',
  },
  horaCardActive: {
    backgroundColor: colors.greenHaze,
    borderColor: colors.greenHaze,
  },
  horaText: {
    fontSize: 14,
    color: colors.abbey,
    fontWeight: '500',
  },
  horaTextActive: {
    color: colors.white,
  },
  loadingTurnos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingTurnosText: {
    color: '#666',
    fontSize: 14,
  },
  noTurnos: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noTurnosText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  noTurnosSubtext: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },

  submitButton: {
    backgroundColor: colors.laPalma,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Pantalla Certificado
  certificadoContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  certificadoDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },

  // Pantalla Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  // Pantalla Registro
  registerContainer: {
    flex: 1,
  },
  registerForm: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 20,
    marginBottom: Platform.OS === 'ios' ? 40 : 30,
    borderRadius: 16,
    padding: 24,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.abbey,
    textAlign: 'center',
    marginBottom: 8,
  },
  registerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  registerInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.abbey,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
});
