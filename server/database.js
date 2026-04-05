/**
 * database.js — Chitti AI · MongoDB Super Database (Mongoose)
 * Schemas: User, LoginLog, ChatSession, Message
 */

const mongoose = require('mongoose');

// ─── CONNECTION ───────────────────────────────────────────────────────────────

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chitti_ai';
  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected → ${uri}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    // Don't crash the server — app still works, just won't persist
  }
};

// ─── SCHEMAS & MODELS ─────────────────────────────────────────────────────────

// --- User ---
const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true, lowercase: true },
  name:       { type: String, default: 'User' },
  lastSeen:   { type: Date,   default: Date.now },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// --- Login Log ---
const loginLogSchema = new mongoose.Schema({
  email:      { type: String, required: true },
  name:       { type: String },
  ip:         { type: String, default: 'unknown' },
  userAgent:  { type: String, default: 'unknown' },
  loggedInAt: { type: Date, default: Date.now },
});

const LoginLog = mongoose.model('LoginLog', loginLogSchema);

// --- Chat Session ---
const chatSessionSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, unique: true },
  email:      { type: String, required: true },
  name:       { type: String, default: 'User' },
  title:      { type: String, default: 'New Chat' },
  updatedAt:  { type: Date,   default: Date.now },
}, { timestamps: true });

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

// --- Message ---
const messageSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, index: true },
  email:      { type: String, required: true },
  role:       { type: String, required: true, enum: ['user', 'ai'] },
  content:    { type: String, required: true },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Upsert user (create or update lastSeen + name)
const upsertUser = async (email, name) => {
  return User.findOneAndUpdate(
    { email },
    { name: name || 'User', lastSeen: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Log a login event
const logLogin = async (email, name, ip, userAgent) => {
  return LoginLog.create({ email, name, ip, userAgent });
};

// Save or update a chat session
const upsertSession = async (sessionId, email, name, title) => {
  return ChatSession.findOneAndUpdate(
    { sessionId },
    { email, name: name || 'User', title: title || 'New Chat', updatedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Save a message to a session
const saveMessage = async (sessionId, email, role, content) => {
  return Message.create({ sessionId, email, role, content });
};

// Get all sessions for a user (newest first)
const getUserSessions = async (email) => {
  const sessions = await ChatSession.find({ email }).sort({ updatedAt: -1 }).lean();
  // Attach messages to each session
  const withMessages = await Promise.all(sessions.map(async (s) => {
    const msgs = await Message.find({ sessionId: s.sessionId }).sort({ createdAt: 1 }).lean();
    return { ...s, messages: msgs.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })) };
  }));
  return withMessages;
};

// Delete a session and its messages
const deleteSession = async (sessionId) => {
  await Message.deleteMany({ sessionId });
  await ChatSession.deleteOne({ sessionId });
};

// Stats for admin dashboard
const getStats = async () => {
  const [totalUsers, totalSessions, totalMessages, totalLogins, recentUsers, topUsers] = await Promise.all([
    User.countDocuments(),
    ChatSession.countDocuments(),
    Message.countDocuments(),
    LoginLog.countDocuments(),
    User.find().sort({ lastSeen: -1 }).limit(5).select('email name lastSeen').lean(),
    Message.aggregate([
      { $group: { _id: '$email', msgCount: { $sum: 1 } } },
      { $sort: { msgCount: -1 } },
      { $limit: 5 }
    ])
  ]);
  return { totalUsers, totalSessions, totalMessages, totalLogins, recentUsers, topUsers };
};

// Full export for admin
const exportAllData = async () => {
  const [users, sessions, messages, logins] = await Promise.all([
    User.find().lean(),
    ChatSession.find().lean(),
    Message.find().sort({ createdAt: 1 }).lean(),
    LoginLog.find().sort({ loggedInAt: -1 }).lean(),
  ]);
  return { users, sessions, messages, logins, exportedAt: new Date().toISOString() };
};

module.exports = {
  connectDB,
  User,
  LoginLog,
  ChatSession,
  Message,
  upsertUser,
  logLogin,
  upsertSession,
  saveMessage,
  getUserSessions,
  deleteSession,
  getStats,
  exportAllData,
};
