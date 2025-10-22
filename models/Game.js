const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Game title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Game description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Game category is required'],
    enum: ['action', 'rpg', 'strategy', 'sports', 'racing', 'puzzle', 'adventure', 'shooter', 'simulation', 'fighting']
  },
  subcategory: {
    type: String,
    trim: true
  },
  developer: {
    type: String,
    required: [true, 'Developer is required'],
    trim: true
  },
  publisher: {
    type: String,
    required: [true, 'Publisher is required'],
    trim: true
  },
  releaseDate: {
    type: Date,
    required: [true, 'Release date is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  isFree: {
    type: Boolean,
    default: false
  },
  images: {
    thumbnail: { type: String, required: true },
    screenshots: [{ type: String }],
    banner: { type: String }
  },
  videos: {
    trailer: { type: String },
    gameplay: [{ type: String }]
  },
  systemRequirements: {
    minimum: {
      os: { type: String },
      processor: { type: String },
      memory: { type: String },
      graphics: { type: String },
      storage: { type: String }
    },
    recommended: {
      os: { type: String },
      processor: { type: String },
      memory: { type: String },
      graphics: { type: String },
      storage: { type: String }
    }
  },
  platforms: [{
    type: String,
    enum: ['pc', 'mac', 'linux', 'android', 'ios', 'xbox', 'playstation', 'nintendo']
  }],
  features: [{
    type: String,
    enum: ['singleplayer', 'multiplayer', 'coop', 'online', 'vr', 'crossplatform']
  }],
  tags: [{ type: String, trim: true }],
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    helpful: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  }],
  stats: {
    downloads: { type: Number, default: 0 },
    activePlayers: { type: Number, default: 0 },
    totalPlayTime: { type: Number, default: 0 }, // in minutes
    averagePlayTime: { type: Number, default: 0 } // in minutes
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'maintenance'],
    default: 'draft'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: false
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  badges: [{
    type: String,
    enum: ['featured', 'new', 'trending', 'popular', 'hot', 'award']
  }],
  tournamentSettings: {
    isTournamentEnabled: { type: Boolean, default: false },
    maxPlayers: { type: Number, default: 100 },
    minPlayers: { type: Number, default: 2 },
    duration: { type: Number, default: 60 }, // in minutes
    rules: { type: String }
  },
  gameFiles: {
    executable: { type: String },
    installer: { type: String },
    size: { type: String }, // file size
    version: { type: String, default: '1.0.0' }
  },
  metadata: {
    ageRating: { type: String, enum: ['E', 'E10+', 'T', 'M', 'AO'] },
    contentWarnings: [{ type: String }],
    languages: [{ type: String }],
    subtitles: [{ type: String }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted price
gameSchema.virtual('formattedPrice').get(function() {
  if (this.isFree) return 'Free';
  return `$${this.price.toFixed(2)}`;
});

// Virtual for average rating with stars
gameSchema.virtual('ratingStars').get(function() {
  const stars = Math.round(this.rating.average);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
});

// Virtual for release status
gameSchema.virtual('releaseStatus').get(function() {
  const now = new Date();
  if (this.releaseDate > now) {
    const diffTime = this.releaseDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `Coming in ${diffDays} days`;
  }
  return 'Available Now';
});

// Indexes for better performance
gameSchema.index({ title: 'text', description: 'text', tags: 'text' });
gameSchema.index({ category: 1 });
gameSchema.index({ 'rating.average': -1 });
gameSchema.index({ 'stats.downloads': -1 });
gameSchema.index({ 'stats.activePlayers': -1 });
gameSchema.index({ isFeatured: 1 });
gameSchema.index({ isNew: 1 });
gameSchema.index({ isTrending: 1 });
gameSchema.index({ status: 1 });

// Pre-save middleware
gameSchema.pre('save', function(next) {
  // Set isFree based on price
  if (this.price === 0) {
    this.isFree = true;
  }
  
  // Calculate average rating
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = totalRating / this.reviews.length;
    this.rating.count = this.reviews.length;
  }
  
  next();
});

// Static method to get featured games
gameSchema.statics.getFeaturedGames = function(limit = 10) {
  return this.find({ 
    status: 'published', 
    isFeatured: true 
  })
  .sort({ 'rating.average': -1, 'stats.downloads': -1 })
  .limit(limit)
  .populate('reviews.user', 'username avatar');
};

// Static method to get trending games
gameSchema.statics.getTrendingGames = function(limit = 10) {
  return this.find({ 
    status: 'published', 
    isTrending: true 
  })
  .sort({ 'stats.activePlayers': -1 })
  .limit(limit);
};

// Static method to search games
gameSchema.statics.searchGames = function(query, filters = {}) {
  const searchQuery = {
    status: 'published',
    $text: { $search: query }
  };
  
  // Apply filters
  if (filters.category) {
    searchQuery.category = filters.category;
  }
  
  if (filters.price) {
    if (filters.price === 'free') {
      searchQuery.isFree = true;
    } else if (filters.price === 'paid') {
      searchQuery.isFree = false;
    }
  }
  
  if (filters.platform) {
    searchQuery.platforms = filters.platform;
  }
  
  return this.find(searchQuery)
    .sort({ score: { $meta: 'textScore' }, 'rating.average': -1 })
    .populate('reviews.user', 'username avatar');
};

module.exports = mongoose.model('Game', gameSchema);
