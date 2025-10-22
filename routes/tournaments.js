const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Tournament = require('../models/Tournament');
const Game = require('../models/Game');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tournaments
// @desc    Get all tournaments with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['upcoming', 'registration', 'live', 'completed', 'cancelled']),
  query('category').optional().isIn(['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'simulation', 'fighting']),
  query('format').optional().isIn(['single-elimination', 'double-elimination', 'round-robin', 'swiss', 'bracket', 'league']),
  query('sort').optional().isIn(['newest', 'oldest', 'prize', 'participants', 'startDate'])
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
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    // Apply filters
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.format) {
      query.format = req.query.format;
    }

    // Build sort
    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { 'schedule.startDate': 1 };
        break;
      case 'prize':
        sort = { 'prizePool.total': -1 };
        break;
      case 'participants':
        sort = { 'stats.totalMembers': -1 };
        break;
      case 'startDate':
        sort = { 'schedule.startDate': 1 };
        break;
      default: // newest
        sort = { createdAt: -1 };
    }

    // Execute query
    const tournaments = await Tournament.find(query)
      .populate('game', 'title images.thumbnail')
      .populate('organizer', 'username avatar')
      .populate('participants.user', 'username avatar')
      .sort(sort)
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
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tournaments'
    });
  }
});

// @route   GET /api/tournaments/live
// @desc    Get live tournaments
// @access  Public
router.get('/live', async (req, res) => {
  try {
    const tournaments = await Tournament.getLiveTournaments();

    res.json({
      success: true,
      data: { tournaments }
    });
  } catch (error) {
    console.error('Get live tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching live tournaments'
    });
  }
});

// @route   GET /api/tournaments/upcoming
// @desc    Get upcoming tournaments
// @access  Public
router.get('/upcoming', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const tournaments = await Tournament.getUpcomingTournaments(limit);

    res.json({
      success: true,
      data: { tournaments }
    });
  } catch (error) {
    console.error('Get upcoming tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching upcoming tournaments'
    });
  }
});

// @route   GET /api/tournaments/:id
// @desc    Get single tournament by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('game', 'title images.thumbnail description')
      .populate('organizer', 'username avatar')
      .populate('participants.user', 'username avatar')
      .populate('schedule.matches.player1', 'username avatar')
      .populate('schedule.matches.player2', 'username avatar')
      .populate('schedule.matches.winner', 'username avatar');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Increment views if user is authenticated
    if (req.user) {
      tournament.stats.totalViews += 1;
      await tournament.save();
    }

    res.json({
      success: true,
      data: { tournament }
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tournament'
    });
  }
});

// @route   POST /api/tournaments
// @desc    Create a new tournament
// @access  Private
router.post('/', [
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
  body('description').isLength({ min: 1, max: 2000 }).withMessage('Description must be between 1 and 2000 characters'),
  body('game').isMongoId().withMessage('Valid game ID is required'),
  body('category').isIn(['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'simulation', 'fighting']),
  body('format').isIn(['single-elimination', 'double-elimination', 'round-robin', 'swiss', 'bracket', 'league']),
  body('registration.maxParticipants').isInt({ min: 2 }).withMessage('Max participants must be at least 2'),
  body('registration.startDate').isISO8601().withMessage('Valid registration start date is required'),
  body('registration.endDate').isISO8601().withMessage('Valid registration end date is required'),
  body('schedule.startDate').isISO8601().withMessage('Valid tournament start date is required'),
  body('schedule.endDate').isISO8601().withMessage('Valid tournament end date is required'),
  body('prizePool.total').isFloat({ min: 0 }).withMessage('Prize pool must be a positive number')
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

    // Check if game exists
    const game = await Game.findById(req.body.game);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    // Create tournament
    const tournament = new Tournament({
      ...req.body,
      organizer: req.user._id,
      category: game.category
    });

    await tournament.save();

    // Populate the tournament
    await tournament.populate([
      { path: 'game', select: 'title images.thumbnail' },
      { path: 'organizer', select: 'username avatar' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      data: { tournament }
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating tournament'
    });
  }
});

// @route   POST /api/tournaments/:id/register
// @desc    Register for a tournament
// @access  Private
router.post('/:id/register', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is already registered
    const existingParticipant = tournament.participants.find(
      p => p.user.toString() === req.user._id.toString()
    );

    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this tournament'
      });
    }

    // Register participant
    await tournament.registerParticipant(req.user._id);

    res.json({
      success: true,
      message: 'Successfully registered for tournament'
    });
  } catch (error) {
    console.error('Register for tournament error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while registering for tournament'
    });
  }
});

// @route   DELETE /api/tournaments/:id/unregister
// @desc    Unregister from a tournament
// @access  Private
router.delete('/:id/unregister', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Find participant
    const participantIndex = tournament.participants.findIndex(
      p => p.user.toString() === req.user._id.toString()
    );

    if (participantIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not registered for this tournament'
      });
    }

    // Check if tournament has started
    if (tournament.status === 'live' || tournament.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot unregister from a tournament that has started'
      });
    }

    // Remove participant
    tournament.participants.splice(participantIndex, 1);
    await tournament.save();

    res.json({
      success: true,
      message: 'Successfully unregistered from tournament'
    });
  } catch (error) {
    console.error('Unregister from tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unregistering from tournament'
    });
  }
});

// @route   POST /api/tournaments/:id/generate-bracket
// @desc    Generate tournament bracket
// @access  Private
router.post('/:id/generate-bracket', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if user is organizer
    if (tournament.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the tournament organizer can generate the bracket'
      });
    }

    // Generate bracket
    await tournament.generateBracket();

    res.json({
      success: true,
      message: 'Tournament bracket generated successfully',
      data: { matches: tournament.schedule.matches }
    });
  } catch (error) {
    console.error('Generate bracket error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating bracket'
    });
  }
});

// @route   PUT /api/tournaments/:id/match/:matchId
// @desc    Update match result
// @access  Private
router.put('/:id/match/:matchId', [
  body('winner').isMongoId().withMessage('Valid winner ID is required'),
  body('score.player1').isInt({ min: 0 }).withMessage('Player 1 score must be a non-negative integer'),
  body('score.player2').isInt({ min: 0 }).withMessage('Player 2 score must be a non-negative integer')
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

    // Check if user is organizer or moderator
    const isOrganizer = tournament.organizer.toString() === req.user._id.toString();
    const isModerator = tournament.chat.moderators.includes(req.user._id);
    
    if (!isOrganizer && !isModerator) {
      return res.status(403).json({
        success: false,
        message: 'Only organizers and moderators can update match results'
      });
    }

    const match = tournament.schedule.matches.id(req.params.matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Update match
    match.winner = req.body.winner;
    match.score.player1 = req.body.score.player1;
    match.score.player2 = req.body.score.player2;
    match.status = 'completed';
    match.actualEndTime = new Date();

    // Update tournament stats
    tournament.stats.matchesCompleted += 1;

    await tournament.save();

    res.json({
      success: true,
      message: 'Match result updated successfully',
      data: { match }
    });
  } catch (error) {
    console.error('Update match result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating match result'
    });
  }
});

// @route   GET /api/tournaments/:id/participants
// @desc    Get tournament participants
// @access  Public
router.get('/:id/participants', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('participants.user', 'username avatar stats.level')
      .select('participants');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.json({
      success: true,
      data: { participants: tournament.participants }
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching participants'
    });
  }
});

module.exports = router;
