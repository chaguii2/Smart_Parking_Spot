// backend/server.js
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARES ====================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== CONNEXION MONGODB ====================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ MongoDB erreur:', err));

// ==================== ROUTES ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Routes existantes
const authRoutes    = require('./src/routes/auth');
const userRoutes    = require('./src/routes/users');
const adminRoutes   = require('./src/routes/admin');

// Nouvelles routes intégrées
const iaRoutes      = require('./src/routes/ia');
const parkingRoutes = require('./src/routes/parking');

app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/ia',      iaRoutes);
app.use('/api/parking', parkingRoutes);

// ==================== MOCK EMAILS ====================
const MockEmail = require('./src/models/MockEmail');

app.get('/api/mock-emails', async (req, res) => {
  try {
    const emails = await MockEmail.find().sort({ createdAt: -1 });
    res.json({ emails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/mock-emails', async (req, res) => {
  try {
    await MockEmail.deleteMany({});
    res.json({ message: 'Boîte de réception virtuelle vidée.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FICHIERS STATIQUES (SPA) ====================
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
  next();
});

// ==================== GLOBAL ERROR HANDLER ====================
// Doit être déclaré APRÈS toutes les routes
const errorHandler = require('./src/middleware/errorHandler');
app.use(errorHandler);

// ==================== SERVEUR HTTP + SOCKET.IO ====================
const { initWebSocket } = require('./src/utils/websocket');
const server = http.createServer(app);
const io = initWebSocket(server);
app.set('io', io); // Rendre l'instance io disponible dans les controllers via req.app.get('io')

// ==================== DÉMARRAGE ====================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(` 🚀 Serveur Smart Parking démarré`);
  console.log(`========================================`);
  console.log(` 📡 API:        http://localhost:${PORT}/api`);
  console.log(` 🤖 IA Mistral: POST http://localhost:${PORT}/api/ia/chat`);
  console.log(` 🏥 IA Health:  GET  http://localhost:${PORT}/api/ia/health`);
  console.log(` 🗺️  Carte:      GET  http://localhost:${PORT}/api/parking/map/parkings`);
  console.log(` 🅿️  Places:     GET  http://localhost:${PORT}/api/parking/:id/spots`);
  console.log(`========================================\n`);
});

// Pré-charger les modèles pour éviter les warnings de ré-enregistrement
require('./src/models/User');
require('./src/models/Parking');
require('./src/models/ParkingSpot');

console.log('✅ Modèles Utilisateur, Parking et ParkingSpot chargés');