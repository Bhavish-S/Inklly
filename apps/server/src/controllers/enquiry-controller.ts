import { Request, Response } from 'express';
import * as crypto from 'node:crypto';
import { EnquiryRepository } from '@inklly/db';

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

export class EnquiryController {
  constructor(private enquiries: EnquiryRepository) {}

  public submit = (req: Request, res: Response) => {
    const name = cleanText(req.body?.name);
    const phone = cleanText(req.body?.phone);
    const email = cleanText(req.body?.email);
    const message = cleanText(req.body?.message);
    const city = cleanText(req.body?.city);
    const state = cleanText(req.body?.state);
    const source = req.body?.source;

    // A hidden form field is a lightweight bot trap. It is never stored or
    // included in logs; real users never see or fill it.
    if (cleanText(req.body?.website)) {
      return res.status(400).json({ error: 'Please review the form and try again.' });
    }
    if (
      !name || name.length < 2 || name.length > 100 ||
      !phone || !/^[+()\d\s-]{7,24}$/.test(phone) ||
      (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
      !message || message.length < 10 || message.length > 2000 ||
      (city && city.length > 100) || (state && state.length > 100) ||
      !['HOME', 'CONTACT'].includes(source)
    ) {
      return res.status(422).json({ error: 'Please provide a valid name, phone number, email, and message.' });
    }

    const rawKey = req.get('Idempotency-Key');
    if (rawKey && (rawKey.length > 120 || !/^[\w.-]+$/.test(rawKey))) {
      return res.status(400).json({ error: 'Invalid submission reference. Please retry the form.' });
    }

    try {
      const enquiry = this.enquiries.create({
        id: crypto.randomUUID(),
        idempotencyKey: rawKey || null,
        source,
        name,
        phone,
        email: email || null,
        message,
        city: city || null,
        state: state || null,
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json({
        id: enquiry.id,
        status: enquiry.status,
        message: 'Your enquiry has been received. Our team will review it and follow up using the details you provided.',
      });
    } catch {
      // Do not echo submitted values or database details to the public client.
      return res.status(503).json({ error: 'We could not save your enquiry right now. Please try again shortly.' });
    }
  };
}
