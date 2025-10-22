const mongoose = require('mongoose');

// Forum Category Schema
const forumCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  icon: {
    type: String,
    default: 'fas fa-comments'
  },
  color: {
    type: String,
    default: '#00ffff'
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  stats: {
    totalTopics: { type: Number, default: 0 },
    totalPosts: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Forum Topic Schema
const forumTopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Topic title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Topic content is required'],
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumCategory',
    required: [true, 'Category is required']
  },
  tags: [{ type: String, trim: true }],
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  replies: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true, maxlength: [5000, 'Reply cannot exceed 5000 characters'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isSolution: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false }
  }],
  lastReply: {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  },
  stats: {
    replyCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Guild Schema
const guildSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Guild name is required'],
    trim: true,
    unique: true,
    maxlength: [50, 'Guild name cannot exceed 50 characters']
  },
  description: {
    type: String,
    required: [true, 'Guild description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  founder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Founder is required']
  },
  leaders: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['leader', 'co-leader', 'officer'], default: 'officer' },
    assignedAt: { type: Date, default: Date.now }
  }],
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['member', 'veteran', 'elite'], default: 'member' },
    contribution: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  }],
  category: {
    type: String,
    required: [true, 'Guild category is required'],
    enum: ['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'general', 'competitive', 'casual']
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  experience: {
    type: Number,
    default: 0
  },
  requirements: {
    minLevel: { type: Number, default: 1 },
    skillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert', 'any'], default: 'any' },
    playStyle: { type: String, enum: ['casual', 'competitive', 'hardcore', 'any'], default: 'any' },
    region: { type: String, default: 'global' },
    isInviteOnly: { type: Boolean, default: false }
  },
  settings: {
    maxMembers: { type: Number, default: 50, min: 5, max: 500 },
    isPublic: { type: Boolean, default: true },
    allowMemberInvites: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    chatEnabled: { type: Boolean, default: true },
    voiceChatEnabled: { type: Boolean, default: false }
  },
  stats: {
    totalMembers: { type: Number, default: 1 },
    activeMembers: { type: Number, default: 1 },
    tournamentsWon: { type: Number, default: 0 },
    totalPlayTime: { type: Number, default: 0 }, // in minutes
    averageRating: { type: Number, default: 0 }
  },
  achievements: [{
    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String },
    unlockedAt: { type: Date, default: Date.now }
  }],
  media: {
    logo: { type: String },
    banner: { type: String },
    screenshots: [{ type: String }]
  },
  social: {
    website: { type: String },
    discord: { type: String },
    twitter: { type: String },
    youtube: { type: String }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Guild Chat Message Schema
const guildChatSchema = new mongoose.Schema({
  guild: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guild',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    type: { type: String, enum: ['image', 'file'] },
    url: { type: String, required: true },
    filename: { type: String },
    size: { type: Number }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  reactions: [{
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GuildChat'
  }
}, {
  timestamps: true
});

// Virtual for guild member count
guildSchema.virtual('memberCount').get(function() {
  return this.members.filter(member => member.isActive).length;
});

// Virtual for guild activity level
guildSchema.virtual('activityLevel').get(function() {
  const activeMembers = this.members.filter(member => member.isActive).length;
  const totalMembers = this.members.length;
  const activityRatio = activeMembers / totalMembers;
  
  if (activityRatio >= 0.8) return 'very-high';
  if (activityRatio >= 0.6) return 'high';
  if (activityRatio >= 0.4) return 'medium';
  if (activityRatio >= 0.2) return 'low';
  return 'very-low';
});

// Indexes
forumTopicSchema.index({ title: 'text', content: 'text' });
forumTopicSchema.index({ category: 1 });
forumTopicSchema.index({ author: 1 });
forumTopicSchema.index({ 'stats.lastActivity': -1 });
forumTopicSchema.index({ isPinned: -1, 'stats.lastActivity': -1 });

guildSchema.index({ name: 'text', description: 'text' });
guildSchema.index({ category: 1 });
guildSchema.index({ level: -1 });
guildSchema.index({ 'stats.totalMembers': -1 });
guildSchema.index({ 'stats.averageRating': -1 });
guildSchema.index({ isPublic: 1 });

guildChatSchema.index({ guild: 1, createdAt: -1 });
guildChatSchema.index({ author: 1 });

// Pre-save middleware
forumTopicSchema.pre('save', function(next) {
  // Update reply count
  this.stats.replyCount = this.replies.length;
  
  // Update last activity
  if (this.replies.length > 0) {
    const lastReply = this.replies[this.replies.length - 1];
    this.stats.lastActivity = lastReply.createdAt;
    this.lastReply = {
      author: lastReply.author,
      createdAt: lastReply.createdAt
    };
  }
  
  next();
});

guildSchema.pre('save', function(next) {
  // Update member counts
  this.stats.totalMembers = this.members.length;
  this.stats.activeMembers = this.members.filter(member => member.isActive).length;
  
  next();
});

// Static methods
forumTopicSchema.statics.getPopularTopics = function(limit = 10) {
  return this.find({ isArchived: false })
    .populate('author', 'username avatar')
    .populate('category', 'name icon color')
    .sort({ 'stats.lastActivity': -1 })
    .limit(limit);
};

guildSchema.statics.getTopGuilds = function(category = null, limit = 10) {
  const query = { isActive: true, isPublic: true };
  if (category) query.category = category;
  
  return this.find(query)
    .populate('founder', 'username avatar')
    .populate('leaders.user', 'username avatar')
    .sort({ level: -1, 'stats.averageRating': -1 })
    .limit(limit);
};

// Export models
module.exports = {
  ForumCategory: mongoose.model('ForumCategory', forumCategorySchema),
  ForumTopic: mongoose.model('ForumTopic', forumTopicSchema),
  Guild: mongoose.model('Guild', guildSchema),
  GuildChat: mongoose.model('GuildChat', guildChatSchema)
};
