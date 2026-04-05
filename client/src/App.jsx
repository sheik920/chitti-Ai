import { useState, useEffect, useRef } from 'react';
import { Send, Bot, Sparkles, Loader2, LogOut, CreditCard, Plus, History, Trash2, MessageSquare, Mic, MicOff, Gamepad2, Keyboard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Login from './Login';
import Subscription from './Subscription';
import PuzzleGame from './PuzzleGame';
import TypingGame from './TypingGame';

function App() {
  const [user, setUser] = useState(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [allSessions, setAllSessions] = useState([]); // [{id, title, messages, createdAt}]
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Vanakkam! I am Chitti, the Robot. Version 1.0. How can I serve you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [serverStatus, setServerStatus] = useState('Connecting...');
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check server health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) {
          setServerStatus('Connected securely');
        } else {
          setServerStatus('Server error');
        }
      } catch (e) {
        setServerStatus('Disconnected from Agent');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // 3D Parallax Mouse Effect on background
  useEffect(() => {
    const handleMouseMove = (e) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 35;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 35;
      const bg = document.getElementById('parallax-bg');
      if (bg) {
        bg.style.transform = `scale(1.08) rotateY(${xAxis * 0.4}deg) rotateX(${yAxis * 0.3}deg) translateX(${-xAxis * 1.2}px) translateY(${-yAxis * 1.2}px)`;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Load all sessions from MongoDB when user logs in
  useEffect(() => {
    if (!user) return;
    const loadSessions = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
        const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(user.email)}`);
        if (res.ok) {
          const data = await res.json();
          const dbSessions = (data.sessions || []).map(s => ({
            id: s.sessionId,
            title: s.title,
            createdAt: new Date(s.createdAt).getTime(),
            messages: (s.messages || []).map(m => ({ role: m.role, content: m.content }))
          }));
          setAllSessions(dbSessions);
          if (dbSessions.length > 0) {
            const latest = dbSessions[0]; // already sorted newest-first
            setActiveSessionId(latest.id);
            setMessages(latest.messages.length > 0 ? latest.messages : [{ role: 'ai', content: 'Vanakkam! I am Chitti, the Robot. Version 1.0. How can I serve you today?' }]);
          } else {
            startFreshSession(user);
          }
        } else {
          startFreshSession(user);
        }
      } catch (e) {
        console.warn('Could not load sessions from DB, using fresh session.');
        startFreshSession(user);
      }
    };
    loadSessions();
  }, [user]);

  const startFreshSession = (u) => {
    const id = (u || user).email + '_' + Date.now();
    const newSession = {
      id,
      title: 'New Chat',
      createdAt: Date.now(),
      messages: [{ role: 'ai', content: 'Vanakkam! I am Chitti, the Robot. Version 1.0. How can I serve you today?' }]
    };
    setActiveSessionId(id);
    setMessages(newSession.messages);
    setAllSessions(prev => {
      const updated = [...prev, newSession];
      localStorage.setItem('chitti_sessions_' + (u || user).email, JSON.stringify(updated));
      return updated;
    });
  };

  // Keep local allSessions state in sync when messages change (MongoDB is the source of truth)
  useEffect(() => {
    if (!user || !activeSessionId || messages.length === 0) return;
    setAllSessions(prev => {
      const firstUser = messages.find(m => m.role === 'user');
      return prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages,
            title: firstUser ? firstUser.content.slice(0, 35) + (firstUser.content.length > 35 ? '...' : '') : s.title
          };
        }
        return s;
      });
    });
  }, [messages]);

  const handleNewChat = () => {
    startFreshSession();
    setShowHistory(false);
  };

  const loadSession = (session) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
  };

  const deleteSession = (e, sessionId) => {
    e.stopPropagation();
    // Delete from MongoDB
    const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
    fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' }).catch(console.warn);
    setAllSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        if (updated.length > 0) {
          const last = updated[0];
          setActiveSessionId(last.id);
          setMessages(last.messages);
        } else {
          startFreshSession();
        }
      }
      return updated;
    });
  };

  // Global Technical Sound Effect
  useEffect(() => {
    const playTechSound = () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Sci-fi high-pitch chirp
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1500, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1); 
        
        // Fast attack and decay
        gainNode.gain.setValueAtTime(0.0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch(e) {
        // Ignore if blocked by browser policy
      }
    };

    const handleGlobalClick = (e) => {
      if (e.target.closest('button') || e.target.closest('.plan-card')) {
        playTechSound();
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  const sendMessage = async (text) => {
    if (!text || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: activeSessionId,
          email: user?.email || null,
          name: user?.name || 'User',
        }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: 'Error: No response from Agent core.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Connection failed. Ensure the Agent server is running on port 3001.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice Recognition
  const handleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in this browser. Please use Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false; // Only final results = faster
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(transcript); // Send immediately, no delay
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  if (!user) {
    return (
      <>
        <div id="parallax-bg" className="parallax-bg"></div>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>
        <Login onLogin={setUser} />
      </>
    );
  }

  return (
    <>
      <div id="parallax-bg" className="parallax-bg"></div>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      {isSubscribing ? (
        <Subscription onBack={() => setIsSubscribing(false)} />
      ) : (
      <div className="app-container">

        {/* History Sidebar */}
        <div className={`history-sidebar ${showHistory ? 'open' : ''}`}>
          <div className="history-header">
            <h3><History size={16} /> Chat History</h3>
            <button className="history-close-btn" onClick={() => setShowHistory(false)}>✕</button>
          </div>
          <button className="history-new-btn" onClick={handleNewChat}>
            <Plus size={15} /> New Chat
          </button>
          <div className="history-list">
            {[...allSessions].reverse().map(session => (
              <div
                key={session.id}
                className={`history-item ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => loadSession(session)}
              >
                <MessageSquare size={14} style={{flexShrink:0}} />
                <div className="history-item-info">
                  <span className="history-item-title">{session.title}</span>
                  <span className="history-item-date">
                    {new Date(session.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button className="history-delete-btn" onClick={(e) => deleteSession(e, session.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {allSessions.length === 0 && (
              <p style={{color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px'}}>No history yet</p>
            )}
          </div>
        </div>
        {showHistory && <div className="history-overlay" onClick={() => setShowHistory(false)} />}

        <header className="header">
          <div className="logo-area">
            <div className="logo-icon">
              <Bot color="white" size={22} />
            </div>
            <div>
              <h1>Chitti AI</h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Welcome, {user.name}</p>
            </div>
          </div>
          
          <div className="header-actions">
            {/* History button */}
            <button 
              className={`hdr-btn ${showHistory ? 'hdr-btn-active' : ''}`}
              onClick={() => setShowHistory(v => !v)}
              title="Chat History"
            >
              <History size={16} />
              <span>History</span>
            </button>

            {/* New Chat button */}
            <button 
              className="hdr-btn"
              onClick={handleNewChat}
              title="New Chat"
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>

            {/* Game button */}
            <button
              className="hdr-btn hdr-btn-game"
              onClick={() => setShowGame(true)}
              title="Play Puzzle Game"
            >
              <Gamepad2 size={16} />
              <span>Game</span>
            </button>

            {/* Typing Game button */}
            <button
              className="hdr-btn hdr-btn-typing"
              onClick={() => setShowTyping(true)}
              title="Typing Speed Test"
            >
              <Keyboard size={16} />
              <span>Typing</span>
            </button>

            {/* Upgrade button */}
            <button 
              className="hdr-btn hdr-btn-upgrade"
              onClick={() => setIsSubscribing(true)}
              title="Upgrade Plan"
            >
              <CreditCard size={16} />
              <span>Upgrade</span>
            </button>

            {/* Status */}
            <div className="connection-status">
              <div className={`status-dot ${serverStatus === 'Connected securely' ? '' : 'offline'}`}></div>
              <span className="status-text">{serverStatus}</span>
            </div>

            {/* Logout */}
            <button className="logout-btn" onClick={() => setUser(null)} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="chat-container">
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                {msg.role === 'ai' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--secondary-glow)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <Sparkles size={14} /> Chitti
                  </div>
                )}
                {msg.role === 'ai' ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {isLoading && (
              <div className="message ai">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary-glow)', fontSize: '0.85rem' }}>
                  <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Processing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <form onSubmit={handleSubmit} className="input-form">
              <button
                type="button"
                className={`mic-button ${isListening ? 'mic-active' : ''}`}
                onClick={handleVoice}
                title={isListening ? 'Stop listening' : 'Speak to Chitti'}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <input
                type="text"
                className="chat-input"
                placeholder={isListening ? '🎤 Listening...' : 'Message Chitti AI...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
              />
              <button type="submit" className="send-button" disabled={isLoading || !input.trim()}>
                <Send size={20} />
              </button>
            </form>
          </div>
        </main>
      </div>
      )}

      {/* Puzzle Game Modal */}
      {showGame && <PuzzleGame onClose={() => setShowGame(false)} />}

      {/* Typing Game Modal */}
      {showTyping && <TypingGame onClose={() => setShowTyping(false)} />}
    </>
  );
}

export default App;
