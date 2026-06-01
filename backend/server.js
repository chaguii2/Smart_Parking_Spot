// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ MongoDB erreur:', err));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const adminRoutes = require('./src/routes/admin');
const MockEmail = require('./src/models/MockEmail');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Endpoint pour récupérer les emails simulés
app.get('/api/mock-emails', async (req, res) => {
  try {
    const emails = await MockEmail.find().sort({ createdAt: -1 });
    res.json({ emails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vider les emails simulés
app.delete('/api/mock-emails', async (req, res) => {
  try {
    await MockEmail.deleteMany({});
    res.json({ message: 'Boîte de réception virtuelle vidée.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Servir les fichiers statiques du dossier frontend
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Rediriger toutes les autres requêtes HTML vers le frontend (SPA)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    return res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
  next();
});

// Démarrage serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Serveur démarré sur http://localhost:${PORT}`);
});

const User = require('./src/models/User');
const Parking = require('./src/models/Parking');

console.log('✅ Modèles Utilisateur et Parking chargés');