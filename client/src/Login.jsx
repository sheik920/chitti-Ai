import { useState } from 'react';
import { Bot, LogIn, Mail, Lock, ShieldCheck } from 'lucide-react';

export default function Login({ onLogin }) {
  const [step, setStep] = useState('EMAIL'); // 'EMAIL' or 'OTP'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    setError('');
    setMessage('');
    setPreviewUrl('');
    
    try {
      const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (res.ok) {
        setStep('OTP');
        setMessage(data.message);
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Connection failed. Server might be down.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp) return;

    setIsSubmitting(true);
    setError('');

    try {
      const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        onLogin({ email, name: email.split('@')[0] });
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('Connection failed. Server might be down.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box 3d-box">
        <div className="login-header">
          <div className="logo-icon-large">
            <Bot color="white" size={40} />
          </div>
          <h2>Chitti AI</h2>
          <p>Secure Agent Login</p>
        </div>

        {error && <div style={{color: '#ef4444', textAlign: 'center', fontSize: '0.9rem'}}>{error}</div>}
        {message && <div style={{color: '#10b981', textAlign: 'center', fontSize: '0.9rem'}}>{message}</div>}
        {previewUrl && (
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{
              background: '#3730a3', color: 'white', padding: '8px 15px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-block'
            }}>
              Open Ethereal Test Inbox
            </a>
          </div>
        )}

        {step === 'EMAIL' ? (
          <form onSubmit={handleSendOTP} className="login-form">
            <div className="input-group">
              <span className="input-icon"><Mail size={18} /></span>
              <input 
                type="email" 
                placeholder="Gmail address" 
                className="login-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : (
                <>
                  <ShieldCheck size={18} /> 
                  <span>Request OTP</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="login-form">
            <div className="input-group">
              <span className="input-icon"><Lock size={18} /></span>
              <input 
                type="text" 
                placeholder="Enter 6-digit OTP" 
                className="login-input"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : (
                <>
                  <LogIn size={18} /> 
                  <span>Verify & Enter System</span>
                </>
              )}
            </button>
            <button 
              type="button" 
              onClick={() => setStep('EMAIL')} 
              style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '10px'}}
            >
              Back to email
            </button>
          </form>
        )}

        <div className="login-footer">
          <p>Requires real Gmail authentication based on .env config.</p>
        </div>
      </div>
    </div>
  );
}
