import React, { useState, useEffect } from 'react';
import { api, API_BASE } from '../api/client';
import {
  CodeIcon,
  CopyIcon,
  CheckCircleIcon,
  DownloadIcon,
  ShieldIcon,
  LockIcon,
  SearchIcon,
  SlidersIcon,
  PrinterIcon,
  RotateCwIcon,
  ArrowRightIcon,
  CheckIcon,
} from '../components/icons';

type DevTab = 'explorer' | 'keys' | 'webhooks' | 'snippets' | 'edge_diagnostics' | 'openapi';

interface ApiEndpointDef {
  id: string;
  domain: 'Customer Portal' | 'Merchant POS' | 'Edge Spooler' | 'Webhooks';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  headers: Record<string, string>;
  defaultBody?: any;
}

const API_ENDPOINTS: ApiEndpointDef[] = [
  {
    id: 'quote',
    domain: 'Customer Portal',
    method: 'POST',
    path: '/portal/quote',
    summary: 'Deterministic Quote Calculation (Integer Paise)',
    description: 'POST /portal/quote accepts shopId and files with fileName, pageCount, and print options. It does not upload or store a file. For an order, first upload the file, then quote it, and submit using the returned storageKey and exact quote response.',
    headers: { 'Content-Type': 'application/json' },
    defaultBody: {
      shopId: 'shop-campus-1',
      files: [
        {
          fileName: 'Final_Year_Project_Report.pdf',
          pageCount: 18,
          options: {
            colorMode: 'bw',
            duplexMode: 'duplex_auto',
            copies: 2,
            paperSize: 'A4',
            orientation: 'portrait',
            pageRange: 'all',
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
        },
      ],
    },
  },
  {
    id: 'upload_document',
    domain: 'Customer Portal',
    method: 'POST',
    path: '/portal/upload',
    summary: 'Upload a Private Customer Document',
    description: 'Upload accepts shopId, fileName, and Base64 fileData for a valid PDF, JPEG, or PNG. Replace the sample fileData with the actual document bytes encoded as Base64; use the returned storageKey and pageCount in the quote/order flow. This endpoint is documentation-only in this explorer.',
    headers: { 'Content-Type': 'application/json' },
    defaultBody: {
      shopId: 'shop-campus-1',
      fileName: 'Project_Report_v2.pdf',
      fileData: '<base64-encoded PDF bytes>',
    },
  },
  {
    id: 'submit_order',
    domain: 'Customer Portal',
    method: 'POST',
    path: '/portal/orders',
    summary: 'Submit Customer Print Order',
    description: 'Submit only after POST /portal/upload returns a storageKey and POST /portal/quote returns the current exact quote. Use the same shopId, file options, and storageKey. Replace the quote sample with the exact quote response so the server can reject stale pricing; paymentMethod must be CASH_ON_COLLECTION or ONLINE_RAZORPAY.',
    headers: { 'Content-Type': 'application/json' },
    defaultBody: {
      shopId: 'shop-campus-1',
      customerName: 'Aarav Sharma',
      customerPhone: '+91 98765 43210',
      paymentMethod: 'CASH_ON_COLLECTION',
      quote: {
        quoteId: '<quote.quoteId>',
        shopId: 'shop-campus-1',
        currency: 'INR',
        quoteVersion: '<quote.quoteVersion>',
        totalPaise: 1200,
        expiresAt: '<quote.expiresAt>',
      },
      files: [
        {
          fileName: 'Project_Report_v2.pdf',
          pageCount: 12,
          storageKey: '<storageKey returned by POST /portal/upload>',
          options: {
            colorMode: 'bw',
            duplexMode: 'duplex_auto',
            copies: 1,
            paperSize: 'A4',
            orientation: 'portrait',
            pageRange: 'all',
            fitMode: 'fit',
            pagesPerSheet: 1,
            collation: true,
          },
        },
      ],
    },
  },
  {
    id: 'get_shop',
    domain: 'Customer Portal',
    method: 'GET',
    path: '/portal/shop/campus1',
    summary: 'Fetch Shop Metadata & Online Capabilities',
    description: 'Retrieves the public shop profile, configured rates, portal options, and whether online payment is configured for customer QR intake.',
    headers: {},
  },
  {
    id: 'merchant_orders',
    domain: 'Merchant POS',
    method: 'GET',
    path: '/merchant/orders?status=AWAITING_REVIEW',
    summary: 'List Inbound Merchant Orders Queue',
    description: 'Requires a merchant bearer token with orders:view. Lists orders awaiting merchant review; PENDING is a payment state, not an order status. The legacy array response is capped at the 100 latest matches.',
    headers: { Authorization: 'Bearer <authorized-token>' },
  },
  {
    id: 'dispatch_print',
    domain: 'Merchant POS',
    method: 'POST',
    path: '/merchant/orders/{orderId}/print',
    summary: 'Queue Print Jobs for a Connected Agent',
    description: 'Requires live_print:manage and an online printer registered to this shop. The response means jobs were queued for the paired agent; it does not prove physical output or successful printing. Confirm output through the operator reconciliation flow. Physical printing is disabled in the current pilot agent.',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer <authorized-token>',
    },
    defaultBody: {
      printerId: '<online printer id returned by GET /merchant/printers>',
    },
  },
  {
    id: 'edge_health',
    domain: 'Edge Spooler',
    method: 'GET',
    path: 'http://localhost:8765/health',
    summary: 'Probe Local Windows Print Agent Daemon',
    description: 'Direct loopback probe to the native Inklly background agent running on the merchant counter PC.',
    headers: {},
  },
  {
    id: 'test_webhook',
    domain: 'Webhooks',
    method: 'POST',
    path: '/developer/test-webhook',
    summary: 'Preview Synthetic Webhook Payload',
    description: 'Creates an unsigned local preview only. No webhook request is sent and no delivery signature is generated.',
    headers: { 'Content-Type': 'application/json' },
    defaultBody: { eventType: 'order.status_changed' },
  },
];

export interface DeveloperPortalProps {
  onNavigate?: (path: string) => void;
}

export const DeveloperPortalView: React.FC<DeveloperPortalProps> = ({ onNavigate }) => {
  const externalApiAccessEnabled = import.meta.env.VITE_ENABLE_EXTERNAL_API_ACCESS === 'true';
  const [activeTab, setActiveTab] = useState<DevTab>('explorer');
  const [isPingingIntegrations, setIsPingingIntegrations] = useState<boolean>(false);
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['order.created', 'order.status_changed', 'payment.succeeded']);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [generatedWebhookSecret, setGeneratedWebhookSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Integrations Matrix State
  // API Explorer State
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpointDef>(API_ENDPOINTS[0]);
  const [requestHeadersInput, setRequestHeadersInput] = useState<string>('');
  const [requestBodyInput, setRequestBodyInput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<{
    status: number;
    statusText: string;
    timeMs: number;
    headers: Record<string, string>;
    body: any;
  } | null>(null);
  const canExecuteSelectedEndpoint = ['quote', 'get_shop', 'merchant_orders', 'test_webhook'].includes(selectedEndpoint.id);

  // Key Generation State
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState<'TEST' | 'LIVE'>('TEST');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'orders:read',
    'orders:write',
    'printers:read',
  ]);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  // Webhook Simulator State
  const [selectedWebhookEvent, setSelectedWebhookEvent] = useState('order.created');
  const [webhookPayloadJson, setWebhookPayloadJson] = useState(
    JSON.stringify(
      {
        eventId: 'evt_20261025_00918',
        eventType: 'order.created',
        timestamp: new Date().toISOString(),
        data: {
          orderId: 'ord_example',
          orderNumber: 'INK-20261029-EXAMPLE',
          shopId: 'shop-campus-1',
          status: 'AWAITING_REVIEW',
          totalAmountPaise: 1200,
          currency: 'INR',
          createdAt: new Date().toISOString(),
        },
      },
      null,
      2
    )
  );
  const [webhookHistory, setWebhookHistory] = useState<any[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState('');

  // Code Snippets State
  const [snippetLanguage, setSnippetLanguage] = useState<'curl' | 'node' | 'python' | 'dotnet'>('curl');

  // Edge Diagnostics State
  const [isProbingAgent, setIsProbingAgent] = useState<boolean>(false);
  const [edgeProbeResult, setEdgeProbeResult] = useState<{
    status: 'ONLINE' | 'OFFLINE';
    port: number;
    version: string;
    latencyMs: number;
    printers: string[];
    localQueueDepth: number | null;
  } | null>(null);

  useEffect(() => {
    loadDevData();
  }, []);

  useEffect(() => {
    if (selectedEndpoint) {
      setRequestHeadersInput(JSON.stringify(selectedEndpoint.headers, null, 2));
      setRequestBodyInput(
        selectedEndpoint.defaultBody ? JSON.stringify(selectedEndpoint.defaultBody, null, 2) : ''
      );
      setExecutionResult(null);
    }
  }, [selectedEndpoint]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  const loadDevData = async () => {
    try {
      setLoading(true);
      const [spec, kList, wList] = await Promise.all([
        api.getOpenApiSpec().catch(() => null),
        api.getApiKeys().catch(() => []),
        api.getWebhooks().catch(() => []),
      ]);
      setOpenApiSpec(spec);
      setKeys(Array.isArray(kList) ? kList : []);
      const subscriptions = Array.isArray(wList) ? wList : [];
      setWebhooks(subscriptions);
      const firstSubscriptionId = subscriptions[0]?.id || '';
      setSelectedWebhookId(firstSubscriptionId);
      if (firstSubscriptionId) {
        const history = await api.getWebhookDeliveries(firstSubscriptionId).catch(() => []);
        setWebhookHistory(Array.isArray(history) ? history : []);
      } else {
        setWebhookHistory([]);
      }
    } catch (err: any) {
      console.warn('Developer Portal data fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  // API Explorer Execute
  const handleExecuteRequest = async () => {
    setIsExecuting(true);
    const start = performance.now();
    try {
      let parsedBody: any = undefined;
      if (requestBodyInput.trim()) {
        try {
          parsedBody = JSON.parse(requestBodyInput);
        } catch (e) {
          triggerToast('Invalid JSON in request body');
          setIsExecuting(false);
          return;
        }
      }

      if (selectedEndpoint.id === 'quote') {
        const res = await api.getQuote(parsedBody || selectedEndpoint.defaultBody);
        const timeMs = Math.round(performance.now() - start);
        setExecutionResult({
          status: 200,
          statusText: 'OK',
          timeMs,
          headers: { 'Content-Type': 'application/json', 'X-Inklly-Engine': 'IntegerPaise-v1' },
          body: res,
        });
      } else if (selectedEndpoint.id === 'submit_order') {
        const res = await api.submitOrder(parsedBody || selectedEndpoint.defaultBody);
        const timeMs = Math.round(performance.now() - start);
        setExecutionResult({
          status: 201,
          statusText: 'Created',
          timeMs,
          headers: { 'Content-Type': 'application/json', 'X-Inklly-Order-Id': res.order?.id || 'ord-new' },
          body: res,
        });
      } else if (selectedEndpoint.id === 'get_shop') {
        const res = await api.getShop('campus1');
        const timeMs = Math.round(performance.now() - start);
        setExecutionResult({
          status: 200,
          statusText: 'OK',
          timeMs,
          headers: { 'Content-Type': 'application/json' },
          body: res,
        });
      } else if (selectedEndpoint.id === 'merchant_orders') {
        const res = await api.getOrders('AWAITING_REVIEW');
        const timeMs = Math.round(performance.now() - start);
        setExecutionResult({
          status: 200,
          statusText: 'OK',
          timeMs,
          headers: { 'Content-Type': 'application/json' },
          body: res,
        });
      } else if (selectedEndpoint.id === 'test_webhook') {
        const res = await api.testWebhook(parsedBody?.eventType || 'order.status_changed');
        const timeMs = Math.round(performance.now() - start);
        setExecutionResult({
          status: 200,
          statusText: 'Preview only',
          timeMs,
          headers: { 'Content-Type': 'application/json' },
          body: res,
        });
      } else {
        throw new Error('This endpoint is documented but is not executable from this explorer.');
      }
      triggerToast(`Request completed in ${Math.round(performance.now() - start)}ms (HTTP 200)`);
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - start);
      setExecutionResult({
        status: 500,
        statusText: 'Internal Error',
        timeMs,
        headers: { 'Content-Type': 'application/json' },
        body: { error: err.message || 'Execution error' },
      });
      triggerToast(`Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // API Key Create
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      triggerToast('Please provide a key name');
      return;
    }

    try {
      const res = await api.createApiKey({
        keyName: newKeyName,
        environment: newKeyEnv,
        scopes: selectedScopes,
      });

      if (typeof res.apiKeySecret !== 'string' || !res.apiKeySecret) {
        throw new Error(res.error || 'The server did not issue an API key.');
      }
      const newSecret = res.apiKeySecret;

      if (!res.key) throw new Error('The server issued a secret without returning its key record. Refresh and inspect the key list.');
      const newKeyItem = res.key;

      setGeneratedSecret(newSecret);
      setShowKeyModal(true);
      setKeys((prev) => [newKeyItem, ...prev]);
      setNewKeyName('');
      triggerToast('API Key generated successfully! Store your token safely.');
    } catch (err: any) {
      triggerToast(`Failed to create key: ${err.message}`);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await api.revokeApiKey(keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
      triggerToast(`API Key ${keyId} revoked successfully`);
    } catch (err: any) {
      triggerToast(`Revocation failed: ${err.message}`);
    }
  };

  // Webhook Dispatch Simulator
  const handleDispatchWebhook = async () => {
    try {
      const result = await api.testWebhook(selectedWebhookEvent);
      const payload = result.payload || result;
      setWebhookPayloadJson(JSON.stringify(payload, null, 2));
      triggerToast('Synthetic payload preview created. Nothing was sent or signed.');
    } catch (err: any) {
      triggerToast(`Dispatch failed: ${err.message}`);
    }
  };

  const handleCreateWebhook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newWebhookUrl.trim() || newWebhookEvents.length === 0) {
      triggerToast('Enter an HTTPS destination and select at least one event.');
      return;
    }
    setCreatingWebhook(true);
    try {
      const created = await api.createWebhook(newWebhookUrl.trim(), newWebhookEvents);
      const { webhookSecret, ...subscription } = created;
      setWebhooks((current) => [subscription, ...current]);
      setSelectedWebhookId(subscription.id);
      setWebhookHistory([]);
      setGeneratedWebhookSecret(webhookSecret);
      setNewWebhookUrl('');
      triggerToast('Webhook destination registered. Copy its signing secret now.');
    } catch (error: any) {
      triggerToast(error.message || 'Could not create webhook destination');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleRotateWebhookSecret = async () => {
    if (!selectedWebhookId) return;
    try {
      const result = await api.rotateWebhookSecret(selectedWebhookId);
      setGeneratedWebhookSecret(result.webhookSecret);
      triggerToast('Webhook signing secret rotated. Store the new secret now.');
    } catch (error: any) {
      triggerToast(error.message || 'Could not rotate webhook secret');
    }
  };

  const handleRevokeWebhook = async () => {
    if (!selectedWebhookId || !window.confirm('Revoke this webhook destination? Pending deliveries will be cancelled.')) return;
    try {
      await api.revokeWebhook(selectedWebhookId);
      setWebhooks((current) => current.map((hook) => hook.id === selectedWebhookId ? { ...hook, isActive: false } : hook));
      const history = await api.getWebhookDeliveries(selectedWebhookId).catch(() => []);
      setWebhookHistory(Array.isArray(history) ? history : []);
      triggerToast('Webhook destination revoked.');
    } catch (error: any) {
      triggerToast(error.message || 'Could not revoke webhook destination');
    }
  };

  // Edge Spooler Probe
  const handleProbeEdgeAgent = async () => {
    setIsProbingAgent(true);
    const start = performance.now();
    try {
      const probeRes = await fetch('http://localhost:8765/health', { method: 'GET' })
        .then((r) => r.json())
        .catch(() => null);

      const latencyMs = Math.round(performance.now() - start);

      if (probeRes && probeRes.status === 'OK') {
        setEdgeProbeResult({
          status: 'ONLINE',
          port: 8765,
          version: probeRes.version || 'v1.0.0',
          latencyMs,
          printers: Array.isArray(probeRes.printers) ? probeRes.printers : [],
          localQueueDepth: Number.isInteger(probeRes.queueDepth) ? probeRes.queueDepth : null,
        });
        triggerToast(`Local Edge Spooler detected on Port 8765 (${latencyMs}ms latency)`);
      } else {
        setEdgeProbeResult({
          status: 'OFFLINE',
          port: 8765,
          version: 'Unavailable',
          latencyMs,
          printers: [],
          localQueueDepth: 0,
        });
        triggerToast('No print agent responded on this device.');
      }
    } finally {
      setIsProbingAgent(false);
    }
  };

  const handlePingAllIntegrations = async () => {
    setIsPingingIntegrations(true);
    const started = performance.now();
    try {
      await api.getOpenApiSpec();
      triggerToast(`API catalogue reachable (${Math.round(performance.now() - started)} ms). Provider health was not checked.`);
    } catch (err: any) {
      triggerToast(`API catalogue check failed: ${err.message}`);
    } finally {
      setIsPingingIntegrations(false);
    }
  };

  // Download OpenAPI Spec JSON
  const handleDownloadOpenApi = () => {
    if (!openApiSpec) {
      triggerToast('OpenAPI contract is unavailable. Check the API connection and retry.');
      return;
    }
    const spec = openApiSpec;

    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Inklly-OpenAPI-v1.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Inklly-OpenAPI-v1.json downloaded successfully!');
  };

  // Code Snippet Generator
  const getCodeSnippet = () => {
    const endpoint = selectedEndpoint;
    const baseUrl = API_BASE.replace(/\/$/, '');
    const bodyStr = endpoint.defaultBody ? JSON.stringify(endpoint.defaultBody, null, 2) : '';

    if (snippetLanguage === 'curl') {
      return `# Inklly cURL Command - ${endpoint.summary}
curl -X ${endpoint.method} "${baseUrl}${endpoint.path}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ink_live_your_api_key_here" ${
    bodyStr ? `\\\n  -d '${JSON.stringify(endpoint.defaultBody)}'` : ''
  }`;
    }

    if (snippetLanguage === 'node') {
      return `// Node.js / TypeScript (Native Fetch)
import fetch from 'node-fetch';

async function executeInkllyRequest() {
  const url = '${baseUrl}${endpoint.path}';
  const response = await fetch(url, {
    method: '${endpoint.method}',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.INKLLY_API_KEY,
    },
    ${bodyStr ? `body: JSON.stringify(${bodyStr}),` : ''}
  });

  const data = await response.json();
  console.log('Inklly API Result:', data);
}

executeInkllyRequest();`;
    }

    if (snippetLanguage === 'python') {
      return `# Python (requests library)
import os
import requests

url = "${baseUrl}${endpoint.path}"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.getenv('INKLLY_API_KEY')}"
}
${bodyStr ? `payload = ${bodyStr.replace(/true/g, 'True').replace(/false/g, 'False')}\nresponse = requests.${endpoint.method.toLowerCase()}(url, json=payload, headers=headers)` : `response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)`}

print(f"Status: {response.status_code}")
print(response.json())`;
    }

    if (snippetLanguage === 'dotnet') {
      return `// C# .NET HttpClient
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer " + Environment.GetEnvironmentVariable("INKLLY_API_KEY"));

        var url = "${baseUrl}${endpoint.path}";
        ${
          bodyStr
            ? `var json = @"${bodyStr.replace(/"/g, '""')}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var res = await client.${endpoint.method === 'POST' ? 'PostAsync(url, content)' : 'GetAsync(url)'};`
            : `var res = await client.GetAsync(url);`
        }

        var responseBody = await res.Content.ReadAsStringAsync();
        Console.WriteLine($"Inklly Response: {responseBody}");
    }
}`;
    }

    return '';
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`${label} copied to clipboard!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircleIcon size={16} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4D64E6] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-[#4D64E6]/25 shrink-0">
            <CodeIcon size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Developer & Integration Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-[#4D64E6] border border-indigo-200 dark:border-indigo-800">
                OpenAPI 3.0.3 · {API_BASE}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Internal API catalogue, read-only local-agent diagnostics, and gated external integration tools.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadOpenApi}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <DownloadIcon size={15} />
            <span>OpenAPI Spec (JSON)</span>
          </button>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${openApiSpec ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600'}`}>
            <span className={`w-2 h-2 rounded-full ${openApiSpec ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            <span>{loading ? 'Checking API contract…' : openApiSpec ? 'API contract loaded' : 'API contract unavailable'}</span>
          </div>
        </div>
      </div>

      {/* Environment & Gateway Selector Controls */}
      <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400">Configured API target:</span>
          <code className="font-mono text-slate-700 dark:text-slate-300">{API_BASE}</code>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePingAllIntegrations}
            disabled={isPingingIntegrations}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-bold cursor-pointer transition-all shadow-xs"
          >
            <RotateCwIcon size={12} className={isPingingIntegrations ? 'animate-spin' : ''} />
            <span>Check API Catalogue</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none gap-2">
        {[
          { id: 'explorer', label: 'API Explorer & Try-It-Out', icon: <CodeIcon size={16} /> },
          { id: 'keys', label: externalApiAccessEnabled ? 'Scoped API Keys' : 'API Keys · approval required', icon: <LockIcon size={16} /> },
          { id: 'webhooks', label: externalApiAccessEnabled ? 'Webhook Tools' : 'Webhooks · approval required', icon: <SlidersIcon size={16} /> },
          { id: 'snippets', label: 'SDK Code Snippets', icon: <CopyIcon size={16} /> },
          { id: 'edge_diagnostics', label: 'Edge Spooler Daemon (:8765)', icon: <PrinterIcon size={16} /> },
          { id: 'openapi', label: 'OpenAPI Contract Tree', icon: <ShieldIcon size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as DevTab)}
            disabled={!externalApiAccessEnabled && ['keys', 'webhooks'].includes(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-bold text-xs whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#4D64E6] text-[#4D64E6] bg-indigo-50/50 dark:bg-indigo-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: INTERACTIVE API EXPLORER ("TRY IT OUT")
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'explorer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Endpoints Catalog (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                API Endpoint Catalog
              </h2>
              <div className="space-y-2">
                {API_ENDPOINTS.map((ep) => {
            const isSelected = selectedEndpoint.id === ep.id;
                  const methodColor =
                    ep.method === 'POST'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      : ep.method === 'GET'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400';

                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => setSelectedEndpoint(ep)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'border-[#4D64E6] bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs'
                          : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${methodColor}`}>
                            {ep.method}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {ep.path}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{ep.domain}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {ep.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Try-It-Out Console (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black ${
                        selectedEndpoint.method === 'POST'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedEndpoint.method}
                    </span>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {selectedEndpoint.summary}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{selectedEndpoint.description}</p>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteRequest}
                  disabled={isExecuting || !canExecuteSelectedEndpoint}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer disabled:opacity-50"
                >
                  {isExecuting ? <RotateCwIcon size={14} className="animate-spin" /> : <ArrowRightIcon size={14} />}
                  <span>{canExecuteSelectedEndpoint ? 'Execute Request' : 'Not executable here'}</span>
                </button>
              </div>
              {!canExecuteSelectedEndpoint && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="status">
                  This endpoint is documentation only in the current portal. No request will be simulated or sent.
                </p>
              )}

              {/* Endpoint URL Bar */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono text-xs">
                <span className="font-bold text-[#4D64E6] shrink-0">{selectedEndpoint.method}</span>
                <span className="text-slate-400 shrink-0">{API_BASE}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEndpoint.path}</span>
              </div>

              {/* Request Headers Editor */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Request Headers (JSON)
                </label>
                <textarea
                  rows={2}
                  value={requestHeadersInput}
                  onChange={(e) => setRequestHeadersInput(e.target.value)}
                  className="w-full font-mono text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-[#4D64E6]"
                />
              </div>

              {/* Request Body Editor (if POST/PATCH) */}
              {selectedEndpoint.method !== 'GET' && (
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                    Request Payload Body (JSON)
                  </label>
                  <textarea
                    rows={6}
                    value={requestBodyInput}
                    onChange={(e) => setRequestBodyInput(e.target.value)}
                    className="w-full font-mono text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-[#4D64E6]"
                  />
                </div>
              )}

              {/* Response Console */}
              {executionResult && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-4">
                  <div className="bg-slate-800 text-white p-3 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold ${
                          executionResult.status < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        HTTP {executionResult.status} {executionResult.statusText}
                      </span>
                      <span className="text-slate-400">{executionResult.timeMs} ms</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(executionResult.body, null, 2), 'Response JSON')}
                      className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <CopyIcon size={13} />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 text-slate-100 font-mono text-[11px] max-h-60 overflow-y-auto overflow-x-auto leading-relaxed">
                    {JSON.stringify(executionResult.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: SCOPED API KEY MANAGER
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Generate Key Form (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Generate Scoped API Key
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Create cryptographically secure tokens bound to least-privilege scopes for external POS or ERP billing.
              </p>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Key Name / Integration Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Campus POS Terminal 1"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Environment Context
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv('TEST')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      newKeyEnv === 'TEST'
                        ? 'border-[#4D64E6] bg-indigo-50 dark:bg-indigo-950 text-[#4D64E6]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Sandbox / Test (ink_test_...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKeyEnv('LIVE')}
                    className={`py-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      newKeyEnv === 'LIVE'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950 text-emerald-700'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Production (ink_live_...)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Authorized Resource Scopes
                </label>
                <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {[
                    { id: 'orders:read', label: 'orders:read (List & inspect print orders)' },
                    { id: 'orders:write', label: 'orders:write (Create & modify order statuses)' },
                    { id: 'printers:read', label: 'printers:read (Inspect OEM printer queues)' },
                    { id: 'printers:spool', label: 'printers:spool (Dispatch raw PDF/SPL jobs)' },
                    { id: 'ledger:read', label: 'ledger:read (Audit immutable financial entries)' },
                    { id: 'webhooks:manage', label: 'webhooks:manage (Register & test hooks)' },
                  ].map((scope) => {
                    const isChecked = selectedScopes.includes(scope.id);
                    return (
                      <label key={scope.id} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedScopes([...selectedScopes, scope.id]);
                            } else {
                              setSelectedScopes(selectedScopes.filter((s) => s !== scope.id));
                            }
                          }}
                          className="rounded text-[#4D64E6]"
                        />
                        <span className="font-mono text-slate-700 dark:text-slate-300">{scope.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer"
              >
                Generate Scoped Key
              </button>
            </form>
          </div>

          {/* Right Column: Active Keys Table (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Active API Credentials ({keys.length})
                </h3>
                <p className="text-xs text-slate-400">Tokens hashed with SHA-256 server-side</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Least-Privilege Enforced</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {keys.length === 0 && (
                <p className="p-5 text-xs text-slate-500" role="status">No API key records are available in this environment.</p>
              )}
              {keys.map((k) => (
                <div key={k.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{k.keyName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          k.environment === 'LIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {k.environment}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-[#4D64E6] font-semibold">{k.keyPrefix}••••••••</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {k.scopes?.map((sc: string) => (
                        <span key={sc} className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-mono">
                          {sc}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRevokeKey(k.id)}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generated Secret One-Time Reveal Modal */}
      {showKeyModal && generatedSecret && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldIcon size={24} />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Store Your API Key Securely
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              For security, this secret token will <strong>never be shown again</strong>. Store it in your environment variables or password vault immediately.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all flex justify-between items-center gap-2">
              <span>{generatedSecret}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(generatedSecret, 'API Secret')}
                className="text-[#4D64E6] hover:text-indigo-600 p-1 cursor-pointer"
              >
                <CopyIcon size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowKeyModal(false);
                setGeneratedSecret(null);
              }}
              className="w-full py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              I have stored this token safely
            </button>
          </div>
        </div>
      )}

      {generatedWebhookSecret && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldIcon size={24} />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Save your webhook signing secret</h3>
            </div>
            <p className="text-xs text-slate-500">This secret is shown once. Store it securely and use it to verify each `X-Inklly-Signature` header.</p>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all select-all flex justify-between items-center gap-2">
              <span>{generatedWebhookSecret}</span>
              <button type="button" aria-label="Copy webhook secret" onClick={() => copyToClipboard(generatedWebhookSecret, 'Webhook secret')} className="text-[#4D64E6] p-1">
                <CopyIcon size={16} />
              </button>
            </div>
            <button type="button" onClick={() => setGeneratedWebhookSecret(null)} className="w-full py-2.5 bg-[#4D64E6] text-white font-bold text-xs rounded-xl">
              I stored this secret
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3: WEBHOOK SIMULATOR & HMAC SIGNATURE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'webhooks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateWebhook} className="lg:col-span-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Register a webhook destination</h2>
              <p className="text-xs text-slate-500 mt-1">Inklly sends signed event envelopes to HTTPS destinations with public DNS addresses. The signing secret is shown once.</p>
            </div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Destination URL
              <input
                type="url"
                value={newWebhookUrl}
                onChange={(event) => setNewWebhookUrl(event.target.value)}
                placeholder="https://your-domain.com/inklly/webhooks"
                required
                maxLength={2048}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">Events</legend>
              <div className="flex flex-wrap gap-3">
                {['order.created', 'order.status_changed', 'payment.succeeded'].map((eventType) => (
                  <label key={eventType} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={newWebhookEvents.includes(eventType)}
                      onChange={(event) => setNewWebhookEvents((current) => event.target.checked
                        ? (current.includes(eventType) ? current : [...current, eventType])
                        : current.filter((value) => value !== eventType))}
                    />
                    <span>{eventType}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" disabled={creatingWebhook || !externalApiAccessEnabled} className="rounded-xl bg-[#4D64E6] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {creatingWebhook ? 'Registering…' : 'Register Destination'}
            </button>
            {!externalApiAccessEnabled && <p className="text-xs text-amber-700">Developer webhook access is disabled for this deployment.</p>}
          </form>

          {/* Left Column: Dispatch Simulator (6 cols) */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Webhook Event Dispatch Simulator
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Preview a synthetic event payload. This tool does not contact a destination or create a signature.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Event Type
                  </label>
                  <select
                    value={selectedWebhookEvent}
                    onChange={(e) => {
                      const eventType = e.target.value;
                      setSelectedWebhookEvent(eventType);
                      setWebhookPayloadJson(
                        JSON.stringify(
                          {
                            eventId: `evt_${Date.now()}`,
                            eventType,
                            timestamp: new Date().toISOString(),
                            data: eventType === 'order.created'
                              ? {
                                orderId: 'ord_example', orderNumber: 'INK-20261029-EXAMPLE', shopId: 'shop-campus-1',
                                status: 'AWAITING_REVIEW', totalAmountPaise: 1200, currency: 'INR', createdAt: new Date().toISOString(),
                              }
                              : eventType === 'order.status_changed'
                                ? {
                                  orderId: 'ord_example', orderNumber: 'INK-20261029-EXAMPLE', shopId: 'shop-campus-1',
                                  previousStatus: 'IN_PROGRESS', status: 'READY_FOR_COLLECTION', updatedAt: new Date().toISOString(),
                                }
                                : {
                                  paymentId: 'pay_example', orderId: 'ord_example', amountPaise: 1200,
                                  currency: 'INR', provider: 'MANUAL_CASH', capturedAt: new Date().toISOString(),
                                },
                          },
                          null,
                          2
                        )
                      );
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="order.created">order.created</option>
                    <option value="order.status_changed">order.status_changed</option>
                    <option value="payment.succeeded">payment.succeeded</option>
                  </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Payload JSON Preview
                </label>
                <textarea
                  rows={6}
                  value={webhookPayloadJson}
                  readOnly
                  className="w-full font-mono text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <button
                type="button"
                onClick={handleDispatchWebhook}
                className="w-full py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowRightIcon size={14} />
                <span>Generate Synthetic Preview</span>
              </button>
            </div>
          </div>

          {/* Right Column: Durable Webhook Delivery History (6 cols) */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Delivery History
                </h3>
                <p className="text-xs text-slate-400">Persisted signed delivery attempts for this destination.</p>
              </div>
              <div className="flex items-center gap-2">
              <select
                value={selectedWebhookId}
                onChange={async (event) => {
                  const id = event.target.value;
                  setSelectedWebhookId(id);
                  try {
                    const history = await api.getWebhookDeliveries(id);
                    setWebhookHistory(Array.isArray(history) ? history : []);
                  } catch (error: any) {
                    setWebhookHistory([]);
                    triggerToast(error.message || 'Could not load delivery history');
                  }
                }}
                aria-label="Webhook destination"
                className="max-w-48 text-[10px] rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800"
                disabled={webhooks.length === 0}
              >
                {webhooks.length === 0 ? <option value="">No destinations</option> : webhooks.map((hook) => <option key={hook.id} value={hook.id}>{hook.isActive ? '' : '[Revoked] '}{hook.targetUrl}</option>)}
              </select>
              <button
                type="button"
                disabled={!selectedWebhookId}
                onClick={async () => {
                  try {
                    const history = await api.getWebhookDeliveries(selectedWebhookId);
                    setWebhookHistory(Array.isArray(history) ? history : []);
                  } catch (error: any) { triggerToast(error.message || 'Could not refresh delivery history'); }
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >Refresh</button>
              <button type="button" disabled={!webhooks.find((hook) => hook.id === selectedWebhookId)?.isActive} onClick={() => void handleRotateWebhookSecret()} className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-slate-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">Rotate</button>
              <button type="button" disabled={!webhooks.find((hook) => hook.id === selectedWebhookId)?.isActive} onClick={() => void handleRevokeWebhook()} className="rounded-lg border border-rose-200 px-2.5 py-2 text-[10px] font-bold text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300">Revoke</button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {webhookHistory.length === 0 && (
                <p className="p-5 text-xs text-slate-500" role="status">No webhook deliveries have been recorded for this destination.</p>
              )}
              {webhookHistory.map((item) => (
                <div key={item.deliveryId} className="p-4 space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.eventType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {item.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {item.attemptCount} attempt{item.attemptCount === 1 ? '' : 's'}{item.lastStatusCode ? ` · HTTP ${item.lastStatusCode}` : ''}
                  </div>
                  {item.lastError && <div className="text-[10px] text-rose-600 break-words">{item.lastError}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 4: SDK CODE SNIPPETS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'snippets' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Multi-Language Integration Snippets
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-configured client code for {selectedEndpoint.summary}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['curl', 'node', 'python', 'dotnet'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSnippetLanguage(lang)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer uppercase ${
                    snippetLanguage === lang
                      ? 'bg-white dark:bg-slate-900 text-[#4D64E6] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {lang === 'node' ? 'TypeScript' : lang === 'dotnet' ? 'C# .NET' : lang}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => copyToClipboard(getCodeSnippet(), 'Code snippet')}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-sm"
            >
              <CopyIcon size={14} />
              <span>Copy Code</span>
            </button>
            <pre className="p-5 bg-slate-950 text-slate-100 font-mono text-xs rounded-2xl overflow-x-auto leading-relaxed">
              {getCodeSnippet()}
            </pre>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 5: EDGE SPOOLER DAEMON (:8765)
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'edge_diagnostics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Daemon Architecture</span>
              <div className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                Loopback HTTP :8765
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Receives authenticated print tickets and reports dispatch state. Physical printing is disabled in the current pilot.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Offline Resilience</span>
              <div className="text-base font-extrabold text-emerald-600 mt-1">
                Local SQLite Spooler
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Buffered at <code>C:\ProgramData\Inklly\agent_queue.db</code> during internet cuts.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
              <span className="text-[10px] font-black uppercase text-slate-400">Driver Compatibility</span>
              <div className="text-base font-extrabold text-indigo-600 mt-1">
                Hardware support status
              </div>
              <p className="text-xs text-slate-500 mt-1">
                No hardware-tested printer compatibility matrix is available yet.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Local Windows Edge Agent Diagnostic Probe
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct connection check to <code>http://localhost:8765/health</code>
                </p>
              </div>

              <button
                type="button"
                onClick={handleProbeEdgeAgent}
                disabled={isProbingAgent}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer disabled:opacity-50"
              >
                <RotateCwIcon size={14} className={isProbingAgent ? 'animate-spin' : ''} />
                <span>Test Local Daemon Connection</span>
              </button>
            </div>

            {edgeProbeResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">DAEMON STATUS</span>
                    <span className={`font-bold flex items-center gap-1.5 mt-0.5 ${edgeProbeResult.status === 'ONLINE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${edgeProbeResult.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {edgeProbeResult.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">LOOPBACK PORT</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      :{edgeProbeResult.port}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PROBE LATENCY</span>
                    <span className="font-bold text-indigo-600 mt-0.5 block">{edgeProbeResult.latencyMs} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">LOCAL QUEUE DEPTH</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {edgeProbeResult.localQueueDepth ?? 'Unknown'} jobs
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Detected Hardware Print Queues:
                  </h4>
                  <div className="space-y-2">
                    {edgeProbeResult.printers.length === 0 && (
                      <p className="text-xs text-slate-500" role="status">This health response did not include printer inventory.</p>
                    )}
                    {edgeProbeResult.printers.map((prn) => (
                      <div
                        key={prn}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <PrinterIcon size={16} className="text-[#4D64E6]" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{prn}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          Reported by the local agent
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PowerShell Script Snippet */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  PowerShell Diagnostic Command for Counter PC:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      'Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus',
                      'PowerShell command'
                    )
                  }
                  className="text-xs text-[#4D64E6] font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <CopyIcon size={12} />
                  <span>Copy PowerShell Command</span>
                </button>
              </div>
              <pre className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
                Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 6: OPENAPI CONTRACT TREE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'openapi' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                OpenAPI 3.0.3 Specification Contract
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Versioned machine-readable schema for client generation, CI validation, and Swagger UI
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadOpenApi}
              className="flex items-center gap-2 px-4 py-2 bg-[#4D64E6] hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#4D64E6]/25 cursor-pointer"
            >
              <DownloadIcon size={14} />
              <span>Download Inklly-OpenAPI-v1.json</span>
            </button>
          </div>

          <pre className="p-5 bg-slate-950 text-slate-100 font-mono text-xs rounded-2xl max-h-[500px] overflow-y-auto overflow-x-auto leading-relaxed">
            {openApiSpec ? JSON.stringify(openApiSpec, null, 2) : 'The live API contract is unavailable. Retry the API connection before downloading or using a generated schema.'}
          </pre>
        </div>
      )}
    </div>
  );
};
