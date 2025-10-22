const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { ForumCategory, ForumTopic, Guild, GuildChat } = require('../models/Community');
const User = require('../models/User');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ==================== FORUM ROUTES ====================

// @route   GET /api/community/forums/categories
// @desc    Get all forum categories
// @access  Public
router.get('/forums/categories', async (req, res) => {
  try {
    const categories = await ForumCategory.find({ isActive: true })
      .sort({ order: 1, name: 1 });

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Get forum categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching forum categories'
    });
  }
});

// @route   GET /api/community/forums/topics
// @desc    Get forum topics with filtering and pagination
// @access  Public
router.get('/forums/topics', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('category').optional().isMongoId().withMessage('Valid category ID is required'),
  query('sort').optional().isIn(['newest', 'oldest', 'popular', 'replies'])
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
    const query = { isArchived: false };

    if (req.query.category) {
      query.category = req.query.category;
    }

    // Build sort
    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'popular':
        sort = { views: -1 };
        break;
      case 'replies':
        sort = { 'stats.replyCount': -1 };
        break;
      default: // newest
        sort = { 'stats.lastActivity': -1 };
    }

    // Execute query
    const topics = await ForumTopic.find(query)
      .populate('author', 'username avatar')
      .populate('category', 'name icon color')
      .populate('lastReply.author', 'username avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await ForumTopic.countDocuments(query);

    res.json({
      success: true,
      data: {
        topics,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalTopics: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get forum topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching forum topics'
    });
  }
});

// @route   GET /api/community/forums/topics/popular
// @desc    Get popular forum topics
// @access  Public
router.get('/forums/topics/popular', async (req, res) => {
  try {
    const topics = await ForumTopic.getPopularTopics(10);

    res.json({
      success: true,
      data: { topics }
    });
  } catch (error) {
    console.error('Get popular topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching popular topics'
    });
  }
});

// @route   POST /api/community/forums/topics
// @desc    Create a new forum topic
// @access  Private
router.post('/forums/topics', [
  body('title').isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('content').isLength({ min: 1, max: 10000 }).withMessage('Content must be between 1 and 10000 characters'),
  body('category').isMongoId().withMessage('Valid category ID is required'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
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

    // Check if category exists
    const category = await ForumCategory.findById(req.body.category);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Forum category not found'
      });
    }

    // Create topic
    const topic = new ForumTopic({
      title: req.body.title,
      content: req.body.content,
      author: req.user._id,
      category: req.body.category,
      tags: req.body.tags || []
    });

    await topic.save();

    // Update category stats
    category.stats.totalTopics += 1;
    category.stats.lastActivity = new Date();
    await category.save();

    // Populate the topic
    await topic.populate([
      { path: 'author', select: 'username avatar' },
      { path: 'category', select: 'name icon color' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: { topic }
    });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating topic'
    });
  }
});

// @route   GET /api/community/forums/topics/:id
// @desc    Get single forum topic
// @access  Public
router.get('/forums/topics/:id', optionalAuth, async (req, res) => {
  try {
    const topic = await ForumTopic.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('category', 'name icon color')
      .populate('replies.author', 'username avatar')
      .populate('lastReply.author', 'username avatar');

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Increment views
    topic.views += 1;
    await topic.save();

    res.json({
      success: true,
      data: { topic }
    });
  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching topic'
    });
  }
});

// @route   POST /api/community/forums/topics/:id/replies
// @desc    Add a reply to a forum topic
// @access  Private
router.post('/forums/topics/:id/replies', [
  body('content').isLength({ min: 1, max: 5000 }).withMessage('Content must be between 1 and 5000 characters')
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

    const topic = await ForumTopic.findById(req.params.id);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    if (topic.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'This topic is locked'
      });
    }

    // Add reply
    topic.replies.push({
      author: req.user._id,
      content: req.body.content
    });

    await topic.save();

    // Update category stats
    const category = await ForumCategory.findById(topic.category);
    category.stats.totalPosts += 1;
    category.stats.lastActivity = new Date();
    await category.save();

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: { reply: topic.replies[topic.replies.length - 1] }
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding reply'
    });
  }
});

// ==================== GUILD ROUTES ====================

// @route   GET /api/community/guilds
// @desc    Get all guilds with filtering and pagination
// @access  Public
router.get('/guilds', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('category').optional().isIn(['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'general', 'competitive', 'casual']),
  query('sort').optional().isIn(['newest', 'oldest', 'level', 'members', 'rating'])
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
    const query = { isActive: true, isPublic: true };

    if (req.query.category) {
      query.category = req.query.category;
    }

    // Build sort
    let sort = {};
    switch (req.query.sort) {
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'level':
        sort = { level: -1 };
        break;
      case 'members':
        sort = { 'stats.totalMembers': -1 };
        break;
      case 'rating':
        sort = { 'stats.averageRating': -1 };
        break;
      default: // newest
        sort = { createdAt: -1 };
    }

    // Execute query
    const guilds = await Guild.find(query)
      .populate('founder', 'username avatar')
      .populate('leaders.user', 'username avatar')
      .sort(sort)
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
    console.error('Get guilds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching guilds'
    });
  }
});

// @route   GET /api/community/guilds/top
// @desc    Get top guilds
// @access  Public
router.get('/guilds/top', async (req, res) => {
  try {
    const category = req.query.category;
    const limit = parseInt(req.query.limit) || 10;
    const guilds = await Guild.getTopGuilds(category, limit);

    res.json({
      success: true,
      data: { guilds }
    });
  } catch (error) {
    console.error('Get top guilds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching top guilds'
    });
  }
});

// @route   POST /api/community/guilds
// @desc    Create a new guild
// @access  Private
router.post('/guilds', [
  body('name').isLength({ min: 1, max: 50 }).withMessage('Name must be between 1 and 50 characters'),
  body('description').isLength({ min: 1, max: 1000 }).withMessage('Description must be between 1 and 1000 characters'),
  body('category').isIn(['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'general', 'competitive', 'casual']),
  body('shortDescription').optional().isLength({ max: 200 }).withMessage('Short description cannot exceed 200 characters')
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

    // Check if guild name is already taken
    const existingGuild = await Guild.findOne({ name: req.body.name });
    if (existingGuild) {
      return res.status(400).json({
        success: false,
        message: 'Guild name is already taken'
      });
    }

    // Create guild
    const guild = new Guild({
      name: req.body.name,
      description: req.body.description,
      shortDescription: req.body.shortDescription || '',
      founder: req.user._id,
      category: req.body.category,
      leaders: [{
        user: req.user._id,
        role: 'leader'
      }],
      members: [{
        user: req.user._id,
        role: 'member',
        isActive: true
      }]
    });

    await guild.save();

    // Update user's guilds
    const user = await User.findById(req.user._id);
    user.social.guilds.push(guild._id);
    await user.save();

    // Populate the guild
    await guild.populate([
      { path: 'founder', select: 'username avatar' },
      { path: 'leaders.user', select: 'username avatar' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Guild created successfully',
      data: { guild }
    });
  } catch (error) {
    console.error('Create guild error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating guild'
    });
  }
});

// @route   GET /api/community/guilds/:id
// @desc    Get single guild by ID
// @access  Public
router.get('/guilds/:id', optionalAuth, async (req, res) => {
  try {
    const guild = await Guild.findById(req.params.id)
      .populate('founder', 'username avatar')
      .populate('leaders.user', 'username avatar')
      .populate('members.user', 'username avatar');

    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'Guild not found'
      });
    }

    res.json({
      success: true,
      data: { guild }
    });
  } catch (error) {
    console.error('Get guild error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching guild'
    });
  }
});

// @route   POST /api/community/guilds/:id/join
// @desc    Join a guild
// @access  Private
router.post('/guilds/:id/join', async (req, res) => {
  try {
    const guild = await Guild.findById(req.params.id);
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'Guild not found'
      });
    }

    // Check if user is already a member
    const existingMember = guild.members.find(
      member => member.user.toString() === req.user._id.toString()
    );

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this guild'
      });
    }

    // Check guild requirements
    if (req.user.stats.level < guild.requirements.minLevel) {
      return res.status(400).json({
        success: false,
        message: `You need to be at least level ${guild.requirements.minLevel} to join this guild`
      });
    }

    // Check if guild is full
    if (guild.members.length >= guild.settings.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Guild is full'
      });
    }

    // Add member
    guild.members.push({
      user: req.user._id,
      role: 'member',
      isActive: true
    });

    await guild.save();

    // Update user's guilds
    const user = await User.findById(req.user._id);
    user.social.guilds.push(guild._id);
    await user.save();

    res.json({
      success: true,
      message: 'Successfully joined the guild'
    });
  } catch (error) {
    console.error('Join guild error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while joining guild'
    });
  }
});

// @route   DELETE /api/community/guilds/:id/leave
// @desc    Leave a guild
// @access  Private
router.delete('/guilds/:id/leave', async (req, res) => {
  try {
    const guild = await Guild.findById(req.params.id);
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'Guild not found'
      });
    }

    // Check if user is a member
    const memberIndex = guild.members.findIndex(
      member => member.user.toString() === req.user._id.toString()
    );

    if (memberIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this guild'
      });
    }

    // Check if user is the founder
    if (guild.founder.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Founder cannot leave the guild. Transfer leadership or disband the guild.'
      });
    }

    // Remove member
    guild.members.splice(memberIndex, 1);
    await guild.save();

    // Update user's guilds
    const user = await User.findById(req.user._id);
    user.social.guilds = user.social.guilds.filter(
      guildId => guildId.toString() !== req.params.id
    );
    await user.save();

    res.json({
      success: true,
      message: 'Successfully left the guild'
    });
  } catch (error) {
    console.error('Leave guild error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while leaving guild'
    });
  }
});

module.exports = router;
