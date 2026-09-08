const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { app, corsOptions, User } = require('./app');

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });

const users = {};
const waitingCalls = {};
const liveStreams = {};

const adminNamespace = io.of('/admin');
adminNamespace.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const secret = process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.id);
    if (!user || !user.isAdmin) return next(new Error('Admin access required'));
    socket.adminUser = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

adminNamespace.on('connection', (socket) => {
  const stats = {
    activeUsers: Object.keys(users).length,
    liveStreams: Object.values(liveStreams).map(stream => ({
      streamer: stream.username,
      viewers: stream.viewerCount,
      roomId: stream.roomId,
      startedAt: stream.startTime
    }))
  };
  socket.emit('admin_init', stats);
});

function emitAdminUpdate(event, payload) {
  adminNamespace.emit('admin_event', { event, payload, time: new Date().toISOString() });
  if (event === 'user_join' || event === 'user_leave') {
    adminNamespace.emit('admin_user_count', { count: Object.keys(users).length });
  }
  if (event === 'stream_started' || event === 'stream_finished' || event === 'viewer_joined' || event === 'viewer_left') {
    adminNamespace.emit('admin_streams', {
      streams: Object.values(liveStreams).map(stream => ({
        streamer: stream.username,
        viewers: stream.viewerCount,
        roomId: stream.roomId,
        startedAt: stream.startTime
      }))
    });
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('user_join', (username) => {
    users[socket.id] = { username, room: 'general' };
    io.emit('user_list', Object.values(users).map(u => u.username));
    io.emit('chat_message', {
      username: 'System',
      message: `${username} joined the chat`,
      time: new Date().toLocaleTimeString()
    });
    emitAdminUpdate('user_join', { username });
  });

  socket.on('typing', (isTyping) => {
    const user = users[socket.id];
    if (user) socket.broadcast.emit('user_typing', { username: user.username, isTyping });
  });

  socket.on('gift_sent', (data) => {
    io.emit('gift_received', {
      fromUser: data.fromUser,
      toUser: data.toUser,
      giftName: data.giftName,
      giftEmoji: data.giftEmoji,
      diamonds: data.diamonds
    });
    if (data.streamRoom) {
      io.to(data.streamRoom).emit('stream_gift', data);
    }
  });

  socket.on('start_stream', (data) => {
    const { username } = data;
    const roomId = `stream_${socket.id}`;
    socket.join(roomId);
    liveStreams[socket.id] = {
      streamerId: socket.id,
      username,
      roomId,
      viewerCount: 0,
      startTime: new Date().toISOString()
    };
    io.emit('stream_started', {
      streamerId: socket.id,
      username,
      roomId
    });
    emitAdminUpdate('stream_started', { streamer: username, roomId });
    console.log(`${username} went live`);
  });

  socket.on('join_stream', (data) => {
    const { roomId, username } = data;
    socket.join(roomId);
    socket.streamRoomId = roomId;
    const stream = Object.values(liveStreams).find(s => s.roomId === roomId);
    if (stream) {
      stream.viewerCount++;
      io.to(stream.streamerId).emit('viewer_joined', { username, viewerCount: stream.viewerCount });
      socket.emit('stream_info', stream);
      io.to(roomId).emit('stream_comment', {
        username: 'System',
        message: `${username} joined the stream`,
        time: new Date().toLocaleTimeString()
      });
      emitAdminUpdate('viewer_joined', { streamer: stream.username, username, viewerCount: stream.viewerCount });
    }
  });

  socket.on('stream_comment', (data) => {
    io.to(data.roomId).emit('stream_comment', {
      username: data.username,
      message: data.message,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on('stream_offer', (data) => {
    io.to(data.viewerSocketId).emit('stream_offer', {
      offer: data.offer,
      streamerId: socket.id
    });
  });

  socket.on('stream_answer', (data) => {
    io.to(data.streamerId).emit('stream_answer', {
      answer: data.answer,
      viewerSocketId: socket.id
    });
  });

  socket.on('stream_ice', (data) => {
    io.to(data.target).emit('stream_ice', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  socket.on('end_stream', (data) => {
    const stream = liveStreams[socket.id];
    if (stream) {
      io.to(stream.roomId).emit('stream_ended', { username: stream.username });
      io.emit('stream_finished', { streamerId: socket.id, username: stream.username });
      emitAdminUpdate('stream_finished', { streamer: stream.username, roomId: stream.roomId });
      delete liveStreams[socket.id];
      console.log(`${stream.username} ended stream`);
    }
  });

  socket.on('call_user', (data) => {
    const targetSocket = Object.keys(users).find(key => users[key].username === data.target);
    if (targetSocket) {
      waitingCalls[targetSocket] = socket.id;
      io.to(targetSocket).emit('incoming_call', { from: users[socket.id].username, fromId: socket.id });
    }
  });

  socket.on('accept_call', (data) => {
    io.to(data.fromId).emit('call_accepted', { from: users[socket.id].username, fromId: socket.id });
  });

  socket.on('reject_call', (data) => {
    io.to(data.fromId).emit('call_rejected');
  });

  socket.on('offer', (data) => {
    io.to(data.target).emit('offer', { offer: data.offer, from: socket.id });
  });

  socket.on('answer', (data) => {
    io.to(data.target).emit('answer', { answer: data.answer, from: socket.id });
  });

  socket.on('ice-candidate', (data) => {
    io.to(data.target).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
  });

  socket.on('end_call', (data) => {
    io.to(data.target).emit('call_ended');
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      if (liveStreams[socket.id]) {
        const stream = liveStreams[socket.id];
        io.to(stream.roomId).emit('stream_ended', { username: stream.username });
        io.emit('stream_finished', { streamerId: socket.id, username: stream.username });
        emitAdminUpdate('stream_finished', { streamer: stream.username, roomId: stream.roomId });
        delete liveStreams[socket.id];
      }
      if (socket.streamRoomId) {
        const stream = Object.values(liveStreams).find(s => s.roomId === socket.streamRoomId);
        if (stream && stream.viewerCount > 0) {
          stream.viewerCount--;
          io.to(stream.streamerId).emit('viewer_left', { username: user.username, viewerCount: stream.viewerCount });
          emitAdminUpdate('viewer_left', { streamer: stream.username, username: user.username, viewerCount: stream.viewerCount });
        }
      }
      delete users[socket.id];
      io.emit('user_list', Object.values(users).map(u => u.username));
      io.emit('chat_message', {
        username: 'System',
        message: `${user.username} left the chat`,
        time: new Date().toLocaleTimeString()
      });
      emitAdminUpdate('user_leave', { username: user.username });
    }
  });
});

const PORT = process.env.PORT || 5001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on http://localhost:${PORT}`);
  console.log('Video calling ready!');
  console.log('Live streaming ready!');
});

module.exports = { httpServer, io };
