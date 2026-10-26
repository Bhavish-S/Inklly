import React from 'react';
import { WhatsAppIcon } from './icons';

export const FloatingWhatsApp: React.FC = () => {
  return (
    <a
      href="https://wa.me/918999829418"
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Chat with Inklly on WhatsApp"
    >
      <WhatsAppIcon size={28} />
    </a>
  );
};
