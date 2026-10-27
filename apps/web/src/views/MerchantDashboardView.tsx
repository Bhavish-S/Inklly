import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { PrinterIcon, CheckCircleIcon, DollarSignIcon, UsersIcon, MessageSquareIcon, FileTextIcon } from '../components/icons';

export const MerchantDashboardView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'printers' | 'rates' | 'staff' | 'bot'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dashboard, setDashboard] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [rates, setRates] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [botTemplates, setBotTemplates] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const [dashData, ordersData, printersData, ratesData, staffData, botData] = await Promise.all([
        api.getDashboard(),
        api.getOrders(statusFilter),
        api.getPrinters(),
        api.getRates(),
        api.getStaff(),
        api.getBotTemplates(),
      ]);
      setDashboard(dashData);
      setOrders(ordersData);
      setPrinters(printersData);
      setRates(ratesData);
      setStaff(staffData);
      setBotTemplates(botData);
    } catch (err: any) {
      console.error('Failed to load merchant data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.getDashboard().then(setDashboard).catch(() => {});
      api.getOrders(statusFilter).then(setOrders).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  // Order Operations
  const handleDispatchPrint = async (orderId: string) => {
    try {
      await api.dispatchPrint(orderId);
      showNotification(`🚀 Print job dispatched to Edge Spooler for order #${orderId.slice(-6)}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCollectCash = async (orderId: string) => {
    try {
      await api.collectCash(orderId);
      showNotification(`💵 Cash collected at counter and recorded in ledger`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, nextStatus);
      showNotification(`Status updated to ${nextStatus}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading && !dashboard) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: '#667085' }}>
        Loading Merchant Workspace...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      {/* Top Bar / Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#182230' }}>Campus Print Express</h1>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#12B76A' }} />
              Desktop Agent Connected
            </span>
          </div>
          <p style={{ color: '#667085', fontSize: '0.875rem' }}>Counter POS • Station 1 • Pune</p>
        </div>

        {/* Global Action Message Toast */}
        {actionMessage && (
          <div style={{ backgroundColor: '#182230', color: '#FFFFFF', padding: '0.625rem 1.25rem', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {actionMessage}
          </div>
        )}
      </div>

      {/* KPI Metrics Dashboard Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ color: '#667085', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Orders Today</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#182230', marginTop: '0.25rem' }}>
            {dashboard?.metrics?.totalOrders || 0}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #F79009' }}>
          <div style={{ color: '#667085', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Awaiting Review</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#B54708', marginTop: '0.25rem' }}>
            {dashboard?.metrics?.pendingReview || 0}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #4A69ED' }}>
          <div style={{ color: '#667085', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Ready / Printing</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4A69ED', marginTop: '0.25rem' }}>
            {(dashboard?.metrics?.readyForPrint || 0) + (dashboard?.metrics?.inProgress || 0)}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #12B76A' }}>
          <div style={{ color: '#667085', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Ready for Pickup</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#027A48', marginTop: '0.25rem' }}>
            {dashboard?.metrics?.readyForPickup || 0}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ color: '#667085', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Revenue</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#182230', marginTop: '0.25rem' }}>
            ₹{((dashboard?.metrics?.totalRevenuePaise || 0) / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #E4E7EC', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {[
          { key: 'orders', label: 'Orders Queue', icon: FileTextIcon, badge: dashboard?.metrics?.pendingReview },
          { key: 'printers', label: 'Printers & Fleet', icon: PrinterIcon, badge: printers.length },
          { key: 'rates', label: 'Pricing & Rates', icon: DollarSignIcon },
          { key: 'staff', label: 'Staff & Roles', icon: UsersIcon, badge: staff.length },
          { key: 'bot', label: 'WhatsApp Bot Rules', icon: MessageSquareIcon },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === tab.key ? '#4A69ED' : '#667085',
              borderBottom: activeTab === tab.key ? '2px solid #4A69ED' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="badge badge-info" style={{ fontSize: '0.6875rem', padding: '0.125rem 0.375rem' }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Orders Queue */}
      {activeTab === 'orders' && (
        <div>
          {/* Status Filter Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {['ALL', 'AWAITING_REVIEW', 'READY_FOR_PRINT', 'IN_PROGRESS', 'READY_FOR_COLLECTION', 'COLLECTED', 'CANCELLED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Orders Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E4E7EC', color: '#667085', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '0.875rem 1rem' }}>Order</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Customer</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Files</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Amount</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Payment</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#98A2B3' }}>
                      No orders found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #F2F4F7' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); setSelectedOrder(o); }}
                          style={{ color: '#4A69ED' }}
                        >
                          #{o.orderNumber}
                        </a>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <div><strong>{o.customerName || 'Counter Guest'}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: '#667085' }}>{o.customerPhone || 'Walk-in'}</div>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        {o.files?.length || 1} file(s)
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>
                        ₹{(o.totalAmountPaise / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className={`badge ${o.paymentStatus === 'VERIFIED' ? 'badge-success' : 'badge-warning'}`}>
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span className="badge badge-info">{o.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          {/* 1-Click Print Dispatch Button */}
                          {(o.status === 'AWAITING_REVIEW' || o.status === 'READY_FOR_PRINT') && (
                            <button
                              onClick={() => handleDispatchPrint(o.id)}
                              className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                            >
                              <PrinterIcon size={14} />
                              Dispatch Print
                            </button>
                          )}

                          {/* Collect Cash Button */}
                          {o.paymentStatus !== 'VERIFIED' && (
                            <button
                              onClick={() => handleCollectCash(o.id)}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem', borderColor: '#12B76A', color: '#12B76A' }}
                            >
                              💵 Collect Cash
                            </button>
                          )}

                          {/* Move to Ready for Collection */}
                          {o.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleUpdateStatus(o.id, 'READY_FOR_COLLECTION')}
                              className="btn btn-success"
                              style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                            >
                              Ready for Pickup
                            </button>
                          )}

                          {/* Move to Collected */}
                          {o.status === 'READY_FOR_COLLECTION' && (
                            <button
                              onClick={() => handleUpdateStatus(o.id, 'COLLECTED')}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.375rem 0.625rem' }}
                            >
                              Mark Collected
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Printers & Fleet */}
      {activeTab === 'printers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {printers.map((p) => (
            <div key={p.id} className="card" style={{ borderLeft: p.isOnline ? '4px solid #12B76A' : '4px solid #D0D5DD' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{p.name}</h3>
                  <p style={{ color: '#667085', fontSize: '0.8125rem' }}>Driver: {p.systemDriverName}</p>
                </div>
                <span className={`badge ${p.isOnline ? 'badge-success' : 'badge-neutral'}`}>
                  {p.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span className="badge badge-info">{p.supportsColor ? 'Color Capable' : 'Monochrome Only'}</span>
                <span className="badge badge-info">{p.supportsDuplex ? 'Auto-Duplex' : 'Simplex Only'}</span>
                {p.isDefault && <span className="badge badge-success">Default Station Printer</span>}
              </div>

              <div>
                <strong style={{ fontSize: '0.75rem', color: '#667085', textTransform: 'uppercase' }}>Paper Trays Configured</strong>
                <ul style={{ listStyle: 'none', fontSize: '0.8125rem', marginTop: '0.375rem' }}>
                  {p.trays.map((t: any) => (
                    <li key={t.id} style={{ padding: '0.25rem 0', color: '#344054' }}>
                      📥 {t.name} — <span style={{ color: '#667085' }}>{t.supportedSizes.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Pricing & Rates */}
      {activeTab === 'rates' && rates && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Configured Rates (Per Printed Side)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {rates.rateRules.map((r: any) => (
                <div key={r.id} style={{ backgroundColor: '#F9FAFB', border: '1px solid #E4E7EC', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                    {r.paperSize} • {r.colorMode.toUpperCase()}
                  </div>
                  <div style={{ color: '#667085', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                    {r.duplexMode === 'simplex' ? 'Single-Sided' : 'Double-Sided Duplex'}
                  </div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#4A69ED' }}>
                    ₹{(r.pricePerPrintedSidePaise / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bulk Discount Tier */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Bulk Volume Discount</h3>
            <p style={{ color: '#667085', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Automatically applied to high-page print orders at checkout.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#ECFDF3', border: '1px solid #A6F4C5', padding: '1rem', borderRadius: '8px', color: '#027A48' }}>
              <CheckCircleIcon size={24} />
              <div>
                <strong>{rates.bulkDiscount?.discountPercentage}% Off Orders above ₹{((rates.bulkDiscount?.minOrderValuePaise || 10000) / 100).toFixed(0)}</strong>
                <p style={{ fontSize: '0.8125rem' }}>Encourages thesis, dissertation, and high-volume booklet printing.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Staff & Roles */}
      {activeTab === 'staff' && (
        <div className="card">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Shop Staff & Permissions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {staff.map((s) => (
              <div key={s.user.id} style={{ border: '1px solid #E4E7EC', borderRadius: '8px', padding: '1rem', backgroundColor: '#FFFFFF' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{s.user.fullName}</strong>
                    <div style={{ color: '#667085', fontSize: '0.8125rem' }}>{s.user.email}</div>
                  </div>
                  <span className="badge badge-info">{s.membership.role}</span>
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#667085' }}>
                  <strong>Permissions: </strong>{s.membership.permissions.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: WhatsApp Bot Automation */}
      {activeTab === 'bot' && (
        <div className="card">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>WhatsApp Customer Bot Notification Templates</h3>
          <p style={{ color: '#667085', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Automated messages dispatched via WhatsApp Business API as print orders change status.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {botTemplates.map((t) => (
              <div key={t.id} style={{ border: '1px solid #E4E7EC', borderRadius: '8px', padding: '1rem', backgroundColor: '#F9FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong>{t.templateKey}</strong>
                  <span className={`badge ${t.isEnabled ? 'badge-success' : 'badge-neutral'}`}>
                    {t.isEnabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>
                <textarea
                  className="input-field"
                  rows={2}
                  defaultValue={t.templateText}
                  style={{ backgroundColor: '#FFFFFF', resize: 'vertical' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Order #{selectedOrder.orderNumber}</h2>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Customer:</strong> {selectedOrder.customerName} ({selectedOrder.customerPhone})</div>
              <div><strong>Status:</strong> <span className="badge badge-info">{selectedOrder.status}</span></div>
              <div><strong>Payment:</strong> ₹{(selectedOrder.totalAmountPaise / 100).toFixed(2)} ({selectedOrder.paymentStatus})</div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Document Studio Print Configuration</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {selectedOrder.files?.map((f: any) => (
                <div key={f.id} style={{ backgroundColor: '#F9FAFB', border: '1px solid #E4E7EC', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8125rem' }}>
                  <strong>{f.fileName}</strong> ({f.pageCount} pages)
                  <div style={{ color: '#667085', marginTop: '0.25rem' }}>
                    {f.printOptions.paperSize} • {f.printOptions.colorMode.toUpperCase()} • {f.printOptions.duplexMode} • {f.printOptions.copies} copy(ies)
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => api.previewOrderFile(selectedOrder.id, f.id).catch((error) => alert(error.message))}>
                    Open private document preview
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { handleDispatchPrint(selectedOrder.id); setSelectedOrder(null); }}
                className="btn btn-primary"
              >
                <PrinterIcon size={16} />
                Dispatch to Spooler
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
