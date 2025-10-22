# GameZone Backend API

A comprehensive backend API for the GameZone gaming platform built with Node.js, Express, and MongoDB.

## Features

- **User Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (User, Moderator, Admin)
  - Email verification and password reset
  - User profile management

- **Game Management**
  - CRUD operations for games
  - Game categories and filtering
  - Rating and review system
  - Game statistics tracking

- **Tournament System**
  - Tournament creation and management
  - Player registration and bracket generation
  - Live tournament tracking
  - Prize pool management

- **Community Features**
  - Forum system with categories and topics
  - Guild creation and management
  - Real-time chat with Socket.io
  - Friend system and user blocking

- **Admin Dashboard**
  - User management
  - Game moderation
  - Tournament oversight
  - Community moderation

- **Payment Integration**
  - Stripe payment processing
  - Subscription management
  - Premium features access

- **Real-time Features**
  - Live tournament updates
  - Chat functionality
  - Real-time notifications

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io
- **Payments**: Stripe
- **File Upload**: Multer, Cloudinary
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express-validator

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd gamezone-backend
```

2. Install dependencies
```bash
npm install
```

3. Create environment file
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gamezone
JWT_SECRET=your-super-secret-jwt-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
# ... other variables
```

5. Start the development server
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Games
- `GET /api/games` - Get all games (with filtering)
- `GET /api/games/featured` - Get featured games
- `GET /api/games/trending` - Get trending games
- `GET /api/games/categories` - Get game categories
- `GET /api/games/:id` - Get single game
- `POST /api/games/:id/review` - Add game review
- `POST /api/games/:id/play` - Record play session

### Tournaments
- `GET /api/tournaments` - Get all tournaments
- `GET /api/tournaments/live` - Get live tournaments
- `GET /api/tournaments/upcoming` - Get upcoming tournaments
- `GET /api/tournaments/:id` - Get single tournament
- `POST /api/tournaments` - Create tournament
- `POST /api/tournaments/:id/register` - Register for tournament
- `POST /api/tournaments/:id/generate-bracket` - Generate bracket

### Community
- `GET /api/community/forums/categories` - Get forum categories
- `GET /api/community/forums/topics` - Get forum topics
- `POST /api/community/forums/topics` - Create forum topic
- `GET /api/community/guilds` - Get all guilds
- `POST /api/community/guilds` - Create guild
- `POST /api/community/guilds/:id/join` - Join guild

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/games` - Get user's games
- `GET /api/users/tournaments` - Get user's tournaments
- `GET /api/users/friends` - Get user's friends
- `POST /api/users/friends/:userId` - Add friend

### Admin
- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/games` - Get all games
- `PUT /api/admin/games/:id/status` - Update game status

### Payments
- `POST /api/payments/create-payment-intent` - Create payment intent
- `POST /api/payments/confirm-payment` - Confirm payment
- `GET /api/payments/subscription-status` - Get subscription status
- `GET /api/payments/pricing` - Get pricing information

## Database Models

### User
- Profile information
- Authentication data
- Gaming preferences
- Statistics and achievements
- Social connections
- Subscription status

### Game
- Game details and metadata
- Categories and tags
- System requirements
- Reviews and ratings
- Statistics and analytics
- Tournament settings

### Tournament
- Tournament information
- Registration settings
- Schedule and matches
- Prize pool
- Participants and results
- Live streaming settings

### Community Models
- ForumCategory: Forum categories
- ForumTopic: Forum topics and replies
- Guild: Gaming guilds
- GuildChat: Guild chat messages

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting
- Input validation and sanitization
- CORS protection
- Helmet security headers
- XSS protection

## Real-time Features

Socket.io is used for:
- Live tournament updates
- Guild chat
- Real-time notifications
- Tournament spectator mode

## Payment Processing

Stripe integration for:
- Subscription payments
- One-time purchases
- Webhook handling
- Payment confirmation

## Error Handling

Comprehensive error handling with:
- Custom error middleware
- Validation error responses
- Database error handling
- HTTP status code management

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

### Environment Variables
See `.env.example` for all required environment variables.

## Deployment

1. Set up MongoDB database
2. Configure environment variables
3. Install dependencies: `npm install`
4. Start server: `npm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.