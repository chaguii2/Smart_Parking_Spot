/**
 * ComplaintService
 * Business logic for complaint management
 * Handles validation, statistics, notifications, etc.
 */

const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Parking = require('../models/Parking');

class ComplaintService {
  /**
   * Get complaint statistics for dashboard
   */
  static async getStatistics(filters = {}) {
    const matchStage = {};
    if (filters.parkingId) matchStage.parkingId = filters.parkingId;
    if (filters.submittedByType) matchStage.submittedByType = filters.submittedByType;

    const stats = await Complaint.aggregate([
      { $match: matchStage },
      {
        $facet: {
          totalComplaints: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            {
              $project: {
                _id: 1,
                count: 1,
                order: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$_id', 'urgent'] }, then: 1 },
                      { case: { $eq: ['$_id', 'high'] }, then: 2 },
                      { case: { $eq: ['$_id', 'medium'] }, then: 3 },
                      { case: { $eq: ['$_id', 'low'] }, then: 4 }
                    ],
                    default: 5
                  }
                }
              }
            },
            { $sort: { order: 1 } }
          ],
          averageResolutionTime: [
            { $match: { resolvedAt: { $ne: null } } },
            {
              $project: {
                resolutionDays: {
                  $divide: [
                    { $subtract: ['$resolvedAt', '$createdAt'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                avgDays: { $avg: '$resolutionDays' },
                minDays: { $min: '$resolutionDays' },
                maxDays: { $max: '$resolutionDays' }
              }
            }
          ],
          pendingComplaints: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          overduePending: [
            {
              $match: {
                status: 'pending',
                createdAt: {
                  $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
              }
            },
            { $count: 'count' }
          ],
          averageRating: [
            { $match: { resolutionRating: { $ne: null } } },
            { $group: { _id: null, avgRating: { $avg: '$resolutionRating' } } }
          ]
        }
      }
    ]);

    return stats[0];
  }

  /**
   * Get dashboard metrics for admin
   */
  static async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const thisMonth = new Date();
    thisMonth.setDate(1);

    const metrics = await Complaint.aggregate([
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: today } } },
            { $count: 'count' }
          ],
          thisWeek: [
            { $match: { createdAt: { $gte: thisWeek } } },
            { $count: 'count' }
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: thisMonth } } },
            { $count: 'count' }
          ],
          resolved: [
            { $match: { status: 'resolved' } },
            { $count: 'count' }
          ],
          pending: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          inProgress: [
            { $match: { status: 'in_progress' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    return {
      complaints: {
        today: metrics[0].today[0]?.count || 0,
        thisWeek: metrics[0].thisWeek[0]?.count || 0,
        thisMonth: metrics[0].thisMonth[0]?.count || 0
      },
      status: {
        resolved: metrics[0].resolved[0]?.count || 0,
        pending: metrics[0].pending[0]?.count || 0,
        inProgress: metrics[0].inProgress[0]?.count || 0
      }
    };
  }

  /**
   * Get complaints by parking with enhanced analytics
   */
  static async getParkingComplaints(parkingId) {
    const complaints = await Complaint.find({ parkingId })
      .populate('submittedBy', 'name email vehiclePlate')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    // Calculate parking-specific stats
    const stats = await Complaint.aggregate([
      { $match: { parkingId: require('mongoose').Types.ObjectId(parkingId) } },
      {
        $group: {
          _id: null,
          totalComplaints: { $sum: 1 },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          },
          mostCommonCategory: {
            $push: '$category'
          }
        }
      }
    ]);

    return {
      complaints,
      stats: stats[0] || {}
    };
  }

  /**
   * Auto-assign complaint to admin based on workload
   */
  static async autoAssignToAdmin(parkingId = null) {
    try {
      // Get all admins
      const admins = await User.find({ role: 'admin', isActive: true });

      if (admins.length === 0) {
        return null;
      }

      // Get workload for each admin
      const adminWorkloads = await Promise.all(
        admins.map(async (admin) => ({
          admin,
          pendingCount: await Complaint.countDocuments({
            assignedTo: admin._id,
            status: 'pending'
          }),
          inProgressCount: await Complaint.countDocuments({
            assignedTo: admin._id,
            status: 'in_progress'
          })
        }))
      );

      // Calculate workload score (lower is better)
      const withScores = adminWorkloads.map(item => ({
        ...item,
        score: item.pendingCount * 2 + item.inProgressCount
      }));

      // Get admin with lowest workload
      const leastBusy = withScores.reduce((prev, current) =>
        prev.score < current.score ? prev : current
      );

      return leastBusy.admin._id;
    } catch (error) {
      console.error('Error auto-assigning complaint:', error);
      return null;
    }
  }

  /**
   * Send notification when complaint status changes
   */
  static async notifyStatusChange(complaint, newStatus) {
    // This would integrate with your email/notification service
    // For now, just log it
    console.log(`[COMPLAINT NOTIFICATION] ID: ${complaint._id}, Status: ${newStatus}`);

    // TODO: Implement actual notification (email, in-app, etc.)
    // Example:
    // await emailService.sendComplaintStatusUpdate(complaint, newStatus);
  }

  /**
   * Validate complaint data
   */
  static validateComplaintData(data) {
    const errors = [];

    if (!data.title || data.title.trim().length < 5) {
      errors.push('Le titre doit contenir au moins 5 caractères');
    }

    if (!data.description || data.description.trim().length < 10) {
      errors.push('La description doit contenir au moins 10 caractères');
    }

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
    if (!validCategories.includes(data.category)) {
      errors.push(`Catégorie invalide: ${data.category}`);
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      errors.push(`Priorité invalide: ${data.priority}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get priority complaints (high/urgent with no assignment)
   */
  static async getUnassignedPrioritComplaints() {
    return Complaint.find({
      priority: { $in: ['high', 'urgent'] },
      status: { $in: ['pending', 'in_progress'] },
      assignedTo: null
    })
      .populate('submittedBy', 'name email phone')
      .populate('parkingId', 'name address city')
      .sort({ priority: -1, createdAt: 1 });
  }

  /**
   * Get complaints by date range
   */
  static async getComplaintsByDateRange(startDate, endDate) {
    return Complaint.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('submittedBy', 'name email')
      .populate('parkingId', 'name address')
      .sort({ createdAt: -1 });
  }

  /**
   * Archive old resolved complaints
   */
  static async archiveOldComplaints(daysOld = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // In production, you might want to move to an archive collection instead of deleting
    const result = await Complaint.deleteMany({
      status: 'resolved',
      resolvedAt: { $lt: cutoffDate }
    });

    return result;
  }

  /**
   * Get complaint summary for user dashboard
   */
  static async getUserComplaintSummary(userId) {
    const complaints = await Complaint.find({ submittedBy: userId });

    return {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      inProgress: complaints.filter(c => c.status === 'in_progress').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      rejected: complaints.filter(c => c.status === 'rejected').length,
      averageRating: complaints
        .filter(c => c.resolutionRating)
        .reduce((sum, c) => sum + c.resolutionRating, 0) / 
        (complaints.filter(c => c.resolutionRating).length || 1)
    };
  }
}

module.exports = ComplaintService;
