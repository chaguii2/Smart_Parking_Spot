const { validationResult } = require('express-validator');
const User = require('../models/User');
const UserRoles = require('../models/UserRoles');
const Parking = require('../models/Parking');
const { sendEmail } = require('../utils/emailService');

// Obtenir la liste de toutes les entreprises
exports.getCompanies = async (req, res) => {
  try {
    const companies = await User.find({ role: UserRoles.COMPANY }).select('-password -resetPasswordToken -resetPasswordExpires');
    res.json({ companies });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des entreprises.', error: error.message });
  }
};

// Approuver une entreprise
exports.approveCompany = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const company = await User.findOne({ _id: req.params.id, role: UserRoles.COMPANY });
    if (!company) {
      return res.status(404).json({ message: 'Entreprise introuvable.' });
    }

    company.status = 'approved';
    company.approvedAt = new Date();
    company.approvedBy = req.user.id;
    await company.save();

    // Envoyer un email simulé pour notifier de l'approbation
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #10b981; text-align: center;">Compte Entreprise Approuvé</h2>
        <p>Bonjour <strong>${company.name}</strong>,</p>
        <p>Nous avons le plaisir de vous informer que votre compte entreprise sur <strong>Smart Parking</strong> a été approuvé par notre équipe d'administration.</p>
        <p>Vous pouvez dès maintenant vous connecter, ajouter vos parkings et commencer à gérer vos employés.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">L'équipe Smart Parking.</p>
      </div>
    `;
    await sendEmail(company.email, 'Votre compte entreprise a été approuvé !', emailBody);

    res.json({ message: 'Entreprise approuvée avec succès.', company });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'approbation de l\'entreprise.', error: error.message });
  }
};

// Rejeter une entreprise
exports.rejectCompany = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { reason } = req.body;

  try {
    const company = await User.findOne({ _id: req.params.id, role: UserRoles.COMPANY });
    if (!company) {
      return res.status(404).json({ message: 'Entreprise introuvable.' });
    }

    company.status = 'rejected';
    await company.save();

    // Envoyer un email simulé pour notifier du rejet
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #ef4444; text-align: center;">Compte Entreprise Rejeté</h2>
        <p>Bonjour <strong>${company.name}</strong>,</p>
        <p>Nous regrettons de vous informer que votre demande d'inscription d'entreprise sur <strong>Smart Parking</strong> a été rejetée.</p>
        ${reason ? `<p><strong>Raison invoquée :</strong> ${reason}</p>` : ''}
        <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez apporter des corrections, veuillez contacter notre support.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">L'équipe Smart Parking.</p>
      </div>
    `;
    await sendEmail(company.email, 'Mise à jour concernant votre demande d\'inscription', emailBody);

    res.json({ message: 'Entreprise rejetée.', company });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du rejet de l\'entreprise.', error: error.message });
  }
};

// Suspendre une entreprise
exports.suspendCompany = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const company = await User.findOne({ _id: req.params.id, role: UserRoles.COMPANY });
    if (!company) {
      return res.status(404).json({ message: 'Entreprise introuvable.' });
    }

    company.status = 'suspended';
    await company.save();

    // Envoyer un email simulé pour notifier de la suspension
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #f59e0b; text-align: center;">Compte Entreprise Suspendu</h2>
        <p>Bonjour <strong>${company.name}</strong>,</p>
        <p>Nous vous informons que votre compte entreprise sur <strong>Smart Parking</strong> a été suspendu temporairement.</p>
        <p>Pour plus d'informations ou pour lever la suspension, veuillez contacter notre équipe d'administration.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">L'équipe Smart Parking.</p>
      </div>
    `;
    await sendEmail(company.email, 'Suspension de votre compte entreprise', emailBody);

    res.json({ message: 'Entreprise suspendue.', company });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suspension de l\'entreprise.', error: error.message });
  }
};

// Obtenir la liste de toutes les demandes de parkings
exports.getParkings = async (req, res) => {
  try {
    const parkings = await Parking.find().populate('companyId', 'name email phone address');
    res.json({ parkings });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des parkings.', error: error.message });
  }
};

// Approuver une demande de parking
exports.approveParking = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const parking = await Parking.findById(req.params.id);
    if (!parking) {
      return res.status(404).json({ message: 'Demande de parking introuvable.' });
    }

    parking.status = 'approved';
    await parking.save();

    // Récupérer l'entreprise pour lui envoyer la notification par email
    const company = await User.findById(parking.companyId);
    if (company) {
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #10b981; text-align: center;">Demande d'Intégration de Parking Approuvée</h2>
          <p>Bonjour <strong>${company.name}</strong>,</p>
          <p>Nous avons le plaisir de vous informer que votre demande d'intégration pour le parking <strong>${parking.name}</strong> a été approuvée par l'administrateur.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Parking :</strong> ${parking.name}</p>
            <p style="margin: 5px 0;"><strong>Adresse :</strong> ${parking.address}, ${parking.zipCode} ${parking.city}</p>
            <p style="margin: 5px 0;"><strong>Capacité :</strong> ${parking.totalSpots} places</p>
          </div>
          <p>Vous pouvez désormais assigner un employé pour la gestion des places de ce parking.</p>
          <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">L'équipe Smart Parking.</p>
        </div>
      `;
      await sendEmail(company.email, `Votre parking "${parking.name}" a été approuvé !`, emailBody);
    }

    res.json({ message: 'Demande de parking approuvée avec succès.', parking });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'approbation du parking.', error: error.message });
  }
};

// Rejeter une demande de parking
exports.rejectParking = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { reason } = req.body;

  try {
    const parking = await Parking.findById(req.params.id);
    if (!parking) {
      return res.status(404).json({ message: 'Demande de parking introuvable.' });
    }

    parking.status = 'rejected';
    parking.rejectionReason = reason || 'Non conforme aux critères requis.';
    await parking.save();

    // Récupérer l'entreprise pour lui envoyer la notification par email
    const company = await User.findById(parking.companyId);
    if (company) {
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #ef4444; text-align: center;">Demande d'Intégration de Parking Rejetée</h2>
          <p>Bonjour <strong>${company.name}</strong>,</p>
          <p>Nous regrettons de vous informer que votre demande d'intégration pour le parking <strong>${parking.name}</strong> a été rejetée par l'administrateur.</p>
          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 6px; margin: 15px 0; color: #991b1b;">
            <p style="margin: 5px 0;"><strong>Raison du rejet :</strong> ${parking.rejectionReason}</p>
          </div>
          <p>Vous pouvez soumettre une nouvelle demande en adaptant les informations fournies.</p>
          <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">L'équipe Smart Parking.</p>
        </div>
      `;
      await sendEmail(company.email, `Mise à jour concernant votre demande de parking "${parking.name}"`, emailBody);
    }

    res.json({ message: 'Demande de parking rejetée.', parking });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du rejet du parking.', error: error.message });
  }
};
