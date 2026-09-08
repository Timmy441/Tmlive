const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const mongoose = require('mongoose');
const dns = require('dns');
const { router: authRouter, User } = require('./auth');
const adminRouter = require('./admin');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.set('trust proxy', 1);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TM Live backend is running',
    environment: process.env.VERCEL ? 'vercel' : 'local'
  });
});

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5001,http://127.0.0.1:5001,http://localhost:5500,http://127.0.0.1:5500,https://tmliveweb.vercel.app').split(',').map(s => s.trim());
const corsOptions = {
  origin: function(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin === 'null' ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: 'Too many authentication attempts, please try again later.'
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: 'Too many admin requests, please slow down.'
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json());
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/admin', adminLimiter, adminRouter);
app.use('/api', apiLimiter);

app.post('/api/chatbot', (req, res) => {
  const userMessage = String(req.body?.message || '').trim();
  if (!userMessage) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const text = userMessage.toLowerCase();
  const baseReply = {
    answer: 'Thanks for your question! I am available 24/7 and can help with account setup, streaming, gifts, payouts, and platform rules.',
    category: 'general',
    quickReplies: [
      'How do I sign up?',
      'How do I go live?',
      'How do payouts work?',
      'How do I contact support?'
    ],
    handoff: false
  };

  const helpMap = [
    {
      match: /pricing|cost|price|subscription/,
      category: 'billing',
      reply: 'TM Live currently offers a free core experience. Premium tools and upgrades will be available soon. Contact support if you need enterprise billing details.',
      quickReplies: ['How do payouts work?', 'How do I contact support?']
    },
    {
      match: /sign ?up|register|create account|create an account/,
      category: 'account',
      reply: 'To sign up, navigate to the registration page and enter your username, email address, and password. You can start streaming once your account is verified.',
      quickReplies: ['How do I go live?', 'How do I edit my profile?']
    },
    {
      match: /live stream|go live|streaming|stream/,
      category: 'streaming',
      reply: 'To start streaming, click the Go Live button and allow camera and microphone access. Then invite viewers to your stream room or share the stream link.',
      quickReplies: ['How do viewers join?', 'How do I end a stream?']
    },
    {
      match: /earnings|withdraw|payout|payment|diamonds/,
      category: 'earnings',
      reply: 'Earnings are shown in your dashboard. Diamonds convert to cash at the platform rate, and payout requests are typically processed within 3 to 5 business days.',
      quickReplies: ['What is the payout minimum?', 'How do gifts work?']
    },
    {
      match: /gift|send gift|gifted|gifts/,
      category: 'gifts',
      reply: 'Gifts can be sent during a live stream. Each gift adds diamonds to the recipient and creates a notification so creators know you supported them.',
      quickReplies: ['How do I buy diamonds?', 'How do payouts work?']
    },
    {
      match: /ban|blocked|suspended/,
      category: 'account-safety',
      reply: 'If an account is banned or suspended, please contact support directly using the email in the footer. Our team can review your account status.',
      quickReplies: ['How do I contact support?', 'What are the community rules?']
    },
    {
      match: /support|help|customer service|contact|human|agent/,
      category: 'support',
      reply: 'I am here 24/7. You can also reach real support at support@tmlive.com or WhatsApp via the contact button in the footer.',
      quickReplies: ['Report a technical issue', 'What are the community rules?'],
      handoff: true
    },
    {
      match: /technical|error|bug|issue|not working|cannot connect/,
      category: 'technical',
      reply: 'For technical issues, try refreshing the page first. If the problem persists, send us a screenshot or describe the error and support will respond quickly.',
      quickReplies: ['Report a technical issue', 'How do I contact support?'],
      handoff: true
    }
  ];

  const match = helpMap.find(item => item.match.test(text));
  const response = match
    ? {
        answer: match.reply,
        category: match.category,
        quickReplies: match.quickReplies,
        handoff: !!match.handoff
      }
    : baseReply;

  res.json(response);
});

app.use(express.static(path.join(__dirname, '../frontend/public')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

if (typeof dns.setServers === 'function') {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

module.exports = { app, corsOptions, User };
