const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const { ForumCategory, ForumTopic, Guild } = require('../models/Community');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Apply admin authorization to all routes
router.use(authorize('admin', 'moderator'));

// ==================== DASHBOARD STATS ====================

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin/Moderator)
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalGames,
      publishedGames,
      totalTournaments,
      liveTournaments,
      totalGuilds,
      activeGuilds,
      totalTopics,
      recentUsers,
      recentGames,
      recentTournaments
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Game.countDocuments(),
      Game.countDocuments({ status: 'published' }),
      Tournament.countDocuments(),
      Tournament.countDocuments({ status: 'live' }),
      Guild.countDocuments(),
      Guild.countDocuments({ isActive: true }),
      ForumTopic.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select('username email createdAt'),
      Game.find().sort({ createdAt: -1 }).limit(5).select('title status createdAt'),
      Tournament.find().sort({ createdAt: -1 }).limit(5).select('title status createdAt')
    ]);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      games: {
        total: totalGames,
        published: publishedGames,
        draft: totalGames - publishedGames
      },
      tournaments: {
        total: totalTournaments,
        live: liveTournaments,
        upcoming: await Tournament.countDocuments({ status: 'upcoming' }),
        completed: await Tournament.countDocuments({ status: 'completed' })
      },
      community: {
        guilds: {
          total: totalGuilds,
          active: activeGuilds
        },
        topics: totalTopics
      },
      recent: {
        users: recentUsers,
        games: recentGames,
        tournaments: recentTournaments
      }
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats'
    });
  }
});

// ==================== USER MANAGEMENT ====================

// @route   GET /api/admin/users
// @desc    Get all users with filtering and pagination
// @access  Private (Admin/Moderator)
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['user', 'moderator', 'admin']),
  query('status').optional().isIn(['active', 'inactive']),
  query('search').optional().isLength({ min: 1, max: 100 }).withMessage('Search term must be between 1 and 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (req.query.status) {
      query.isActive = req.query.status === 'active';
    }

    if (req.query.search) {
      query.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Execute query
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (active/inactive)
// @access  Private (Admin)
router.put('/users/:id/status', [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Only admins can change user status
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change user status'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = req.body.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${req.body.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status'
    });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Update user role
// @access  Private (Admin)
router.put('/users/:id/role', [
  body('role').isIn(['user', 'moderator', 'admin']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Only admins can change user roles
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change user roles'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = req.body.role;
    await user.save();

    res.json({
      success: true,
      message: 'User role updated successfully'
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user role'
    });
  }
});

// ==================== GAME MANAGEMENT ====================

// @route   GET /api/admin/games
// @desc    Get all games for admin management
// @access  Private (Admin/Moderator)
router.get('/games', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['draft', 'published', 'archived', 'maintenance']),
  query('category').optional().isIn(['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'simulation', 'fighting'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    // Execute query
    const games = await Game.find(query)
      .populate('reviews.user', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments(query);

    res.json({
      success: true,
      data: {
        games,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalGames: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get admin games error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching games'
    });
  }
});

// @route   PUT /api/admin/games/:id/status
// @desc    Update game status
// @access  Private (Admin/Moderator)
router.put('/games/:id/status', [
  body('status').isIn(['draft', 'published', 'archived', 'maintenance']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    game.status = req.body.status;
    await game.save();

    res.json({
      success: true,
      message: 'Game status updated successfully'
    });
  } catch (error) {
    console.error('Update game status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating game status'
    });
  }
});

// @route   PUT /api/admin/games/:id/featured
// @desc    Toggle game featured status
// @access  Private (Admin)
router.put('/games/:id/featured', [
  body('isFeatured').isBoolean().withMessage('isFeatured must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Only admins can change featured status
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change featured status'
      });
    }

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    game.isFeatured = req.body.isFeatured;
    await game.save();

    res.json({
      success: true,
      message: `Game ${req.body.isFeatured ? 'featured' : 'unfeatured'} successfully`
    });
  } catch (error) {
    console.error('Update game featured status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating game featured status'
    });
  }
});

// ==================== TOURNAMENT MANAGEMENT ====================

// @route   GET /api/admin/tournaments
// @desc    Get all tournaments for admin management
// @access  Private (Admin/Moderator)
router.get('/tournaments', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['upcoming', 'registration', 'live', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    // Execute query
    const tournaments = await Tournament.find(query)
      .populate('game', 'title images.thumbnail')
      .populate('organizer', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Tournament.countDocuments(query);

    res.json({
      success: true,
      data: {
        tournaments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalTournaments: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get admin tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tournaments'
    });
  }
});

// @route   PUT /api/admin/tournaments/:id/status
// @desc    Update tournament status
// @access  Private (Admin/Moderator)
router.put('/tournaments/:id/status', [
  body('status').isIn(['upcoming', 'registration', 'live', 'completed', 'cancelled']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    tournament.status = req.body.status;
    await tournament.save();

    res.json({
      success: true,
      message: 'Tournament status updated successfully'
    });
  } catch (error) {
    console.error('Update tournament status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tournament status'
    });
  }
});

// ==================== COMMUNITY MANAGEMENT ====================

// @route   GET /api/admin/guilds
// @desc    Get all guilds for admin management
// @access  Private (Admin/Moderator)
router.get('/guilds', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (req.query.status) {
      query.isActive = req.query.status === 'active';
    }

    // Execute query
    const guilds = await Guild.find(query)
      .populate('founder', 'username avatar')
      .populate('leaders.user', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Guild.countDocuments(query);

    res.json({
      success: true,
      data: {
        guilds,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalGuilds: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get admin guilds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching guilds'
    });
  }
});

// @route   PUT /api/admin/guilds/:id/status
// @desc    Update guild status
// @access  Private (Admin)
router.put('/guilds/:id/status', [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Only admins can change guild status
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change guild status'
      });
    }

    const guild = await Guild.findById(req.params.id);
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'Guild not found'
      });
    }

    guild.isActive = req.body.isActive;
    await guild.save();

    res.json({
      success: true,
      message: `Guild ${req.body.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update guild status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating guild status'
    });
  }
});

// @route   DELETE /api/admin/forums/topics/:id
// @desc    Delete a forum topic
// @access  Private (Admin/Moderator)
router.delete('/forums/topics/:id', async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    await topic.deleteOne();

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting topic'
    });
  }
});

module.exports = router;
