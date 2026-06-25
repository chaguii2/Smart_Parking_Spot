const PDFDocument = require('pdfkit');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Parking = require('../models/Parking');
const Reservation = require('../models/Reservation');
const ParkingSpot = require('../models/ParkingSpot');
const { sendEmail } = require('../utils/emailService');

const isAdminRole = (role) => ['admin', 'super_admin'].includes(role);

const buildComplaintCreatedEmail = (user, complaint) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #6366f1; text-align: center;">Réclamation reçue</h2>
    <p>Bonjour <strong>${user.name}</strong>,</p>
    <p>Nous avons bien reçu votre réclamation <strong>"${complaint.title}"</strong>.</p>
    <p>Détails :</p>
    <ul>
      <li><strong>Catégorie :</strong> ${complaint.category}</li>
      <li><strong>Priorité :</strong> ${complaint.priority}</li>
      <li><strong>Statut :</strong> ${complaint.status}</li>
    </ul>
    <p>Notre équipe va prendre en charge votre demande et vous tiendra informé(e) des prochaines étapes.</p>
    <p>Merci de votre confiance.</p>
    <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #6b7280; text-align: center;">Smart Parking — Email automatique.</p>
  </div>
`;

const buildComplaintNotificationEmail = (adminEmails, complaint, submitter) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #6366f1; text-align: center;">Nouvelle réclamation reçue</h2>
    <p>Une nouvelle réclamation a été soumise par <strong>${submitter.name}</strong> (${submitter.email}).</p>
    <p>Détails :</p>
    <ul>
      <li><strong>Titre :</strong> ${complaint.title}</li>
      <li><strong>Catégorie :</strong> ${complaint.category}</li>
      <li><strong>Priorité :</strong> ${complaint.priority}</li>
      <li><strong>Statut :</strong> ${complaint.status}</li>
    </ul>
    <p>Vous pouvez la consulter dans l'administration des réclamations.</p>
    <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #6b7280; text-align: center;">Smart Parking — Email automatique.</p>
  </div>
`;

const buildComplaintStatusUpdateEmail = (user, complaint, status, response) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #6366f1; text-align: center;">Mise à jour de votre réclamation</h2>
    <p>Bonjour <strong>${user.name}</strong>,</p>
    <p>Le statut de votre réclamation <strong>"${complaint.title}"</strong> a été mis à jour.</p>
    <p><strong>Nouveau statut :</strong> ${status}</p>
    ${response ? `<p><strong>Réponse de l'équipe :</strong><br/>${response}</p>` : ''}
    <p>Vous pouvez consulter les détails dans votre espace de réclamations.</p>
    <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
    <p style="font-size: 12px; color: #6b7280; text-align: center;">Smart Parking — Email automatique.</p>
  </div>
`;

// ==================== CREATE ====================
// POST /api/complaints
const createComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, parkingId, reservationId, spotId, attachments } = req.body;
    const userId = req.user?.id || req.body.submittedBy; // From auth middleware

    // Validation: Required fields
    if (!title || !description || !category || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Champs requis manquants: title, description, category',
        required: ['title', 'description', 'category']
      });
    }

    const submitter = await User.findById(userId);
    if (!submitter) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur soumetteur non trouvé'
      });
    }

    // Validate category
    const validCategories = [
      'technical_issue',
      'reservation_problem',
      'payment_problem',
      'parking_problem',
      'application_bug',
      'employee_issue',
      'service_issue',
      'other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Catégorie invalide. Doit être l'une de: ${validCategories.join(', ')}`
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Determine submittedByType based on user role
    const submittedByType = user.role === 'client' ? 'client' : 'employee';

    // Validate references if provided
    if (parkingId) {
      const parking = await Parking.findById(parkingId);
      if (!parking) {
        return res.status(404).json({
          success: false,
          message: 'Le parking référencé n\'existe pas'
        });
      }
    }

    if (reservationId) {
      const reservation = await Reservation.findById(reservationId);
      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'La réservation référencée n\'existe pas'
        });
      }
    }

    if (spotId) {
      const spot = await ParkingSpot.findById(spotId);
      if (!spot) {
        return res.status(404).json({
          success: false,
          message: 'La place de parking référencée n\'existe pas'
        });
      }
    }

    // Create complaint
    const complaint = new Complaint({
      title: title.trim(),
      description: description.trim(),
      category,
      priority: priority || 'medium',
      submittedByType,
      submittedBy: userId,
      parkingId: parkingId || null,
      reservationId: reservationId || null,
      spotId: spotId || null,
      attachments: attachments || []
    });

    const savedComplaint = await complaint.save();

    // Populate references for response
    const populatedComplaint = await Complaint.findById(savedComplaint._id)
      .populate('submittedBy', 'name email role')
      .populate('parkingId', 'name address city')
      .populate('reservationId', 'startTime endTime vehiclePlate')
      .populate('spotId', 'spotNumber spotType');

    // Send notification emails
    await sendEmail(
      submitter.email,
      `Réclamation reçue : ${savedComplaint.title}`,
      buildComplaintCreatedEmail(submitter, populatedComplaint)
    );

    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] }, isActive: true });
    if (admins.length > 0) {
      const adminEmails = admins.map(admin => admin.email).join(', ');
      await sendEmail(
        adminEmails,
        `Nouvelle réclamation soumise : ${savedComplaint.title}`,
        buildComplaintNotificationEmail(adminEmails, populatedComplaint, submitter)
      );
    }

    res.status(201).json({
      success: true,
      message: 'Réclamation créée avec succès',
      data: populatedComplaint
    });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réclamation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== READ - ALL ====================
// GET /api/complaints?status=pending&priority=high&category=technical_issue
const getAllComplaints = async (req, res) => {
  try {
    const { status, priority, category, submittedByType, parkingId, sortBy = '-createdAt' } = req.query;
    const { role, id: userId } = req.user || {};

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (submittedByType) filter.submittedByType = submittedByType;
    if (parkingId) filter.parkingId = parkingId;

    // Clients can only see their own complaints, admins see all
    if (!isAdminRole(role) && userId) {
      filter.submittedBy = userId;
    }

    const complaints = await Complaint.find(filter)
      .populate('submittedBy', 'name email role phone')
      .populate('parkingId', 'name address city pricePerHour')
      .populate('reservationId', 'startTime endTime totalPrice status')
      .populate('spotId', 'spotNumber spotType level')
      .populate('assignedTo', 'name email role')
      .sort(sortBy)
      .exec();

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réclamations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== READ - BY ID ====================
// GET /api/complaints/:id
const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user || {};

    const complaint = await Complaint.findById(id)
      .populate('submittedBy', 'name email role phone vehiclePlate')
      .populate('parkingId', 'name address city pricePerHour totalSpots')
      .populate('reservationId', 'startTime endTime vehiclePlate totalPrice status')
      .populate('spotId', 'spotNumber spotType level floor')
      .populate('assignedTo', 'name email role phone');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Réclamation non trouvée'
      });
    }

    // Authorization: clients can only view their own complaints, admins can view all
    if (!isAdminRole(role) && complaint.submittedBy._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cette réclamation'
      });
    }

    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la réclamation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== READ - BY USER ====================
// GET /api/complaints/user/:userId
const getComplaintsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, id: currentUserId } = req.user || {};

    // Authorization: users can only view their own complaints, admins can view any user's
    if (!isAdminRole(role) && userId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const complaints = await Complaint.find({ submittedBy: userId })
      .populate('submittedBy', 'name email role')
      .populate('parkingId', 'name address city')
      .populate('reservationId', 'startTime endTime vehiclePlate')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error('Error fetching user complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réclamations utilisateur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== READ - BY PARKING ====================
// GET /api/complaints/parking/:parkingId
const getComplaintsByParking = async (req, res) => {
  try {
    const { parkingId } = req.params;

    // Validate parking exists
    const parking = await Parking.findById(parkingId);
    if (!parking) {
      return res.status(404).json({
        success: false,
        message: 'Le parking n\'existe pas'
      });
    }

    const complaints = await Complaint.find({ parkingId })
      .populate('submittedBy', 'name email role vehiclePlate')
      .populate('assignedTo', 'name email role')
      .populate('reservationId', 'startTime endTime vehiclePlate totalPrice')
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints
    });
  } catch (error) {
    console.error('Error fetching parking complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réclamations du parking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== UPDATE - STATUS (Admin Only) ====================
// PUT /api/complaints/:id/status
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response, assignedTo } = req.body;
    const { role } = req.user || {};

    // Authorization: only admin can update status
    if (!isAdminRole(role)) {
      return res.status(403).json({
        success: false,
        message: 'Seul un administrateur peut mettre à jour le statut'
      });
    }

    // Validation
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Doit être l'un de: ${validStatuses.join(', ')}`
      });
    }

    // Find complaint
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Réclamation non trouvée'
      });
    }

    // Validate assignedTo if provided
    if (assignedTo) {
      const admin = await User.findById(assignedTo);
      if (!admin || !isAdminRole(admin.role)) {
        return res.status(400).json({
          success: false,
          message: 'L\'utilisateur assigné doit être un administrateur'
        });
      }
    }

    // Update complaint
    complaint.status = status;
    if (response) complaint.response = response;
    if (assignedTo) complaint.assignedTo = assignedTo;

    const updatedComplaint = await complaint.save();

    // Populate and return
    const populatedComplaint = await Complaint.findById(updatedComplaint._id)
      .populate('submittedBy', 'name email role')
      .populate('parkingId', 'name address city')
      .populate('assignedTo', 'name email role')
      .populate('reservationId', 'startTime endTime vehiclePlate');

    await sendEmail(
      populatedComplaint.submittedBy.email,
      `Mise à jour de votre réclamation : ${populatedComplaint.title}`,
      buildComplaintStatusUpdateEmail(
        populatedComplaint.submittedBy,
        populatedComplaint,
        updatedComplaint.status,
        response
      )
    );

    if (populatedComplaint.assignedTo?.email) {
      await sendEmail(
        populatedComplaint.assignedTo.email,
        `Nouvelle réclamation assignée : ${populatedComplaint.title}`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #6366f1; text-align: center;">Nouvelle réclamation assignée</h2>
            <p>Bonjour <strong>${populatedComplaint.assignedTo.name}</strong>,</p>
            <p>La réclamation <strong>"${populatedComplaint.title}"</strong> a été mise à jour et vous est assignée.</p>
            <p><strong>Statut :</strong> ${updatedComplaint.status}</p>
            <p><strong>Soumis par :</strong> ${populatedComplaint.submittedBy.name} (${populatedComplaint.submittedBy.email})</p>
            <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280; text-align: center;">Smart Parking — Email automatique.</p>
          </div>
        `
      );
    }

    res.status(200).json({
      success: true,
      message: 'Statut de la réclamation mis à jour avec succès',
      data: populatedComplaint
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== UPDATE - RESOLUTION FEEDBACK ====================
// PUT /api/complaints/:id/feedback
const updateResolutionFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionRating, resolutionFeedback } = req.body;
    const { id: userId } = req.user || {};

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Réclamation non trouvée'
      });
    }

    // Only the original submitter can leave feedback
    if (complaint.submittedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Seul l\'auteur de la réclamation peut laisser un feedback'
      });
    }

    // Only allow feedback on resolved complaints
    if (complaint.status !== 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Vous pouvez uniquement évaluer les réclamations résolues'
      });
    }

    if (resolutionRating) {
      if (![1, 2, 3, 4, 5].includes(resolutionRating)) {
        return res.status(400).json({
          success: false,
          message: 'La note doit être entre 1 et 5'
        });
      }
      complaint.resolutionRating = resolutionRating;
    }

    if (resolutionFeedback) {
      complaint.resolutionFeedback = resolutionFeedback.trim();
    }

    const updatedComplaint = await complaint.save();

    res.status(200).json({
      success: true,
      message: 'Feedback enregistré avec succès',
      data: updatedComplaint
    });
  } catch (error) {
    console.error('Error updating resolution feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== DELETE ====================
// DELETE /api/complaints/:id
const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user || {};

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Réclamation non trouvée'
      });
    }

    // Authorization: Only admin or original submitter can delete
    if (!isAdminRole(role) && complaint.submittedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à supprimer cette réclamation'
      });
    }

    // Don't delete resolved complaints (soft delete or archive would be better)
    if (complaint.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Les réclamations résolues ne peuvent pas être supprimées (archivées)'
      });
    }

    const deletedComplaint = await Complaint.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Réclamation supprimée avec succès',
      data: deletedComplaint
    });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la réclamation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ==================== STATISTICS (Admin Only) ====================
// GET /api/complaints/stats/overview
const getComplaintStats = async (req, res) => {
  try {
    const { role } = req.user || {};

    if (!isAdminRole(role)) {
      return res.status(403).json({
        success: false,
        message: 'Seul un administrateur peut accéder aux statistiques'
      });
    }

    const stats = await Complaint.aggregate([
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: '$submittedByType', count: { $sum: 1 } } }
          ],
          total: [
            { $count: 'count' }
          ],
          averageResolutionTime: [
            {
              $match: { resolvedAt: { $ne: null } }
            },
            {
              $project: {
                resolutionTime: {
                  $subtract: ['$resolvedAt', '$createdAt']
                }
              }
            },
            {
              $group: {
                _id: null,
                avgMs: { $avg: '$resolutionTime' }
              }
            }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Error fetching complaint stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const exportComplaintsPdf = async (req, res) => {
  try {
    const { role, id: userId } = req.user || {};
    const { status, priority, category, submittedByType, parkingId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (submittedByType) filter.submittedByType = submittedByType;
    if (parkingId) filter.parkingId = parkingId;

    if (!isAdminRole(role) && userId) {
      filter.submittedBy = userId;
    }

    const complaints = await Complaint.find(filter)
      .populate('submittedBy', 'name email role phone')
      .populate('parkingId', 'name address city')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .exec();

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `complaints_export_${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.fontSize(18).text('Rapport des réclamations', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).text(`Date d'export: ${new Date().toLocaleString()}`);
    doc.text(`Utilisateur: ${req.user?.name || 'N/A'} (${req.user?.email || 'N/A'})`);
    doc.moveDown(1);

    complaints.forEach((complaint, index) => {
      doc.fontSize(12).fillColor('#333').text(`${index + 1}. ${complaint.title}`, { underline: true });
      doc.fontSize(10).fillColor('#000');
      doc.text(`Statut: ${complaint.status}`);
      doc.text(`Priorité: ${complaint.priority}`);
      doc.text(`Catégorie: ${complaint.category}`);
      doc.text(`Soumis par: ${complaint.submittedBy?.name || 'N/A'} (${complaint.submittedBy?.email || 'N/A'})`);
      doc.text(`Parking: ${complaint.parkingId?.name || 'Aucun'}`);
      doc.text(`Assigné à: ${complaint.assignedTo?.name || 'Aucun'}`);
      doc.text(`Créé le: ${complaint.createdAt.toLocaleString()}`);
      doc.moveDown(0.5);
      doc.text('Description:', { underline: true });
      doc.text(complaint.description, { indent: 20, continued: false });
      if (complaint.response) {
        doc.moveDown(0.2);
        doc.text('Réponse admin:', { underline: true });
        doc.text(complaint.response, { indent: 20, continued: false });
      }
      if (complaint.resolutionRating) {
        doc.text(`Note de résolution: ${complaint.resolutionRating}/5`);
      }
      doc.moveDown(1);
      if (index < complaints.length - 1) {
        doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
        doc.moveDown(1);
      }
    });

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Error exporting complaints PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export PDF des réclamations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createComplaint,
  getAllComplaints,
  getComplaintById,
  getComplaintsByUser,
  getComplaintsByParking,
  updateComplaintStatus,
  updateResolutionFeedback,
  deleteComplaint,
  getComplaintStats,
  exportComplaintsPdf
};
