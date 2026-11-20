/**
 * Per-route document metadata for the single-page app. Search engines that
 * execute JavaScript read these; `index.html` carries the home-page defaults.
 */
interface RouteMeta {
  title: string;
  description: string;
}

const SITE_NAME = 'Inklly';

const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'Inklly — QR ordering and one-click printing for print shops',
    description:
      "Customers scan your shop's QR code, upload and edit their documents, and pay from their phone. You pick the printer and press print. No app, no pen drives, no commission.",
  },
  '/print-shop-automation-software': {
    title: 'Print shop automation software — Inklly',
    description: 'Run your print counter from one queue: orders, prices, payments and printer routing in a single workspace.',
  },
  '/qr-code-printing-system': {
    title: 'QR code printing system for shops — Inklly',
    description: 'Give your shop a QR code that lets customers upload documents, choose print options and pay from their phone.',
  },
  '/whatsapp-printing-software': {
    title: 'WhatsApp printing for print shops — Inklly',
    description: 'How Inklly replaces WhatsApp file forwarding with a private, organised print queue.',
  },
  '/how-it-works': {
    title: 'How it works — Inklly',
    description: 'Scan, upload, pay, collect: the four steps from a customer’s phone to printed pages at your counter.',
  },
  '/pricing': {
    title: 'Pricing — Inklly',
    description: 'Flat monthly plans from ₹99. No per-page fee and no commission on your print sales.',
  },
  '/contact': {
    title: 'Contact — Inklly',
    description: 'Talk to the Inklly team about setting up QR ordering and printing at your shop.',
  },
  '/login': { title: 'Sign in — Inklly', description: 'Sign in to your Inklly shop workspace.' },
  '/register': { title: 'Set up your shop — Inklly', description: 'Create your Inklly shop, set your rates and get your counter QR code.' },
  '/shops': { title: 'Find a print shop near you — Inklly', description: 'See xerox and print shops near you on a map, then upload your files and pay from your phone.' },
};

/** Routes that are private workspaces or per-order pages and must not be indexed. */
const PRIVATE_PREFIXES = ['/merchant', '/dashboard', '/platform', '/admin', '/developer', '/track', '/accept-invitation', '/activate-owner'];

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function applyRouteMeta(path: string, isKnownRoute: boolean): void {
  const normalized = path.length > 1 ? path.replace(/\/$/, '') : path;
  const meta: RouteMeta =
    ROUTE_META[normalized] ??
    (normalized.startsWith('/legal')
      ? { title: `Legal — ${SITE_NAME}`, description: 'Inklly privacy policy, terms, refund policy and delivery policy.' }
      : normalized.startsWith('/p/') || normalized === '/customer'
        ? { title: `Order prints — ${SITE_NAME}`, description: 'Upload your documents, choose print options and pay from your phone.' }
        : { title: SITE_NAME, description: ROUTE_META['/'].description });

  document.title = isKnownRoute ? meta.title : `Page not found — ${SITE_NAME}`;
  setMeta('meta[name="description"]', 'name', 'description', meta.description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);

  const isPrivate = !isKnownRoute || PRIVATE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  setMeta('meta[name="robots"]', 'name', 'robots', isPrivate ? 'noindex, nofollow' : 'index, follow');

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}${normalized}`;
}
