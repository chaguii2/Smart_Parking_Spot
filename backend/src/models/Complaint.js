const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    // Basic complaint information
    title: {
      type: String,
      required: [true, 'Le titre de la réclamation est requis'],
      trim: true,
      minlength: [5, 'Le titre doit contenir au moins 5 caractères']
    },
    description: {
      type: String,
      required: [true, 'La description de la réclamation est requise'],
      minlength: [10, 'La description doit contenir au moins 10 caractères']
    },

    // Categorization
    category: {
      type: String,
      enum: [
        'technical_issue',
        'reservation_problem',
        'payment_problem',
        'parking_problem',
        'application_bug',
        'employee_issue',
        'service_issue',
        'other'
      ],
      required: [true, 'La catégorie est requise']
    },

    // Priority level
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },

    // Status workflow (admin updates this)
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'rejected'],
      default: 'pending'
    },

    // Who submitted the complaint
    submittedByType: {
      type: String,
      enum: ['client', 'employee'],
      required: [true, 'Le type de soumetteur est requis']
    },

    // Reference to User who submitted (client or employee)
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'L\'ID de l\'utilisateur est requis']
    },

    // Optional reference to parking - for parking-related complaints
    parkingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Parking',
      default: null
    },

    // Optional reference to reservation - for reservation-related complaints
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null
    },

    // Optional reference to parking spot - for spot-related complaints
    spotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSpot',
      default: null
    },

    // Admin management
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Null until admin assigns
      validate: {
        validator: async function(value) {
          if (!value) return true;
          // Optional: validate that assigned user has admin role
          const user = await mongoose.model('User').findById(value);
          return user && user.role === 'admin';
        },
        message: 'L\'utilisateur assigné doit être un administrateur'
      }
    },

    // Admin response/resolution notes
    response: {
      type: String,
      default: null,
      maxlength: [2000, 'La réponse ne peut pas dépasser 2000 caractères']
    },

    // Attachments/Evidence (URL paths or file names)
    attachments: [{
      type: String,
      default: null
    }],

    // Rating of resolution (if resolved)
    resolutionRating: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      default: null
    },

    // Customer feedback on resolution
    resolutionFeedback: {
      type: String,
      default: null,
      maxlength: [500, 'Le feedback ne peut pas dépasser 500 caractères']
    },

    // Timestamp for resolution
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for better query performance
complaintSchema.index({ submittedBy: 1, createdAt: -1 });
complaintSchema.index({ status: 1, priority: -1 });
complaintSchema.index({ parkingId: 1 });
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ category: 1 });

// Virtual for age of complaint in days
complaintSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Middleware: Auto-set resolvedAt when status changes to resolved
complaintSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
