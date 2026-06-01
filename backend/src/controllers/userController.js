const { validationResult } = require('express-validator');
const User = require('../models/User');
const UserRoles = require('../models/UserRoles');
const Parking = require('../models/Parking');
const { sendEmail } = require('../utils/emailService');

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ user });
};

exports.updateMe = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const updates = { ...req.body };
  delete updates.role;
  delete updates.password;
  delete updates.resetPasswordToken;
  delete updates.resetPasswordExpires;

  const user = await User.findByIdAndUpdate(req.user.id, updates, {
    new: true,
    runValidators: true
  });

  res.json({ message: 'Profil mis à jour.', user });
};

exports.deleteMe = async (req, res) => {
  await User.findByIdAndDelete(req.user.id);
  res.json({ message: 'Compte supprimé avec succès.' });
};

exports.getUsers = async (req, res) => {
  const query = {};
  if (req.user.role === UserRoles.COMPANY) {
    query.companyId = req.user.id;
    query.role = UserRoles.EMPLOYEE;
  }

  const users = await User.find(query).select('-password -resetPasswordToken -resetPasswordExpires');
  res.json({ users });
};

exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -resetPasswordToken -resetPasswordExpires');
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (req.user.role === UserRoles.COMPANY && user.companyId?.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  res.json({ user });
};

exports.updateUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const updates = { ...req.body };
  delete updates.password;
  delete updates.resetPasswordToken;
  delete updates.resetPasswordExpires;
  delete updates.email;

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (req.user.role === UserRoles.COMPANY && user.companyId?.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  Object.assign(user, updates);
  await user.save();

  res.json({ message: 'Utilisateur mis à jour.', user });
};

exports.deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (req.user.role === UserRoles.COMPANY && user.companyId?.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  await User.deleteOne({ _id: user._id });
  res.json({ message: 'Utilisateur supprimé.' });
};

exports.createEmployee = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (req.user.role !== UserRoles.COMPANY && req.user.role !== UserRoles.SUPER_ADMIN) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const { name, email, password, phone, position, permissions, shiftStart, shiftEnd, companyId, parkingId } = req.body;
  const ownerCompanyId = req.user.role === UserRoles.COMPANY ? req.user.id : companyId;

  if (!parkingId) {
    return res.status(400).json({ message: 'L\'identifiant du parking est requis.' });
  }

  // 1. Vérifier si l'entreprise a au moins un parking approuvé
  const approvedParkingExists = await Parking.findOne({ companyId: ownerCompanyId, status: 'approved' });
  if (!approvedParkingExists) {
    return res.status(400).json({
      message: 'Vous devez intégrer un parking et obtenir l\'approbation de l\'administration avant de pouvoir créer des employés.'
    });
  }

  // 2. Vérifier si le parking spécifique appartient à l'entreprise et est approuvé
  const parking = await Parking.findOne({ _id: parkingId, companyId: ownerCompanyId, status: 'approved' });
  if (!parking) {
    return res.status(404).json({
      message: 'Le parking spécifié n\'existe pas, n\'appartient pas à votre entreprise ou n\'est pas encore approuvé par l\'administration.'
    });
  }

  // 3. Enforce 1 employee per parking limit
  const existingEmployee = await User.findOne({ role: UserRoles.EMPLOYEE, parkingId });
  if (existingEmployee) {
    return res.status(400).json({ message: 'Un employé est déjà assigné à ce parking. Limite de 1 employé par parking.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà.' });
  }

  const user = new User({
    name,
    email,
    password,
    phone,
    role: UserRoles.EMPLOYEE,
    companyId: ownerCompanyId,
    parkingId,
    position: position || 'agent',
    permissions: permissions || ['scan_qr', 'manage_spots'],
    shiftStart: shiftStart || '08:00',
    shiftEnd: shiftEnd || '17:00'
  });

  await user.save();

  // Envoyer l'email simulé contenant ses identifiants
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #6366f1; text-align: center;">Bienvenue chez Smart Parking</h2>
      <p>Bonjour <strong>${user.name}</strong>,</p>
      <p>Votre compte employé pour le parking <strong>${parking.name}</strong> a été créé avec succès par votre entreprise.</p>
      <p>Voici vos identifiants de connexion :</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Email :</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Mot de passe :</strong> ${password}</p>
      </div>
      <p>Vous pouvez vous connecter dès maintenant sur notre plateforme pour gérer les places du parking.</p>
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #6b7280; text-align: center;">Ceci est un email automatique du système Smart Parking.</p>
    </div>
  `;
  await sendEmail(email, 'Création de votre compte Employé - Smart Parking', emailBody);

  res.status(201).json({ message: 'Employé créé avec succès et identifiants envoyés.', user });
};

exports.getCompanyEmployees = async (req, res) => {
  if (req.user.role !== UserRoles.COMPANY && req.user.role !== UserRoles.SUPER_ADMIN) {
    return res.status(403).json({ message: 'Accès refusé.' });
  }

  const query = {
    role: UserRoles.EMPLOYEE,
    companyId: req.user.role === UserRoles.COMPANY ? req.user.id : req.query.companyId
  };

  const employees = await User.find(query).select('-password -resetPasswordToken -resetPasswordExpires');
  res.json({ employees });
};

// Soumettre une demande d'intégration de parking
exports.submitParkingRequest = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, address, city, zipCode, totalSpots, pricePerHour } = req.body;

  try {
    const parking = new Parking({
      name,
      address,
      city,
      zipCode,
      totalSpots,
      pricePerHour,
      companyId: req.user.id
    });

    await parking.save();

    // Envoyer un email simulé pour notifier le Super Admin
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #6366f1; text-align: center;">Nouvelle Demande d'Intégration de Parking</h2>
        <p>Bonjour Admin,</p>
        <p>L'entreprise <strong>${req.user.name}</strong> a soumis une demande d'intégration de parking.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>Nom :</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Adresse :</strong> ${address}, ${zipCode} ${city}</p>
          <p style="margin: 5px 0;"><strong>Nombre de Places :</strong> ${totalSpots}</p>
          <p style="margin: 5px 0;"><strong>Prix / Heure :</strong> ${pricePerHour} €</p>
        </div>
        <p>Veuillez vous connecter sur le panneau d'administration pour approuver ou rejeter cette demande.</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280; text-align: center;">Notification automatique Smart Parking.</p>
      </div>
    `;
    await sendEmail('admin@smartparking.com', `Nouvelle demande de parking : ${name}`, emailBody);

    res.status(201).json({ message: 'Demande d\'intégration de parking soumise avec succès.', parking });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la soumission du parking.', error: error.message });
  }
};
