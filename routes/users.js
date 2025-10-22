const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const { Guild } = require('../models/Community');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('stats.achievements')
      .populate('social.friends', 'username avatar')
      .populate('social.guilds', 'name logo');

    res.json({
      success: true,
      data: { user: user.getPublicProfile() }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('firstName').optional().isLength({ min: 1, max: 50 }).withMessage('First name must be between 1 and 50 characters'),
  body('lastName').optional().isLength({ min: 1, max: 50 }).withMessage('Last name must be between 1 and 50 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('country').optional().isLength({ min: 1, max: 100 }).withMessage('Country must be between 1 and 100 characters'),
  body('timezone').optional().isLength({ min: 1, max: 50 }).withMessage('Timezone must be between 1 and 50 characters')
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

    const allowedUpdates = ['firstName', 'lastName', 'bio', 'country', 'timezone'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: user.getPublicProfile() }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', [
  body('notifications').optional().isObject().withMessage('Notifications must be an object'),
  body('privacy').optional().isObject().withMessage('Privacy must be an object'),
  body('gaming').optional().isObject().withMessage('Gaming must be an object')
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

    const user = await User.findById(req.user._id);

    if (req.body.notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...req.body.notifications
      };
    }

    if (req.body.privacy) {
      user.preferences.privacy = {
        ...user.preferences.privacy,
        ...req.body.privacy
      };
    }

    if (req.body.gaming) {
      user.preferences.gaming = {
        ...user.preferences.gaming,
        ...req.body.gaming
      };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating preferences'
    });
  }
});

// @route   GET /api/users/games
// @desc    Get user's games
// @access  Private
router.get('/games', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Get user's games (this would need to be implemented based on your game ownership model)
    const games = await Game.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Game.countDocuments();

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
    console.error('Get user games error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching games'
    });
  }
});

// @route   GET /api/users/tournaments
// @desc    Get user's tournaments
// @access  Private
router.get('/tournaments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const tournaments = await Tournament.find({
      'participants.user': req.user._id
    })
    .populate('game', 'title images.thumbnail')
    .populate('organizer', 'username avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Tournament.countDocuments({
      'participants.user': req.user._id
    });

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
    console.error('Get user tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tournaments'
    });
  }
});

// @route   GET /api/users/guilds
// @desc    Get user's guilds
// @access  Private
router.get('/guilds', async (req, res) => {
  try {
    const guilds = await Guild.find({
      'members.user': req.user._id,
      isActive: true
    })
    .populate('founder', 'username avatar')
    .populate('leaders.user', 'username avatar')
    .sort({ level: -1 });

    res.json({
      success: true,
      data: { guilds }
    });
  } catch (error) {
    console.error('Get user guilds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching guilds'
    });
  }
});

// @route   GET /api/users/friends
// @desc    Get user's friends
// @access  Private
router.get('/friends', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('social.friends', 'username avatar stats.level lastLogin');

    res.json({
      success: true,
      data: { friends: user.social.friends }
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching friends'
    });
  }
});

// @route   POST /api/users/friends/:userId
// @desc    Send friend request
// @access  Private
router.post('/friends/:userId', async (req, res) => {
  try {
    const friendId = req.params.userId;

    if (friendId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add yourself as a friend'
      });
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already friends
    if (user.social.friends.includes(friendId)) {
      return res.status(400).json({
        success: false,
        message: 'You are already friends with this user'
      });
    }

    // Check if blocked
    if (user.social.blockedUsers.includes(friendId)) {
      return res.status(400).json({
        success: false,
        message: 'You have blocked this user'
      });
    }

    // Add friend (simplified - in a real app you'd have friend requests)
    user.social.friends.push(friendId);
    friend.social.friends.push(req.user._id);

    await Promise.all([user.save(), friend.save()]);

    res.json({
      success: true,
      message: 'Friend added successfully'
    });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding friend'
    });
  }
});

// @route   DELETE /api/users/friends/:userId
// @desc    Remove friend
// @access  Private
router.delete('/friends/:userId', async (req, res) => {
  try {
    const friendId = req.params.userId;

    const user = await User.findById(req.user._id);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove from both users' friend lists
    user.social.friends = user.social.friends.filter(
      id => id.toString() !== friendId
    );
    friend.social.friends = friend.social.friends.filter(
      id => id.toString() !== req.user._id.toString()
    );

    await Promise.all([user.save(), friend.save()]);

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing friend'
    });
  }
});

// @route   POST /api/users/block/:userId
// @desc    Block a user
// @access  Private
router.post('/block/:userId', async (req, res) => {
  try {
    const userIdToBlock = req.params.userId;

    if (userIdToBlock === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself'
      });
    }

    const userToBlock = await User.findById(userIdToBlock);
    if (!userToBlock) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already blocked
    if (user.social.blockedUsers.includes(userIdToBlock)) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked'
      });
    }

    // Remove from friends if they are friends
    user.social.friends = user.social.friends.filter(
      id => id.toString() !== userIdToBlock
    );
    userToBlock.social.friends = userToBlock.social.friends.filter(
      id => id.toString() !== req.user._id.toString()
    );

    // Add to blocked users
    user.social.blockedUsers.push(userIdToBlock);

    await Promise.all([user.save(), userToBlock.save()]);

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while blocking user'
    });
  }
});

// @route   DELETE /api/users/block/:userId
// @desc    Unblock a user
// @access  Private
router.delete('/block/:userId', async (req, res) => {
  try {
    const userIdToUnblock = req.params.userId;

    const user = await User.findById(req.user._id);

    // Check if user is blocked
    if (!user.social.blockedUsers.includes(userIdToUnblock)) {
      return res.status(400).json({
        success: false,
        message: 'User is not blocked'
      });
    }

    // Remove from blocked users
    user.social.blockedUsers = user.social.blockedUsers.filter(
      id => id.toString() !== userIdToUnblock
    );

    await user.save();

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unblocking user'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Get additional stats
    const tournamentsWon = await Tournament.countDocuments({
      'participants.user': req.user._id,
      'participants.status': 'winner'
    });

    const guildsJoined = await Guild.countDocuments({
      'members.user': req.user._id
    });

    const stats = {
      ...user.stats,
      tournamentsWon,
      guildsJoined,
      accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)) // days
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching stats'
    });
  }
});

// @route   PUT /api/users/password
// @desc    Change password
// @access  Private
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
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

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
});

module.exports = router;
