const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');
const nodemailer = require('nodemailer');
const {
  connectDB,
  upsertUser,
  logLogin,
  upsertSession,
  saveMessage,
  getUserSessions,
  deleteSession,
  getStats,
  exportAllData,
} = require('./database');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: (origin, callback) => {
    // Allow: React dev (5173), localhost, Android same-network, Postman (no origin)
    const allowed = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/;
    if (!origin || allowed.test(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── CONNECT MONGODB ──────────────────────────────────────────────────────────
connectDB();

// ─── GEMINI AI SETUP ──────────────────────────────────────────────────────────
const ai = new GoogleGenAI({});
const chatSessions = {}; // in-memory Gemini context per sessionId
const otpStore = {};     // in-memory OTP store

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── AGENT TOOLS ──────────────────────────────────────────────────────────────
const tools = [
  {
    functionDeclarations: [
      {
        name: 'get_server_time',
        description: 'Returns the current server time, date, and timezone.',
      },
      {
        name: 'execute_math',
        description: 'Evaluates a mathematical expression and returns the result.',
        parameters: {
          type: 'OBJECT',
          properties: {
            expression: {
              type: 'STRING',
              description: 'The math expression to evaluate, like 5 + 5 * 2'
            }
          },
          required: ['expression']
        }
      }
    ]
  }
];

const handleToolCall = (call) => {
  if (call.name === 'get_server_time') {
    return { time: new Date().toString() };
  }
  if (call.name === 'execute_math') {
    try {
      if (/[^0-9\+\-\*\/\(\)\.\s]/.test(call.args.expression)) {
        return { error: 'Invalid characters in math expression' };
      }
      const result = Function("return (" + call.args.expression + ")")();
      return { result: String(result) };
    } catch(e) {
      return { error: 'Failed to evaluate' };
    }
  }
  return { error: 'Tool not found' };
};

// ─── ROUTERS ──────────────────────────────────────────────────────────────────

const authRouter   = express.Router();
const chatRouter   = express.Router();
const sessionRouter = express.Router();
const adminRouter  = express.Router();

// ── AUTH ──────────────────────────────────────────────────────────────────────

authRouter.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  // Dev mode: use Ethereal if real credentials not set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'INSERT_YOUR_APP_PASSWORD_HERE') {
    const testAccount = await nodemailer.createTestAccount();
    const etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', port: 587, secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    const info = await etherealTransporter.sendMail({
      from: '"Chitti AI (Test)" <test@ethereal.email>',
      to: email,
      subject: 'Chitti AI Login OTP',
      text: `Your One Time Password is: ${otp}\n\nThis OTP expires in 5 minutes.`
    });
    return res.json({ message: 'OTP sent to Ethereal test inbox!', previewUrl: nodemailer.getTestMessageUrl(info) });
  }

  await transporter.sendMail({
    from: `"Chitti AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Chitti AI Login OTP',
    text: `Your One Time Password is: ${otp}\n\nThis OTP expires in 5 minutes.`
  });
  res.json({ message: 'OTP sent successfully!' });
});

authRouter.post('/verify-otp', async (req, res) => {
  const { email, otp, name } = req.body;
  if (!otpStore[email] || otpStore[email] !== otp) {
    return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
  }
  delete otpStore[email];

  // Persist user + login log to MongoDB
  await upsertUser(email, name || 'User');
  await logLogin(
    email,
    name || 'User',
    req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    req.headers['user-agent']
  );

  res.json({ success: true, message: 'Logged in successfully' });
});

// ── CHAT ──────────────────────────────────────────────────────────────────────

chatRouter.post('/', async (req, res) => {
  const { message, sessionId = 'android-client', email, name } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  console.log(`💬 [${email || 'guest'}/${sessionId}] ${message}`);

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ reply: "⚠️ Add your GEMINI_API_KEY to server/.env to activate my brain." });
  }

  // Persist user message
  if (email) {
    await upsertSession(sessionId, email, name, null);
    await saveMessage(sessionId, email, 'user', message);
  }

  // Create Gemini session if needed
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are a powerful Agentic AI named Chitti. You are responding to a user interacting via Android mobile connected to a local Node.js server. Use tools when needed. Keep responses concise, friendly, and conversational.",
        temperature: 0.7,
        tools,
      }
    });
  }

  const chat = chatSessions[sessionId];
  let response = await chat.sendMessage({ message });

  // Agent loop — handle tool calls
  while (response.functionCalls?.length > 0) {
    console.log("🔧 Tool calls:", response.functionCalls.map(c => c.name));
    const toolResponses = response.functionCalls.map(call => ({
      functionResponse: { id: call.id, name: call.name, response: handleToolCall(call) }
    }));
    response = await chat.sendMessage({ message: toolResponses });
  }

  const replyText = response.text;

  // Persist AI reply + update session title
  if (email) {
    await upsertSession(sessionId, email, name, message.slice(0, 40) + (message.length > 40 ? '...' : ''));
    await saveMessage(sessionId, email, 'ai', replyText);
  }

  res.json({ reply: replyText });
});

// ── SESSIONS ──────────────────────────────────────────────────────────────────

sessionRouter.get('/:email', async (req, res) => {
  const sessions = await getUserSessions(decodeURIComponent(req.params.email));
  res.json({ sessions });
});

sessionRouter.delete('/:sessionId', async (req, res) => {
  await deleteSession(req.params.sessionId);
  res.json({ success: true });
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────

adminRouter.get('/stats', async (_req, res) => {
  const stats = await getStats();
  res.json(stats);
});

adminRouter.get('/export', async (_req, res) => {
  const data = await exportAllData();
  res.setHeader('Content-Disposition', 'attachment; filename="chitti_db_export.json"');
  res.json(data);
});

// ─── MOUNT ROUTERS ────────────────────────────────────────────────────────────

app.use('/api/auth',     authRouter);
app.use('/api/chat',     chatRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/admin',    adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Chitti AI Server is running!', db: 'MongoDB', express: '5.x' });
});

// ─── GLOBAL ERROR HANDLER (Express 5 — catches async throws automatically) ───

app.use((err, req, res, _next) => {
  console.error(`❌ [${req.method} ${req.path}]`, err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chitti AI Server → http://0.0.0.0:${PORT}`);
  console.log(`📡 React UI expected at port 5173`);
});
