# TM Live Platform - Backend Debug Summary

**Status**: ✅ All critical bugs fixed  
**Last Updated**: 2026-07-23

---

## 🔧 Bugs Fixed

### 1. ✅ Payout Diamonds Record Bug (auth.js)
**Problem**: When requesting a payout, the diamonds count was saved as 0 instead of the actual amount
```javascript
// BEFORE (incorrect)
await Payout.create({
    userId: user._id,
    username: user.username,
    amount: dollarsAvailable,
    diamonds: user.diamonds,  // ❌ Already 0 here!
    bankName, accountNumber, accountName
});
```

**Solution**: Store the diamond count before zeroing it
```javascript
// AFTER (correct)
const diamondsToConvert = user.diamonds;
user.diamonds = 0;
await Payout.create({
    userId: user._id,
    username: user.username,
    amount: dollarsAvailable,
    diamonds: diamondsToConvert,  // ✅ Correct value
    bankName, accountNumber, accountName
});
```

---

### 2. ✅ Stream Viewer Count Tracking (server.js)
**Problem**: Viewer count increased when joining but never decreased when leaving, causing inaccurate stats

**Solution**: 
- Store stream room ID on socket: `socket.streamRoomId = roomId`
- Decrement count on disconnect
- Emit `viewer_left` event to notify streamer

```javascript
socket.on('disconnect', () => {
    if (socket.streamRoomId) {
        const stream = Object.values(liveStreams).find(s => s.roomId === socket.streamRoomId);
        if (stream && stream.viewerCount > 0) {
            stream.viewerCount--;
            io.to(stream.streamerId).emit('viewer_left', { 
                username: user.username, 
                viewerCount: stream.viewerCount 
            });
        }
    }
});
```

---

### 3. ✅ Gift Balance Validation (auth.js)
**Problem**: Users could gift diamonds they didn't have (no sender balance check)

**Solution**: Validate sender has sufficient diamonds before processing gift
```javascript
// Validate sender has enough diamonds
if (sender.diamonds < diamonds) {
    return res.status(400).json({ 
        message: `Insufficient diamonds. You have ${sender.diamonds}, need ${diamonds}` 
    });
}

// Deduct from sender first
sender.diamonds -= diamonds;
await sender.save();
```

---

### 4. ✅ Jsonwebtoken Import Cleanup (server.js)
**Problem**: JWT module was required inline instead of at module level

**Solution**: Added to top-level imports
```javascript
const jwt = require('jsonwebtoken');  // Added to imports at line 11
```

---

## 📋 Backend API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /signup` - Register new user
- `POST /login` - Login user
- `GET /profile/:username` - Get user profile
- `POST /follow/:username` - Follow user
- `POST /unfollow/:username` - Unfollow user
- `POST /update-bio` - Update bio
- `POST /update-profile` - Update profile (bio + picture)

### Gifts & Earnings (`/api/auth`)
- `POST /send-gift` - Send gift with diamonds
- `GET /earnings` - Get earnings dashboard
- `POST /request-payout` - Request payout (min $20)

### Admin Routes (`/api/admin`)
- `GET /users?page=1&limit=50&q=search` - List users with pagination
- `GET /user/:id` - Get single user details
- `POST /user/:id/ban` - Ban/unban user
- `POST /user/:id/make-admin` - Promote/demote admin
- `GET /audit?page=1&limit=50` - View audit logs

### Real-time Events (Socket.io)

**User Events:**
- `user_join` - User joins platform
- `typing` - User typing indicator
- `user_leave` - User leaves

**Chat Events:**
- `chat_message` - Chat message sent
- `stream_comment` - Comment in live stream

**Stream Events:**
- `start_stream` - Streamer goes live
- `join_stream` - Viewer joins stream
- `stream_offer/answer/ice` - WebRTC signaling
- `stream_ended` - Stream ends
- `viewer_joined` - New viewer joins
- `viewer_left` - Viewer leaves *(newly added)*

**Video Call Events:**
- `call_user` - Initiate call
- `incoming_call` - Receive call notification
- `accept_call` / `reject_call`
- `offer/answer/ice-candidate` - WebRTC signaling
- `end_call` - End call

**Gift Events:**
- `gift_sent` - Send gift notification
- `gift_received` - Broadcast gift received

### Admin Dashboard (Socket.io `/admin` namespace)
- Requires admin token in auth
- Events: `admin_init`, `admin_event`, `admin_user_count`, `admin_streams`

---

## 🚀 Starting the Backend Server

### Prerequisites
1. **Node.js** (v14+) - Install from https://nodejs.org/
2. **MongoDB Atlas** - Account with connection string in `.env`

### Setup Steps

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Verify .env file has:
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=tmlive_secret_key_2024
PORT=5001

# 4. (Optional) Create admin user
npm run seed-admin

# 5. Start server
npm start
```

### Expected Output
```
✅ MongoDB connected
✅ Server on http://localhost:5001
✅ Video calling ready!
✅ Live streaming ready!
```

### Verify Backend is Running
```bash
# Test API endpoint
curl http://localhost:5001/api/auth/profile/testuser
```

---

## 📊 Database Models

### User Schema
- username, email, password (hashed)
- bio, profilePicture
- diamonds, isAdmin, banned flags
- followers/following arrays
- totalEarned, pendingPayout, paidOut
- bankName, accountNumber, accountName

### Payout Schema
- userId, username, amount (USD), diamonds
- bankName, accountNumber, accountName
- status: "pending" | "completed" | "rejected"
- requestedAt timestamp

### Gift Schema
- fromUser, toUser
- giftName, giftEmoji, diamonds
- createdAt timestamp

### AuditLog Schema
- type: "ban" | "admin-change"
- actor (admin username), target (user username)
- meta (change details)
- createdAt timestamp

---

## ⚙️ Configuration

### Rate Limiting
- API: 200 requests per 15 min
- Auth: 80 requests per 15 min
- Admin: 120 requests per 15 min

### Security
- Helmet.js for HTTP headers
- CORS enabled for specified origins
- JWT tokens expire in 7 days
- bcryptjs for password hashing (salt rounds: 10)

### CORS Settings
```javascript
allowedOrigins = [
  'http://localhost:5001'  // Add frontend URL
]
```

---

## 🧪 Testing Checklist

- [ ] Server starts without errors
- [ ] MongoDB connection successful
- [ ] Can signup/login user
- [ ] Can update profile and bio
- [ ] Can send/receive gifts with balance validation
- [ ] Payout request records correct diamond count
- [ ] Stream viewer count accurate (join + leave)
- [ ] WebRTC signaling works for calls
- [ ] Admin can ban/promote users
- [ ] Audit logs record actions
- [ ] Socket.io events emit correctly

---

## 🐛 Common Issues

### MongoDB Connection Failed
- Check MONGO_URI in .env
- Ensure IP whitelist includes your address
- Test connection: `mongosh "mongodb+srv://..."`

### JWT Token Errors
- Verify JWT_SECRET matches in .env
- Ensure token header format: `Authorization: Bearer <token>`
- Token expires in 7 days

### Socket.io Connection Issues
- Check CORS origin configuration
- Verify client connects to correct server URL
- Check WebSocket support in browser

### Port 5001 Already in Use
- Find process: `lsof -i :5001` (Mac/Linux)
- Kill process: `kill -9 <PID>`
- Or change PORT in .env

---

## 📝 Notes

All critical bugs have been fixed. The backend is ready for testing and development. Make sure to:
1. Install dependencies with `npm install`
2. Configure `.env` with real MongoDB and JWT secret
3. Test all endpoints before deploying
4. Keep audit logs for security monitoring
