import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Sparkles, Radio, Eye, EyeOff, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth, loginWithGoogle, loginWithEmail, registerWithEmail } from '../firebase';
import { motion } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
  initialMode?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simple fields validation
    if (!email || !password) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    if (mode === 'signup' && !fullName) {
      setError('Please provide your full display name.');
      setLoading(false);
      return;
    }

    try {
      let user;
      if (mode === 'login') {
        user = await loginWithEmail(email, password);
      } else {
        user = await registerWithEmail(email, password, fullName);
      }
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Email authentication failure:', err);
      // TEMPORARY DIAGNOSTIC: expose only the Firebase Auth error code, never secrets.
      const firebaseCode = typeof err?.code === 'string' ? err.code : 'unknown';
      let friendlyMessage = err.message || 'An authentication error occurred.';
      if (friendlyMessage.includes('auth/invalid-credential') || friendlyMessage.includes('auth/wrong-password')) {
        friendlyMessage = 'Invalid email or password combination.';
      } else if (friendlyMessage.includes('auth/email-already-in-use')) {
        friendlyMessage = 'An account with this email already exists.';
      } else if (friendlyMessage.includes('auth/weak-password')) {
        friendlyMessage = 'Password must be at least 6 characters.';
      } else if (friendlyMessage.includes('auth/invalid-email')) {
        friendlyMessage = 'Please enter a valid email address.';
      }
      setError(`${friendlyMessage} [Firebase code: ${firebaseCode}]`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginWithGoogle();
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      console.error('Google sign in failure:', err);
      // TEMPORARY DIAGNOSTIC: expose only the Firebase Auth error code, never secrets.
      const firebaseCode = typeof err?.code === 'string' ? err.code : 'unknown';
      setError(`${err.message || 'Failed to authenticate via Google.'} [Firebase code: ${firebaseCode}]`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface/60 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto" id="auth-modal-overlay">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-[24px] shadow-xl shadow-primary-dim/5 flex flex-col p-8 text-center border border-surface-variant overflow-hidden"
        id="auth-modal-container"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9af4d6] via-[#01725a] to-[#9af4d6] opacity-30"></div>
        
        <div className="w-20 h-20 rounded-full bg-primary-container/20 flex items-center justify-center mx-auto mb-6 shadow-sm">
          {mode === 'login' ? (
            <Lock className="h-10 w-10 text-primary-dim" strokeWidth={1.5} />
          ) : (
            <User className="h-10 w-10 text-primary-dim" strokeWidth={1.5} />
          )}
        </div>
        
        <h2 className="font-semibold text-[24px] text-on-surface mb-3 tracking-tight">
          {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
        </h2>
        
        <p className="text-[14px] text-on-surface-variant mb-6 px-2">
          {mode === 'login' 
            ? 'Sign in to FindTrack to manage your lost & found items and stay connected with the community.'
            : 'Join FindTrack to securely report, track, and recover your lost belongings.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm py-2 px-3 rounded-xl mb-6 flex items-start text-left gap-2">
            <span className="font-bold shrink-0 mt-0.5">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 text-left">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="font-dmsans text-[11px] font-bold text-on-surface-variant uppercase tracking-widest block">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Carl Jaya"
                  className="shadow-sm w-full rounded-xl border border-outline-variant bg-surface-container pr-11 pl-4 py-3 font-dmsans text-[13px] text-on-surface transition focus:border-primary/30 focus:bg-surface-container-lowest focus:outline-none"
                  id="signup-input-name"
                />
                <User className="absolute right-3.5 top-3 h-4 w-4 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-dmsans text-[11px] font-bold text-on-surface-variant uppercase tracking-widest block">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="shadow-sm w-full rounded-xl border border-outline-variant bg-surface-container pr-11 pl-4 py-3 font-dmsans text-[13px] text-on-surface transition focus:border-primary/30 focus:bg-surface-container-lowest focus:outline-none"
                id="auth-input-email"
              />
              <Mail className="absolute right-3.5 top-3 h-4 w-4 text-on-surface-variant pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5 mb-2">
            <div className="flex items-center justify-between">
              <label className="font-dmsans text-[11px] font-bold text-on-surface-variant uppercase tracking-widest block">Password</label>
              {mode === 'login' && (
                <a className="font-dmsans text-[11px] font-bold text-primary hover:text-primary cursor-not-allowed">
                  Forgot Password?
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="shadow-sm w-full rounded-xl border border-outline-variant bg-surface-container pl-4 pr-20 py-3 font-dmsans text-[13px] text-on-surface transition focus:border-primary/30 focus:bg-surface-container-lowest focus:outline-none"
                id="auth-input-password"
              />
              <Lock className="absolute right-12 top-3 h-4 w-4 text-on-surface-variant pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-2.5 p-1 text-on-surface-variant hover:text-primary rounded transition-all duration-200 ease-out hover:scale-115 active:scale-90 active:rotate-3 cursor-pointer"
                style={{ transition: 'all 0.2s ease' }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <div className="transition-all duration-200" style={{ transition: 'all 0.2s ease' }}>
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-primary" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="w-full flex flex-col gap-3 mt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-white font-medium text-[14px] py-3 px-6 rounded-xl shadow-md hover:bg-primary-dim transition-all duration-200 flex items-center justify-center gap-2"
              id="auth-submit-btn"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
            <button 
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="w-full bg-transparent text-primary border border-primary font-medium text-[14px] py-3 px-6 rounded-xl hover:bg-primary-container/20 transition-all duration-200 flex items-center justify-center gap-2"
              id="auth-toggle-mode-btn"
            >
              {mode === 'login' ? 'Create a free account' : 'Sign In instead'}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <button 
            onClick={onClose}
            className="font-medium text-[14px] text-on-surface-variant hover:text-primary underline decoration-gray-400/30 underline-offset-4 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </motion.div>
    </div>
  );
}
