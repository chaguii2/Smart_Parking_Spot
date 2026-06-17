const { validationResult } = require('express-validator');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Parking = require('../models/Parking');

// ==================== COMPANY ACTIONS ====================

// Créer un forfait/plan d'abonnement
exports.createPlan = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, parkingId, price, durationDays, features } = req.body;

    // Vérifier si le parking existe et appartient à l'entreprise connectée
    const parking = await Parking.findById(parkingId);
    if (!parking) {
      return res.status(404).json({ message: 'Parking non trouvé.' });
    }

    if (parking.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès interdit. Ce parking ne vous appartient pas.' });
    }

    const plan = new SubscriptionPlan({
      name,
      description,
      parkingId,
      companyId: req.user._id,
      price,
      durationDays,
      features: features || []
    });

    await plan.save();
    res.status(201).json({ message: 'Plan d\'abonnement créé avec succès.', plan });
  } catch (error) {
    next(error);
  }
};

// Mettre à jour un plan d'abonnement
exports.updatePlan = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, durationDays, features, isActive } = req.body;
    const plan = await SubscriptionPlan.findById(req.params.planId);

    if (!plan) {
      return res.status(404).json({ message: 'Plan d\'abonnement non trouvé.' });
    }

    if (plan.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Accès interdit.' });
    }

    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (price !== undefined) plan.price = price;
    if (durationDays !== undefined) plan.durationDays = durationDays;
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();
    res.json({ message: 'Plan d\'abonnement mis à jour.', plan });
  } catch (error) {
    next(error);
  }
};

// Récupérer les abonnés d'une entreprise
exports.getCompanySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({
      parkingId: { $in: await Parking.find({ companyId: req.user._id }).select('_id') }
    })
      .populate('planId')
      .populate('parkingId')
      .populate('clientId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};

// ==================== CLIENT ACTIONS ====================

// Récupérer les plans d'un parking spécifique
exports.getPlansForParking = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({
      parkingId: req.params.parkingId,
      isActive: true
    });
    res.json({ plans });
  } catch (error) {
    next(error);
  }
};

// Acheter un abonnement
exports.buySubscription = async (req, res, next) => {
  try {
    const { planId, paymentMethod } = req.body;

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: 'Plan d\'abonnement non trouvé ou inactif.' });
    }

    // Vérifier s'il y a déjà un abonnement actif pour ce parking afin de prolonger
    const existingActive = await Subscription.findOne({
      clientId: req.user._id,
      parkingId: plan.parkingId,
      status: 'active',
      endDate: { $gt: new Date() }
    }).sort({ endDate: -1 });

    let startDate = new Date();
    if (existingActive) {
      // Prolonger à partir de la fin de l'abonnement actuel
      startDate = new Date(existingActive.endDate);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = new Subscription({
      clientId: req.user._id,
      planId: plan._id,
      parkingId: plan.parkingId,
      startDate,
      endDate,
      pricePaid: plan.price,
      paymentMethod: paymentMethod || 'card'
    });

    await subscription.save();

    res.status(201).json({
      message: 'Abonnement souscrit avec succès.',
      subscription
    });
  } catch (error) {
    next(error);
  }
};

// Récupérer les abonnements de l'utilisateur connecté
exports.getClientSubscriptions = async (req, res, next) => {
  try {
    // Mettre à jour automatiquement les abonnements expirés
    const now = new Date();
    await Subscription.updateMany(
      { clientId: req.user._id, status: 'active', endDate: { $lt: now } },
      { status: 'expired' }
    );

    const subscriptions = await Subscription.find({ clientId: req.user._id })
      .populate('planId')
      .populate('parkingId')
      .sort({ endDate: -1 });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN ACTIONS ====================

// Récupérer tous les abonnements
exports.getAllSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('planId')
      .populate('parkingId')
      .populate('clientId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};
