import React, { useState } from 'react';
import { SendIcon, CheckIcon } from './icons';

export interface EnquiryFormProps {
  variant?: 'A' | 'B' | 'C';
  onSuccess?: () => void;
  className?: string;
}

export const EnquiryForm: React.FC<EnquiryFormProps> = ({
  variant = 'A',
  onSuccess,
  className = '',
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form Fields State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  // Enterprise / High-Volume Campus Demo Form fields
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [locationType, setLocationType] = useState('College Campus');
  const [interestType, setInterestType] = useState('Print Shop Automation Software');
  const [enquiryType, setEnquiryType] = useState('Live software demo');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Send to server API if available, or simulate success
      await fetch('/api/v1/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant,
          name,
          phone,
          email,
          message,
          city,
          state,
          locationType,
          interestType,
          enquiryType,
        }),
      }).catch(() => {
        // Fallback for standalone demo mode
      });
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-[#EAFBF0] border border-[#1F8A4C]/30 rounded-2xl p-8 text-center text-[#1F8A4C] animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-[#1F8A4C] text-white flex items-center justify-center mx-auto mb-3 shadow-md">
          <CheckIcon size={24} />
        </div>
        <h4 className="text-xl font-bold text-[#172031] mb-1">Enquiry Received!</h4>
        <p className="text-sm text-[#5B6475] max-w-sm mx-auto mb-4">
          Thank you, <span className="font-semibold text-[#172031]">{name}</span>. Our team will reach out to you via WhatsApp / Phone ({phone}) shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setName('');
            setPhone('');
            setEmail('');
            setMessage('');
          }}
          className="text-xs font-bold text-[#4D64E6] hover:underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  // Variant C: 9-Field Franchise Demo Form
  if (variant === 'C') {
    return (
      <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#172031] mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] focus:ring-2 focus:ring-[#2F5BE0]/20 text-sm outline-hidden transition-all bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#172031] mb-1.5">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                +91
              </span>
              <input
                type="tel"
                required
                pattern="[0-9]{10}"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] focus:ring-2 focus:ring-[#2F5BE0]/20 text-sm outline-hidden transition-all bg-white"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#172031] mb-1.5">
              Email Address <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ramesh@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] focus:ring-2 focus:ring-[#2F5BE0]/20 text-sm outline-hidden transition-all bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1.5">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pune"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] text-sm outline-hidden transition-all bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#172031] mb-1.5">
                State <span className="text-gray-400 font-normal">(Opt)</span>
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Maharashtra"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] text-sm outline-hidden transition-all bg-white"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#172031] mb-1.5">
              Organization / Location Type
            </label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] text-xs font-medium outline-hidden bg-white"
            >
              <option value="College Campus">College Campus</option>
              <option value="IT Park / Corporate">IT Park / Corporate</option>
              <option value="Stationery / Print Shop">Stationery / Print Shop</option>
              <option value="Residential Hub">Residential Society / Hub</option>
              <option value="Other">Other Location</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#172031] mb-1.5">
              Interested in
            </label>
            <select
              value={interestType}
              onChange={(e) => setInterestType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] text-xs font-medium outline-hidden bg-white"
            >
              <option value="Print Shop Automation Software">Print Shop Automation Software</option>
              <option value="WhatsApp & Counter QR Printing System">WhatsApp & Counter QR Printing System</option>
              <option value="Enterprise Multi-Store License">Enterprise Multi-Store License</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#172031] mb-1.5">
              Enquiry Type
            </label>
            <select
              value={enquiryType}
              onChange={(e) => setEnquiryType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] text-xs font-medium outline-hidden bg-white"
            >
              <option value="Live demo request">Live software demo request</option>
              <option value="Merchant onboarding request">Merchant onboarding request</option>
              <option value="Volume pricing inquiry">Volume pricing inquiry</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#172031] mb-1.5">
            Tell us about your location and plans <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your target footfall, available space (e.g. 10 sq ft near library), or current business..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#2F5BE0] focus:ring-2 focus:ring-[#2F5BE0]/20 text-sm outline-hidden transition-all bg-white resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#2F5BE0] hover:bg-[#254BC0] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? 'Submitting...' : 'Request franchise info →'}
        </button>
      </form>
    );
  }

  // Variant A (Home §11) & Variant B (Contact §8.2)
  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label className="block text-xs font-bold text-[#172031] mb-1.5">
          Your Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amit Sharma"
          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-[#172031] mb-1.5">
            Phone / WhatsApp <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#172031] mb-1.5">
            Email Address <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="amit@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-[#172031] mb-1.5">
          How can we help? <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your print shop, daily volume, or any questions you have..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E9F2] focus:border-[#4D64E6] focus:ring-2 focus:ring-[#4D64E6]/20 text-sm outline-hidden transition-all bg-white resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-[#4D64E6] hover:bg-[#3F54D1] text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <SendIcon size={16} />
        {loading ? 'Sending...' : 'Send enquiry'}
      </button>
    </form>
  );
};
