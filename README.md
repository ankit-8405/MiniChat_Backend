# Chat Application - Backend

Real-time chat application server with authentication, channels, and messaging.

## Features

- JWT-based authentication
- Real-time messaging with Socket.io
- Channel management
- Message history with pagination
- Online/offline presence tracking
- Rate limiting and security middleware

## Security Features

- Helmet.js for HTTP headers security
- Rate limiting on API endpoints
- MongoDB injection protection
- Input validation with express-validator
- Password hashing with bcrypt
- JWT token authentication
- CORS configuration
- Request size limits

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Update environment variables:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Generate a strong random secret (use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `CLIENT_URL`: Your frontend URL
- `PORT`: Server port (default: 5000)

4. Start MongoDB:
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo

# Or install MongoDB locally
```

5. Run the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Channels
- `GET /api/channels` - List all channels
- `GET /api/channels/my-channels` - Get user's channels
- `POST /api/channels` - Create new channel
- `POST /api/channels/:channelId/join` - Join channel

### Messages
- `GET /api/messages/:channelId` - Get channel messages (with pagination)
- `POST /api/messages` - Send message

## Socket Events

### Client → Server
- `channel:join` - Join a channel room
- `channel:leave` - Leave a channel room
- `message:send` - Send a message
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator

### Server → Client
- `message:new` - New message received
- `presence:update` - Online users updated
- `typing:user` - User is typing
- `typing:stop` - User stopped typing
- `error` - Error message

## Database Schema

### User
- username (unique, 3-30 chars, alphanumeric + underscore)
- password (hashed, min 6 chars)
- createdAt

### Channel
- name (unique, 1-50 chars)
- members (array of user IDs)
- createdBy (user ID)
- createdAt

### Message
- sender (user ID)
- channelId (channel ID)
- text (1-2000 chars)
- timestamp

## Rate Limits

- General API: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure proper `MONGODB_URI` (MongoDB Atlas recommended)
4. Set correct `CLIENT_URL`
5. Use HTTPS
6. Consider using PM2 or similar process manager
7. Set up proper logging and monitoring
