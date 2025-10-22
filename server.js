const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const gameRoutes = require('./routes/games');
const tournamentRoutes = require('./routes/tournaments');
const communityRoutes = require('./routes/community');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Static files
app.use('/uploads', express.static('uploads'));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join tournament room
  socket.on('join-tournament', (tournamentId) => {
    socket.join(`tournament-${tournamentId}`);
    console.log(`User ${socket.id} joined tournament ${tournamentId}`);
  });
  
  // Leave tournament room
  socket.on('leave-tournament', (tournamentId) => {
    socket.leave(`tournament-${tournamentId}`);
    console.log(`User ${socket.id} left tournament ${tournamentId}`);
  });
  
  // Join chat room
  socket.on('join-chat', (roomId) => {
    socket.join(`chat-${roomId}`);
    console.log(`User ${socket.id} joined chat ${roomId}`);
  });
  
  // Handle chat messages
  socket.on('chat-message', (data) => {
    io.to(`chat-${data.roomId}`).emit('new-message', data);
  });
  
  // Handle tournament updates
  socket.on('tournament-update', (data) => {
    io.to(`tournament-${data.tournamentId}`).emit('tournament-status', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', auth, userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin', auth, adminRoutes);
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gamezone', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

module.exports = { app, io };
