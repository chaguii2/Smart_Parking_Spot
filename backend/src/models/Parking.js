const mongoose = require('mongoose');

const parkingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du parking est requis'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'L\'adresse est requise'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'La ville est requise'],
    trim: true
  },
  zipCode: {
    type: String,
    required: [true, 'Le code postal est requis'],
    trim: true
  },
  totalSpots: {
    type: Number,
    required: [true, 'Le nombre total de places est requis'],
    min: [1, 'Le parking doit contenir au moins 1 place']
  },
  pricePerHour: {
    type: Number,
    required: [true, 'Le prix par heure est requis'],
    min: [0, 'Le prix doit être positif']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const Parking = mongoose.model('Parking', parkingSchema);
module.exports = Parking;
