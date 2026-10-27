import React, { useRef, useState } from 'react';
import { api } from '../api/client';
import { SendIcon, CheckIcon } from './icons';

export interface EnquiryFormProps {
  variant?: 'A' | 'B';
  onSuccess?: () => void;
  className?: string;
}

export const EnquiryForm: React.FC<EnquiryFormProps> = ({ variant = 'A', onSuccess, className = '' }) => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());

  const resetForm = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setWebsite('');
    setError('');
    idempotencyKey.current = crypto.randomUUID();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.submitEnquiry({
        source: variant === 'B' ? 'CONTACT' : 'HOME',
        name,
        phone,
        email,
        message,
        website,
      }, idempotencyKey.current);
      setSubmitted(true);
      onSuccess?.();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not send your enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[#EAFBF0] border border-[#1F8A4C]/30 rounded-2xl p-8 text-center text-[#1F8A4C] animate-fade-in" role="status" aria-live="polite">
        <div className="w-12 h-12 rounded-full bg-[#1F8A4C] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
          <CheckIcon size={24} />
        </div>
        <h4 className="text-xl font-bold text-[#172031] mb-1">Enquiry received</h4>
        <p className="text-sm text-[#5B6475] max-w-sm mx-auto mb-4">
          Thanks, <span className="font-semibold text-[#172031]">{name}</span>. We have saved your message and will follow up using the contact details you provided.
        </p>
        <button type="button" onClick={resetForm} className="text-xs font-bold text-[#4D64E6] hover:underline">
          Send another message
        </button>
      </div>
    );
  }

  const fieldClass = 'w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white';

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor={`enquiry-name-${variant}`} className="block text-xs font-bold text-[#172031] mb-1.5">
          Your name <span className="text-red-500">*</span>
        </label>
        <input id={`enquiry-name-${variant}`} type="text" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Amit Sharma" className={fieldClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`enquiry-phone-${variant}`} className="block text-xs font-bold text-[#172031] mb-1.5">
            Phone / WhatsApp <span className="text-red-500">*</span>
          </label>
          <input id={`enquiry-phone-${variant}`} type="tel" autoComplete="tel" required minLength={7} maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`enquiry-email-${variant}`} className="block text-xs font-bold text-[#172031] mb-1.5">
            Email address <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input id={`enquiry-email-${variant}`} type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="amit@example.com" className={fieldClass} />
        </div>
      </div>

      <div>
        <label htmlFor={`enquiry-message-${variant}`} className="block text-xs font-bold text-[#172031] mb-1.5">
          How can we help? <span className="text-red-500">*</span>
        </label>
        <textarea id={`enquiry-message-${variant}`} required minLength={10} maxLength={2000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us about your print shop and what you are looking for..." className={`${fieldClass} resize-none`} />
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`enquiry-website-${variant}`}>Leave this field empty</label>
        <input id={`enquiry-website-${variant}`} tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={loading} className="w-full py-3 bg-[#4D64E6] hover:bg-[#3F54D1] disabled:opacity-60 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait">
        <SendIcon size={16} />
        {loading ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
};
