// src/routes/complaints.js
const express = require('express');
const router = express.Router();
const { protect: authMiddleware, authorize } = require('../middleware/auth');

const {
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
} = require('../controllers/complaintController');

// ==================== PUBLIC ROUTES ====================
// Note: All complaint routes require authentication

// ==================== CLIENT & ADMIN ROUTES ====================

// Create a new complaint - Any authenticated user
router.post('/', authMiddleware, createComplaint);

// Get all complaints - Clients see only their own, Admins see all
router.get('/', authMiddleware, getAllComplaints);

// Get complaints statistics - Admin only
router.get('/stats/overview', authMiddleware, authorize('admin', 'super_admin'), getComplaintStats);

// Export complaints to PDF - Admin or user (filtered by own complaints)
router.get('/export/pdf', authMiddleware, exportComplaintsPdf);

// Get complaints by specific user - User sees their own, Admin sees any
router.get('/user/:userId', authMiddleware, getComplaintsByUser);

// Get complaints by parking - Anyone can see
router.get('/parking/:parkingId', authMiddleware, getComplaintsByParking);

// Get complaint by ID - User can see their own, Admin sees all
router.get('/:id', authMiddleware, getComplaintById);

// ==================== ADMIN ONLY ROUTES ====================

// Update complaint status - Admin only
router.put('/:id/status', authMiddleware, updateComplaintStatus);

// Update resolution feedback - User can update their own
router.put('/:id/feedback', authMiddleware, updateResolutionFeedback);

// Delete complaint - Admin or original submitter
router.delete('/:id', authMiddleware, deleteComplaint);

module.exports = router;
