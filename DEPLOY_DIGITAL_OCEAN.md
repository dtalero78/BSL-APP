# 🚀 Deploy en Digital Ocean

Guía completa para desplegar la aplicación BSL en Digital Ocean.

## Opción 1: Digital Ocean App Platform (Recomendado - Más Fácil)

### 1. Crear App desde GitHub

1. Ve a [Digital Ocean App Platform](https://cloud.digitalocean.com/apps)
2. Click en "Create App"
3. Selecciona "GitHub" y conecta tu repositorio `BSL-APP`
4. Configura:
   - **Branch**: `main`
   - **Autodeploy**: Enabled
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
   - **Port**: 3000 (o usa la variable de entorno PORT)

### 2. Configurar Variables de Entorno

En la sección "Environment Variables" de tu app, agrega:

```
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_API_KEY_SID=tu_api_key_sid
TWILIO_API_KEY_SECRET=tu_api_key_secret
NODE_ENV=production
```

### 3. Deploy

- Click en "Create Resources"
- Espera 3-5 minutos
- Digital Ocean te dará una URL como: `https://bsl-app-xxxxx.ondigitalocean.app`

### 4. Acceder a tu App

- **Médico**: `https://tu-app.ondigitalocean.app/medico.html`
- **Paciente**: `https://tu-app.ondigitalocean.app/paciente.html`

---

## Opción 2: Digital Ocean Droplet (Servidor VPS)

### 1. Crear Droplet

1. Ve a [Digital Ocean Droplets](https://cloud.digitalocean.com/droplets)
2. Click "Create Droplet"
3. Selecciona:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/mes)
   - **CPU**: Regular (1GB RAM)
   - **Datacenter**: El más cercano a ti
4. Agrega tu SSH key o usa password

### 2. Conectar al Droplet

```bash
ssh root@tu_droplet_ip
```

### 3. Instalar Node.js y PM2

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PM2 (process manager)
npm install -g pm2

# Verificar instalación
node --version
npm --version
```

### 4. Clonar y Configurar el Proyecto

```bash
# Instalar git si no está
apt install -y git

# Clonar repositorio
cd /var/www
git clone https://github.com/dtalero78/BSL-APP.git
cd BSL-APP

# Instalar dependencias
npm install

# Crear archivo .env
nano .env
```

Pega tu configuración:
```
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_API_KEY_SID=tu_api_key_sid
TWILIO_API_KEY_SECRET=tu_api_key_secret
PORT=3000
NODE_ENV=production
```

Guarda con `Ctrl+O`, `Enter`, `Ctrl+X`

### 5. Iniciar con PM2

```bash
# Iniciar aplicación
pm2 start server/index.js --name bsl-app

# Configurar PM2 para auto-inicio
pm2 startup
pm2 save

# Ver logs
pm2 logs bsl-app

# Ver estado
pm2 status
```

### 6. Configurar Nginx (Proxy Reverso)

```bash
# Instalar Nginx
apt install -y nginx

# Crear configuración
nano /etc/nginx/sites-available/bsl-app
```

Pega esta configuración:
```nginx
server {
    listen 80;
    server_name tu_dominio.com;  # O tu IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO específico
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar configuración
ln -s /etc/nginx/sites-available/bsl-app /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test y reiniciar Nginx
nginx -t
systemctl restart nginx
```

### 7. Configurar Firewall

```bash
# Permitir SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

### 8. Configurar SSL con Let's Encrypt (HTTPS)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d tu_dominio.com

# Auto-renovación (ya configurada por defecto)
certbot renew --dry-run
```

### 9. Acceder a tu App

- **Médico**: `http://tu_ip_o_dominio/medico.html`
- **Paciente**: `http://tu_ip_o_dominio/paciente.html`

---

## 🔧 Comandos Útiles para Droplet

```bash
# Ver logs en tiempo real
pm2 logs bsl-app --lines 100

# Reiniciar aplicación
pm2 restart bsl-app

# Detener aplicación
pm2 stop bsl-app

# Ver uso de recursos
pm2 monit

# Actualizar código
cd /var/www/BSL-APP
git pull
npm install
pm2 restart bsl-app

# Ver logs de Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

## 📱 Para Usar desde Celular

Una vez desplegado:

1. **Médico**: Abre en computadora
   - `https://tu-dominio.com/medico.html`

2. **Paciente**: Abre desde celular
   - `https://tu-dominio.com/paciente.html`

## ⚠️ Notas Importantes

### CORS
✅ Ya está configurado para aceptar conexiones de cualquier origen
- `origin: "*"` permite todas las conexiones
- Funciona con WebSockets y polling
- No deberías tener problemas de CORS

### HTTPS Requerido para Producción
⚠️ Twilio **requiere HTTPS** para:
- Acceso a cámara/micrófono en móviles
- Producción (localhost funciona sin HTTPS)

### Solución si no tienes dominio:
1. Usa la IP del droplet temporalmente para testing
2. Para producción, compra un dominio barato ($10/año en Namecheap)
3. O usa un subdominio gratuito de Digital Ocean

## 💰 Costos Estimados

### App Platform (Recomendado para empezar)
- **Starter**: $5/mes
- Auto-scaling incluido
- SSL automático
- Más fácil de mantener

### Droplet
- **Basic**: $6/mes (1GB RAM)
- Requiere más configuración
- Mayor control
- Mejor para escalar

## 🆘 Solución de Problemas

### Video no funciona en producción
✅ Asegúrate de usar HTTPS (Let's Encrypt es gratis)

### Socket.IO no conecta
✅ Verifica configuración de Nginx para WebSockets
✅ Revisa firewall (puerto 80/443 abierto)

### Errores 502 Bad Gateway
✅ Verifica que PM2 esté corriendo: `pm2 status`
✅ Revisa logs: `pm2 logs bsl-app`

### App se cae
✅ PM2 la reinicia automáticamente
✅ Revisa uso de memoria: `pm2 monit`
