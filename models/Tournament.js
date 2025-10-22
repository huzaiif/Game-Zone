const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tournament title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Tournament description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: [true, 'Game is required']
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organizer is required']
  },
  category: {
    type: String,
    required: [true, 'Tournament category is required'],
    enum: ['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'simulation', 'fighting']
  },
  format: {
    type: String,
    required: [true, 'Tournament format is required'],
    enum: ['single-elimination', 'double-elimination', 'round-robin', 'swiss', 'bracket', 'league']
  },
  status: {
    type: String,
    enum: ['upcoming', 'registration', 'live', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  registration: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isOpen: { type: Boolean, default: true },
    maxParticipants: { type: Number, required: true, min: 2 },
    minParticipants: { type: Number, default: 2 },
    entryFee: { type: Number, default: 0 },
    requirements: {
      minLevel: { type: Number, default: 1 },
      maxLevel: { type: Number, default: 999 },
      skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert', 'any'], default: 'any' },
      region: { type: String, default: 'global' }
    }
  },
  schedule: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: { type: Number, required: true }, // in minutes
    timezone: { type: String, default: 'UTC' },
    matches: [{
      round: { type: Number, required: true },
      matchNumber: { type: Number, required: true },
      player1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      player2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      scheduledTime: { type: Date },
      actualStartTime: { type: Date },
      actualEndTime: { type: Date },
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      score: {
        player1: { type: Number, default: 0 },
        player2: { type: Number, default: 0 }
      },
      status: { 
        type: String, 
        enum: ['scheduled', 'in-progress', 'completed', 'forfeit'],
        default: 'scheduled'
      },
      streamUrl: { type: String },
      replayUrl: { type: String }
    }]
  },
  prizePool: {
    total: { type: Number, required: true, min: 0 },
    distribution: [{
      position: { type: Number, required: true },
      amount: { type: Number, required: true },
      percentage: { type: Number, required: true }
    }],
    currency: { type: String, default: 'USD' }
  },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registeredAt: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ['registered', 'confirmed', 'eliminated', 'disqualified'],
      default: 'registered'
    },
    seed: { type: Number },
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 }
    }
  }],
  rules: {
    general: { type: String, required: true },
    specific: { type: String },
    penalties: { type: String },
    disputes: { type: String }
  },
  settings: {
    isPublic: { type: Boolean, default: true },
    allowSpectators: { type: Boolean, default: true },
    requireVerification: { type: Boolean, default: false },
    maxSpectators: { type: Number, default: 1000 },
    streamSettings: {
      isStreamed: { type: Boolean, default: false },
      streamUrl: { type: String },
      streamKey: { type: String }
    }
  },
  stats: {
    totalViews: { type: Number, default: 0 },
    peakViewers: { type: Number, default: 0 },
    averageViewers: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }, // in minutes
    matchesCompleted: { type: Number, default: 0 },
    totalMatches: { type: Number, default: 0 }
  },
  badges: [{
    type: String,
    enum: ['featured', 'major', 'minor', 'community', 'sponsored', 'official']
  }],
  sponsors: [{
    name: { type: String, required: true },
    logo: { type: String },
    website: { type: String },
    contribution: { type: String }
  }],
  media: {
    thumbnail: { type: String },
    banner: { type: String },
    highlights: [{ type: String }],
    replays: [{ type: String }]
  },
  chat: {
    isEnabled: { type: Boolean, default: true },
    isModerated: { type: Boolean, default: true },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for registration status
tournamentSchema.virtual('registrationStatus').get(function() {
  const now = new Date();
  if (now < this.registration.startDate) {
    return 'not-started';
  } else if (now >= this.registration.startDate && now <= this.registration.endDate) {
    return 'open';
  } else {
    return 'closed';
  }
});

// Virtual for current participants count
tournamentSchema.virtual('currentParticipants').get(function() {
  return this.participants.filter(p => p.status !== 'disqualified').length;
});

// Virtual for available spots
tournamentSchema.virtual('availableSpots').get(function() {
  return this.registration.maxParticipants - this.currentParticipants;
});

// Virtual for tournament progress
tournamentSchema.virtual('progress').get(function() {
  if (this.schedule.matches.length === 0) return 0;
  const completedMatches = this.schedule.matches.filter(match => match.status === 'completed').length;
  return Math.round((completedMatches / this.schedule.matches.length) * 100);
});

// Indexes for better performance
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ category: 1 });
tournamentSchema.index({ game: 1 });
tournamentSchema.index({ organizer: 1 });
tournamentSchema.index({ 'schedule.startDate': 1 });
tournamentSchema.index({ 'registration.endDate': 1 });
tournamentSchema.index({ 'prizePool.total': -1 });
tournamentSchema.index({ 'stats.totalViews': -1 });

// Pre-save middleware
tournamentSchema.pre('save', function(next) {
  // Update registration status
  const now = new Date();
  if (now >= this.registration.startDate && now <= this.registration.endDate) {
    this.registration.isOpen = true;
  } else {
    this.registration.isOpen = false;
  }
  
  // Update tournament status based on schedule
  if (now < this.schedule.startDate) {
    this.status = 'upcoming';
  } else if (now >= this.schedule.startDate && now <= this.schedule.endDate) {
    this.status = 'live';
  } else if (now > this.schedule.endDate) {
    this.status = 'completed';
  }
  
  // Calculate total matches
  this.stats.totalMatches = this.schedule.matches.length;
  
  next();
});

// Static method to get live tournaments
tournamentSchema.statics.getLiveTournaments = function() {
  return this.find({ status: 'live' })
    .populate('game', 'title images.thumbnail')
    .populate('organizer', 'username avatar')
    .sort({ 'stats.totalViews': -1 });
};

// Static method to get upcoming tournaments
tournamentSchema.statics.getUpcomingTournaments = function(limit = 10) {
  return this.find({ 
    status: { $in: ['upcoming', 'registration'] },
    'schedule.startDate': { $gte: new Date() }
  })
  .populate('game', 'title images.thumbnail')
  .populate('organizer', 'username avatar')
  .sort({ 'schedule.startDate': 1 })
  .limit(limit);
};

// Method to register participant
tournamentSchema.methods.registerParticipant = function(userId) {
  // Check if already registered
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  if (existingParticipant) {
    throw new Error('User is already registered for this tournament');
  }
  
  // Check if registration is open
  if (!this.registration.isOpen) {
    throw new Error('Registration is not open for this tournament');
  }
  
  // Check if tournament is full
  if (this.currentParticipants >= this.registration.maxParticipants) {
    throw new Error('Tournament is full');
  }
  
  // Add participant
  this.participants.push({
    user: userId,
    registeredAt: new Date(),
    status: 'registered'
  });
  
  return this.save();
};

// Method to generate bracket
tournamentSchema.methods.generateBracket = function() {
  const participants = this.participants.filter(p => p.status === 'registered');
  const participantCount = participants.length;
  
  if (participantCount < 2) {
    throw new Error('Need at least 2 participants to generate bracket');
  }
  
  // Simple single elimination bracket generation
  const rounds = Math.ceil(Math.log2(participantCount));
  const matches = [];
  let matchNumber = 1;
  
  for (let round = 1; round <= rounds; round++) {
    const matchesInRound = Math.pow(2, rounds - round);
    
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        round: round,
        matchNumber: matchNumber++,
        status: 'scheduled'
      });
    }
  }
  
  this.schedule.matches = matches;
  return this.save();
};

module.exports = mongoose.model('Tournament', tournamentSchema);
