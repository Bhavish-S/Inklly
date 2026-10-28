import React, { useState } from 'react';
import { Logo } from '../components/icons';
import { api } from '../api/client';

interface AcceptInvitationPageProps { onNavigate: (path: string) => void; }

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ onNavigate }) => {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return setError('Use at least 12 characters, including upper and lower case letters, a number, and a symbol.');
    }
    if (password !== confirmation) return setError('The passwords do not match.');
    setSubmitting(true);
    try {
      await api.acceptOwnerInvitation(token, password);
      window.history.replaceState({}, '', window.location.pathname);
      setAccepted(true);
      setPassword('');
      setConfirmation('');
    } catch (err: any) {
      setError(err.message || 'This setup link is invalid or expired. Ask the Inklly administrator for a new invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-[70vh] bg-[#FBFCFE] px-4 py-14 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-[#E6E9F2] bg-white p-8 shadow-xl">
        <button type="button" onClick={() => onNavigate('/')} aria-label="Go to Inklly home" className="mb-8"><Logo size={22} /></button>
        {accepted ? (
          <div role="status" aria-live="polite">
            <h1 className="text-2xl font-extrabold text-[#172031]">Account setup complete</h1>
            <p className="mt-3 text-sm text-slate-600">Your account is ready. Sign in with your email and the password you just created.</p>
            <button type="button" onClick={() => onNavigate('/login')} className="mt-6 w-full rounded-xl bg-[#4D64E6] px-4 py-3 text-sm font-bold text-white">Continue to sign in</button>
          </div>
        ) : !token ? (
          <div role="alert">
            <h1 className="text-2xl font-extrabold text-[#172031]">Invitation link required</h1>
            <p className="mt-3 text-sm text-slate-600">Open the private setup link shared with you by the shop owner or Inklly team.</p>
            <button type="button" onClick={() => onNavigate('/login')} className="mt-6 text-sm font-bold text-[#4D64E6]">Go to sign in</button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-[#172031]">Set up your account</h1>
            <p className="mt-2 text-sm text-slate-600">Use at least 12 characters, including upper and lower case letters, a number, and a symbol. This invitation can only be used once.</p>
            {error && <div role="alert" aria-live="polite" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">Password
                <input autoComplete="new-password" type="password" required minLength={12} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">Confirm password
                <input autoComplete="new-password" type="password" required minLength={12} maxLength={1024} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-[#4D64E6] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? 'Saving password…' : 'Activate account'}</button>
            </form>
          </>
        )}
      </div>
    </section>
  );
};
