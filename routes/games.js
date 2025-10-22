const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Game = require('../models/Game');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/games
// @desc    Get all games with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isIn(['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'simulation', 'fighting']),
  query('price').optional().isIn(['free', 'paid']),
  query('platform').optional().isIn(['pc', 'mac', 'linux', 'android', 'ios', 'xbox', 'playstation', 'nintendo']),
  query('sort').optional().isIn(['popular', 'newest', 'rating', 'name', 'price']),
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
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build query
    const query = { status: 'published' };

    // Apply filters
    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.price) {
      if (req.query.price === 'free') {
        query.isFree = true;
      } else if (req.query.price === 'paid') {
        query.isFree = false;
      }
    }

    if (req.query.platform) {
      query.platforms = req.query.platform;
    }

    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Build sort
    let sort = {};
    switch (req.query.sort) {
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'rating':
        sort = { 'rating.average': -1 };
        break;
      case 'name':
        sort = { title: 1 };
        break;
      case 'price':
        sort = { price: 1 };
        break;
      default: // popular
        sort = { 'stats.downloads': -1, 'rating.average': -1 };
    }

    // Execute query
    const games = await Game.find(query)
      .populate('reviews.user', 'username avatar')
      .sort(sort)
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
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching games'
    });
  }
});

// @route   GET /api/games/featured
// @desc    Get featured games
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const games = await Game.getFeaturedGames(6);

    res.json({
      success: true,
      data: { games }
    });
  } catch (error) {
    console.error('Get featured games error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured games'
    });
  }
});

// @route   GET /api/games/trending
// @desc    Get trending games
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const games = await Game.getTrendingGames(6);

    res.json({
      success: true,
      data: { games }
    });
  } catch (error) {
    console.error('Get trending games error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching trending games'
    });
  }
});

// @route   GET /api/games/categories
// @desc    Get game categories with counts
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Game.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const categoryData = categories.map(cat => ({
      name: cat._id,
      count: cat.count,
      icon: getCategoryIcon(cat._id)
    }));

    res.json({
      success: true,
      data: { categories: categoryData }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories'
    });
  }
});

// @route   GET /api/games/:id
// @desc    Get single game by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('reviews.user', 'username avatar')
      .populate('tournamentSettings');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    // Increment views if user is authenticated
    if (req.user) {
      game.stats.downloads += 1;
      await game.save();
    }

    res.json({
      success: true,
      data: { game }
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching game'
    });
  }
});

// @route   POST /api/games/:id/review
// @desc    Add a review to a game
// @access  Private
router.post('/:id/review', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
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

    // Check if user already reviewed this game
    const existingReview = game.reviews.find(
      review => review.user.toString() === req.user._id.toString()
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this game'
      });
    }

    // Add review
    game.reviews.push({
      user: req.user._id,
      rating: req.body.rating,
      comment: req.body.comment || ''
    });

    await game.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { review: game.reviews[game.reviews.length - 1] }
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding review'
    });
  }
});

// @route   PUT /api/games/:id/review/:reviewId
// @desc    Update a review
// @access  Private
router.put('/:id/review/:reviewId', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters')
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

    const review = game.reviews.id(req.params.reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own reviews'
      });
    }

    // Update review
    review.rating = req.body.rating;
    review.comment = req.body.comment || '';
    review.isEdited = true;

    await game.save();

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: { review }
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating review'
    });
  }
});

// @route   DELETE /api/games/:id/review/:reviewId
// @desc    Delete a review
// @access  Private
router.delete('/:id/review/:reviewId', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    const review = game.reviews.id(req.params.reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    // Remove review
    review.remove();
    await game.save();

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting review'
    });
  }
});

// @route   POST /api/games/:id/play
// @desc    Record game play session
// @access  Private
router.post('/:id/play', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    const { duration } = req.body; // duration in minutes

    // Update game stats
    game.stats.totalPlayTime += duration || 0;
    game.stats.activePlayers += 1;

    // Update user stats
    const user = await User.findById(req.user._id);
    user.stats.gamesPlayed += 1;
    user.stats.totalPlayTime += duration || 0;

    await Promise.all([game.save(), user.save()]);

    res.json({
      success: true,
      message: 'Play session recorded successfully'
    });
  } catch (error) {
    console.error('Record play session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while recording play session'
    });
  }
});

// Helper function to get category icon
function getCategoryIcon(category) {
  const icons = {
    action: 'fas fa-fire',
    rpg: 'fas fa-dragon',
    strategy: 'fas fa-chess',
    sports: 'fas fa-futbol',
    racing: 'fas fa-car',
    puzzle: 'fas fa-puzzle-piece',
    adventure: 'fas fa-map',
    shooter: 'fas fa-crosshairs',
    simulation: 'fas fa-cogs',
    fighting: 'fas fa-fist-raised'
  };
  return icons[category] || 'fas fa-gamepad';
}

module.exports = router;
