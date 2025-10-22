const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  country: {
    type: String,
    required: [true, 'Country is required']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      tournamentUpdates: { type: Boolean, default: true },
      communityUpdates: { type: Boolean, default: true }
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showOnlineStatus: { type: Boolean, default: true },
      showGameActivity: { type: Boolean, default: true }
    },
    gaming: {
      favoriteGenres: [{ type: String }],
      skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'beginner' },
      playStyle: { type: String, enum: ['casual', 'competitive', 'hardcore'], default: 'casual' }
    }
  },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    tournamentsJoined: { type: Number, default: 0 },
    tournamentsWon: { type: Number, default: 0 },
    totalPlayTime: { type: Number, default: 0 }, // in minutes
    achievements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' }],
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 }
  },
  social: {
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    guilds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Guild' }]
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free'
    },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
userSchema.virtual('age').get(function() {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'stats.level': -1 });
userSchema.index({ 'stats.experience': -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { 
      userId: this._id, 
      email: this.email, 
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
