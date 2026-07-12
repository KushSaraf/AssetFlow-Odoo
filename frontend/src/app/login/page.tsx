'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, ApiError } from '../../lib/api';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const { login } = useAuth();
  const { toast } = useToast();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Validation / Loading states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email address.';
    }

    if (mode === 'login' || mode === 'signup') {
      if (!password) {
        newErrors.password = 'Password is required.';
      } else if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters.';
      }
    }

    if (mode === 'signup') {
      if (!name) {
        newErrors.name = 'Full name is required.';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords don't match.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        login(data.token, data.user);
        toast('Logged in successfully!');
      } else if (mode === 'signup') {
        const data = await apiFetch('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
        login(data.token, data.user);
        toast('Account created successfully!');
      } else if (mode === 'forgot') {
        await apiFetch('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setResetSent(true);
        toast('Password reset link sent to your email.');
      }
    } catch (err) {
      console.error(err);
      if (err instanceof ApiError) {
        if (err.code === 'validation_error' && err.field) {
          setErrors({ [err.field]: err.message });
        } else {
          toast(err.message, 'error');
        }
      } else {
        toast('Something went wrong. Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F8] p-4">
      <div className="w-full max-w-[420px] rounded-sm border border-[#E3E3E6] bg-white p-8 shadow-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[#714B67] text-lg font-bold text-white">
            AF
          </div>
          <h2 className="text-lg font-semibold text-[#1F1F1F]">AssetFlow</h2>
          <p className="text-xs text-[#6C757D]">
            {mode === 'login' && 'Sign in to manage your assets'}
            {mode === 'signup' && 'Create your employee account'}
            {mode === 'forgot' && 'Reset your password'}
          </p>
        </div>

        {/* Forgot password confirmation state */}
        {mode === 'forgot' && resetSent ? (
          <div className="text-center space-y-4">
            <div className="text-xs text-[#6C757D]">
              If an account matches <span className="font-semibold text-[#1F1F1F]">{email}</span>, you will receive a reset link shortly.
            </div>
            <button
              onClick={() => {
                setResetSent(false);
                setMode('login');
              }}
              className="text-xs font-semibold text-[#714B67] hover:underline"
            >
              Back to Log in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                    errors.name ? 'border-red-500' : 'border-[#E3E3E6]'
                  }`}
                  placeholder="John Doe"
                  disabled={isLoading}
                />
                {errors.name && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.name}</span>}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                  errors.email ? 'border-red-500' : 'border-[#E3E3E6]'
                }`}
                placeholder="email@example.com"
                disabled={isLoading}
              />
              {errors.email && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.email}</span>}
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-[#714B67] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                    errors.password ? 'border-red-500' : 'border-[#E3E3E6]'
                  }`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                {errors.password && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.password}</span>}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-[#6C757D] uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full rounded-sm border px-3 py-2 text-xs outline-none focus:border-[#714B67] ${
                    errors.confirmPassword ? 'border-red-500' : 'border-[#E3E3E6]'
                  }`}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <span className="text-[10px] text-red-500 mt-0.5 block">{errors.confirmPassword}</span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-sm bg-[#714B67] py-2 text-xs font-semibold text-white hover:bg-[#5B3B53] disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              ) : mode === 'login' ? (
                'Log In'
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Send Reset Link'
              )}
            </button>

            {mode === 'signup' && (
              <p className="text-[10px] text-[#6C757D] text-center mt-2 leading-relaxed">
                Sign up creates an Employee account. Department Head and Asset Manager roles are assigned by an Admin.
              </p>
            )}

            {/* Mode Switchers */}
            <div className="text-center pt-2 border-t border-[#F7F7F8]">
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-xs text-[#714B67] hover:underline"
                >
                  Don't have an account? Sign Up
                </button>
              )}
              {mode === 'signup' && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-[#714B67] hover:underline"
                >
                  Already have an account? Log In
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-xs text-[#714B67] hover:underline"
                >
                  Back to Log In
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
