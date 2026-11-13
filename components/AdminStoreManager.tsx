import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Truck,
  Check,
  Copy,
  RefreshCw,
  Search,
  Tag,
  Plus,
  Trash2,
  MessageCircle,
  MapPin,
  DollarSign,
  Calendar,
  Save,
  ExternalLink,
  Clock,
  ShoppingBag
} from 'lucide-react';
import { OrderStatus, StoreCoupon, StoreOrder, StoreSettings } from '../types';
import {
  DEFAULT_STORE_SETTINGS,
  deleteStoreOrder,
  fetchStoreSettings,
  formatBRL,
  formatCep,
  formatCouponExpiry,
  formatCpf,
  isCouponExpired,
  ORDER_STATUS_LABELS,
  saveStoreSettings,
  subscribeAllStoreOrders,
  syncOrderPaymentStatus,
  updateStoreOrderFields
} from '../storeService';

export const AdminStoreManager: React.FC = () => {
  const [subTab, setSubTab] = useState<'orders' | 'shipping'>('orders');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [copiedLabelId, setCopiedLabelId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [carrierInputs, setCarrierInputs] = useState<Record<string, string>>({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  // Store Settings State
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [whatsappTestFeedback, setWhatsappTestFeedback] = useState<string | null>(null);
  const [waBotStatus, setWaBotStatus] = useState<{
    status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
    qrDataUrl: string | null;
    pairingCode: string | null;
    connectedPhone: string | null;
    lastError: string | null;
  }>({
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    lastError: null
  });
  const [loadingWaConnect, setLoadingWaConnect] = useState(false);

  // New Coupon Form
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState('10');
  const [newCouponMinVal, setNewCouponMinVal] = useState('0');
  const [newCouponExpiresAt, setNewCouponExpiresAt] = useState('');
  const [expandedCouponCode, setExpandedCouponCode] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreSettings().then(setSettings);
    fetch('/api/whatsapp/status')
      .then((r) => r.json())
      .then((st) => {
        if (st && st.status) setWaBotStatus(st);
      })
      .catch(() => {});
    const unsub = subscribeAllStoreOrders(
      (list) => {
        setOrders(list);
        setLoadingOrders(false);
      },
      () => {
        setLoadingOrders(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (subTab !== 'shipping') return;
    fetch('/api/whatsapp/status')
      .then((r) => r.json())
      .then((st) => {
        if (st && st.status) setWaBotStatus(st);
      })
      .catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/whatsapp/status')
        .then((r) => r.json())
        .then((st) => {
          if (st && st.status) setWaBotStatus(st);
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [subTab]);

  const stats = useMemo(() => {
    const approved = orders.filter(
      (o) =>
        o.paymentStatus === 'approved' ||
        ['paid', 'pre_order_reserved', 'preparing_shipment', 'shipped', 'delivered'].includes(o.orderStatus)
    );
    const totalRevenue = approved.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    const pendingShipment = approved.filter(
      (o) => !['shipped', 'delivered', 'cancelled'].includes(o.orderStatus)
    ).length;
    const preOrdersCount = approved.filter(
      (o) => o.orderStatus === 'pre_order_reserved'
    ).length;
    return {
      totalOrders: orders.length,
      approvedCount: approved.length,
      totalRevenue,
      pendingShipment,
      preOrdersCount
    };
  }, [orders]);

  const couponUsageMap = useMemo(() => {
    const map: Record<
      string,
      {
        totalPurchases: number;
        paidPurchases: number;
        totalRevenue: number;
        totalDiscountGiven: number;
        ordersList: StoreOrder[];
      }
    > = {};

    orders.forEach((ord) => {
      if (!ord.couponCode || ord.orderStatus === 'cancelled') return;
      const code = ord.couponCode.trim().toUpperCase();
      if (!code) return;
      if (!map[code]) {
        map[code] = {
          totalPurchases: 0,
          paidPurchases: 0,
          totalRevenue: 0,
          totalDiscountGiven: 0,
          ordersList: []
        };
      }
      const isPaid =
        ord.paymentStatus === 'approved' ||
        ['paid', 'pre_order_reserved', 'preparing_shipment', 'shipped', 'delivered'].includes(ord.orderStatus);

      map[code].totalPurchases += 1;
      if (isPaid) {
        map[code].paidPurchases += 1;
        map[code].totalRevenue += ord.totalAmount || 0;
      }
      map[code].totalDiscountGiven += ord.discountAmount || 0;
      map[code].ordersList.push(ord);
    });

    return map;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'paid_all') {
        if (
          o.paymentStatus !== 'approved' &&
          !['paid', 'pre_order_reserved', 'preparing_shipment', 'shipped', 'delivered'].includes(o.orderStatus)
        ) {
          return false;
        }
      } else if (statusFilter === 'pending_shipment') {
        const isPaid =
          o.paymentStatus === 'approved' ||
          ['paid', 'pre_order_reserved', 'preparing_shipment'].includes(o.orderStatus);
        if (!isPaid || ['shipped', 'delivered', 'cancelled'].includes(o.orderStatus)) {
          return false;
        }
      } else if (statusFilter !== 'all' && o.orderStatus !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = o.id.toLowerCase().includes(q);
        const matchName = (o.customerName || '').toLowerCase().includes(q);
        const matchEmail = (o.userEmail || '').toLowerCase().includes(q);
        const matchCpf = (o.customerCpf || '').includes(q);
        const matchCity = (o.shippingAddress?.city || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchEmail && !matchCpf && !matchCity) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const handleCopyShippingLabel = (ord: StoreOrder) => {
    const addr = ord.shippingAddress;
    const text = [
      `DESTINATÁRIO: ${ord.customerName}`,
      `CPF: ${formatCpf(ord.customerCpf)} | TEL: ${ord.customerPhone}`,
      `ENDEREÇO: ${addr.street}, Nº ${addr.number}${addr.complement ? ` (${addr.complement})` : ''}`,
      `BAIRRO: ${addr.neighborhood}`,
      `CIDADE/UF: ${addr.city} - ${addr.state}`,
      `CEP: ${formatCep(addr.cep)}`,
      `PEDIDO: #${ord.id} (${ord.shippingMethodName})`
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedLabelId(ord.id);
    setTimeout(() => setCopiedLabelId(null), 2500);
  };

  const getDefaultCarrierForOrder = (ord: StoreOrder): string => {
    if (ord.trackingCarrier) return ord.trackingCarrier;
    const method = (ord.shippingMethodName || '').toLowerCase();
    if (method.includes('loggi')) return 'Loggi';
    if (method.includes('jadlog')) return 'Jadlog';
    return 'Correios';
  };

  const handleSaveTrackingAndShip = async (ord: StoreOrder) => {
    const code = (trackingInputs[ord.id] ?? ord.trackingCode ?? '').trim().toUpperCase();
    const carrier = carrierInputs[ord.id] ?? getDefaultCarrierForOrder(ord);
    setSavingOrderId(ord.id);
    try {
      await updateStoreOrderFields(ord.id, {
        trackingCode: code,
        trackingCarrier: carrier,
        orderStatus: code ? 'shipped' : ord.orderStatus,
        ...(code && !ord.shippedAt ? { shippedAt: new Date().toISOString() } : {})
      });
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleChangeOrderStatus = async (ord: StoreOrder, nextStatus: OrderStatus) => {
    setSavingOrderId(ord.id);
    try {
      if (nextStatus === 'cancelled') {
        await deleteStoreOrder(ord.id);
        setOrders((prev) => prev.filter((o) => o.id !== ord.id));
        return;
      }
      const updates: Partial<StoreOrder> = {
        orderStatus: nextStatus,
        hasPreOrderItems: nextStatus === 'pre_order_reserved',
        ...(nextStatus === 'paid' || nextStatus === 'pre_order_reserved'
          ? { paymentStatus: 'approved' }
          : {})
      };
      await updateStoreOrderFields(ord.id, updates);
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleSyncMp = async (ord: StoreOrder) => {
    setSyncingOrderId(ord.id);
    try {
      await syncOrderPaymentStatus(ord);
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg(false);
    try {
      await saveStoreSettings(settings);
      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 3000);
    } finally {
      setSavingSettings(false);
    }
  };

  const applyExpiryPresetHours = (hours: number | null) => {
    if (hours === null) {
      setNewCouponExpiresAt('');
      return;
    }
    const d = new Date(Date.now() + hours * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setNewCouponExpiresAt(localIso);
  };

  const handleAddCoupon = async () => {
    const cleanCode = newCouponCode.trim().toUpperCase();
    if (!cleanCode) return;
    const existing = (settings.coupons || []).find((c) => c.code.toUpperCase() === cleanCode);
    const newC: StoreCoupon = {
      code: cleanCode,
      discountPercent: Math.max(1, Math.min(90, Number(newCouponPercent) || 5)),
      minOrderValue: Math.max(0, Number(newCouponMinVal) || 0),
      isActive: true,
      expiresAt: newCouponExpiresAt ? newCouponExpiresAt : undefined,
      usageCount: existing?.usageCount || 0,
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    const filtered = (settings.coupons || []).filter((c) => c.code.toUpperCase() !== cleanCode);
    const nextSettings: StoreSettings = {
      ...settings,
      coupons: [...filtered, newC]
    };
    setSettings(nextSettings);
    setNewCouponCode('');
    setNewCouponExpiresAt('');
    try {
      await saveStoreSettings(nextSettings);
      setSettingsSavedMsg(true);
      setTimeout(() => setSettingsSavedMsg(false), 2500);
    } catch {
      // ignore
    }
  };

  const buildWhatsAppLink = (ord: StoreOrder) => {
    const cleanPhone = ord.customerPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const trackingCode = trackingInputs[ord.id] ?? ord.trackingCode;
    const carrier = carrierInputs[ord.id] ?? getDefaultCarrierForOrder(ord);
    const msg = trackingCode
      ? `Olá ${ord.customerName}! Tudo bem? Seu pedido *#${ord.id}* da *Light Dark TCG* foi enviado via *${carrier}*! 📦\n\nCódigo de Rastreio (${carrier}): *${trackingCode}*\n\nObrigado pela compra e bom jogo!`
      : `Olá ${ord.customerName}! Tudo bem? Aqui é da *Light Dark TCG* referente ao seu pedido *#${ord.id}* (${formatBRL(ord.totalAmount)}).`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-lg font-black text-white">
            Central do Mercado (Produtos Oficiais, Pré-Vendas & Frete)
          </h3>
          <p className="text-xs text-slate-400">
            Gerencie pedidos oficiais pagos via Mercado Pago, etiquetas de envio, códigos de rastreio e tabelas de frete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('orders')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              subTab === 'orders'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Package size={15} />
            <span>Pedidos & Envios ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('shipping')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              subTab === 'shipping'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Truck size={15} />
            <span>Configurar Frete & Cupons</span>
          </button>
        </div>
      </div>

      {subTab === 'orders' ? (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Receita Aprovada</div>
              <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums mt-1">
                {formatBRL(stats.totalRevenue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {stats.approvedCount} pedido(s) pago(s)
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Reservas de Pré-Venda</div>
              <div className="text-2xl font-black font-mono text-purple-300 tabular-nums mt-1">
                {stats.preOrdersCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Pagos / Reservados</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Aguardando Postagem</div>
              <div className="text-2xl font-black font-mono text-amber-300 tabular-nums mt-1">
                {stats.pendingShipment}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Prontos p/ separar e enviar</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Total de Pedidos</div>
              <div className="text-2xl font-black font-mono text-white tabular-nums mt-1">
                {stats.totalOrders}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Histórico completo</div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'paid_all', label: 'Pagos / Confirmados' },
                { id: 'pending_shipment', label: 'Pendentes de Envio' },
                { id: 'pre_order_reserved', label: 'Em Pré-Venda' },
                { id: 'shipped', label: 'Enviados' },
                { id: 'awaiting_payment', label: 'Aguardando Pagamento' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    statusFilter === tab.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pedido, cliente, CPF..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Orders List */}
          {loadingOrders ? (
            <div className="text-center py-12 text-slate-400 text-sm">Carregando pedidos...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-400 text-sm">
              Nenhum pedido encontrado para este filtro.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((ord) => {
                const st = ORDER_STATUS_LABELS[ord.orderStatus] || ORDER_STATUS_LABELS.awaiting_payment;
                const currentTrackingVal =
                  trackingInputs[ord.id] !== undefined ? trackingInputs[ord.id] : ord.trackingCode || '';

                return (
                  <div
                    key={ord.id}
                    className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 space-y-4 shadow-md"
                  >
                    {/* Top Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-black text-sm text-white bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg">
                          #{ord.id}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${st.color}`}>
                          {st.label}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {new Date(ord.createdAt).toLocaleString('pt-BR')}
                        </span>
                        <span className="text-xs font-mono text-purple-300 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded">
                          {ord.paymentMethod === 'pix' ? 'PIX' : 'Checkout Pro'} ({ord.paymentStatus})
                        </span>
                        {ord.couponCode && (
                          <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-2.5 py-0.5 rounded flex items-center gap-1">
                            <Tag size={11} />
                            Cupom: {ord.couponCode}
                            {ord.discountAmount ? ` (-${formatBRL(ord.discountAmount)})` : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black font-mono text-emerald-400 tabular-nums mr-2">
                          {formatBRL(ord.totalAmount)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleSyncMp(ord)}
                          disabled={syncingOrderId === ord.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition"
                          title="Consultar status atualizado no Mercado Pago"
                        >
                          <RefreshCw
                            size={13}
                            className={syncingOrderId === ord.id ? 'animate-spin text-purple-400' : ''}
                          />
                          <span>Sincronizar MP</span>
                        </button>

                        <select
                          value={ord.orderStatus}
                          disabled={savingOrderId === ord.id}
                          onChange={(e) => handleChangeOrderStatus(ord, e.target.value as OrderStatus)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-purple-500"
                        >
                          <option value="awaiting_payment">Aguardando Pagamento</option>
                          <option value="paid">Pagamento Aprovado</option>
                          <option value="pre_order_reserved">Pré-Venda Confirmada</option>
                          <option value="preparing_shipment">Em Separação</option>
                          <option value="shipped">Pedido Enviado</option>
                          <option value="delivered">Entregue</option>
                          <option value="cancelled">Cancelado (Remover da Lista)</option>
                        </select>

                        <button
                          type="button"
                          disabled={savingOrderId === ord.id}
                          onClick={() => handleChangeOrderStatus(ord, 'cancelled')}
                          className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 text-xs font-bold flex items-center gap-1 transition"
                          title="Cancelar pedido e removê-lo da lista"
                        >
                          <Trash2 size={13} />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>

                    {/* Three Columns: Customer/Address | Items | Tracking & Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                      {/* Col 1: Buyer & Address */}
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                            Cliente & Endereço de Envio
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyShippingLabel(ord)}
                            className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                          >
                            {copiedLabelId === ord.id ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedLabelId === ord.id ? 'Copiado!' : 'Copiar p/ Etiqueta'}</span>
                          </button>
                        </div>

                        <div className="text-white font-bold">{ord.customerName}</div>
                        <div className="text-slate-400 font-mono">
                          CPF: {formatCpf(ord.customerCpf)} · Tel: {ord.customerPhone}
                        </div>
                        <div className="text-slate-400">{ord.userEmail}</div>

                        <div className="pt-1.5 border-t border-slate-800/80 text-slate-200">
                          <div>
                            {ord.shippingAddress.street}, Nº {ord.shippingAddress.number}
                            {ord.shippingAddress.complement ? ` (${ord.shippingAddress.complement})` : ''}
                          </div>
                          <div>
                            {ord.shippingAddress.neighborhood} — {ord.shippingAddress.city}/{ord.shippingAddress.state}
                          </div>
                          <div className="font-mono text-amber-300 font-bold mt-0.5">
                            CEP: {formatCep(ord.shippingAddress.cep)}
                          </div>
                        </div>

                        {ord.customerNotes && (
                          <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-amber-200 text-[11px]">
                            <strong>Obs. do Cliente:</strong> {ord.customerNotes}
                          </div>
                        )}
                      </div>

                      {/* Col 2: Items & Totals */}
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                          Produtos Comprados
                        </span>

                        <div className="space-y-1.5">
                          {ord.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-900 last:border-0"
                            >
                              <div>
                                <span className="font-bold text-white">
                                  {item.quantity}x {item.title}
                                </span>
                                {item.variationName && (
                                  <span className="block text-[11px] text-purple-300 font-semibold">
                                    Versão: {item.variationName}
                                  </span>
                                )}
                                {item.isPreOrder && (
                                  <span className="inline-block text-[10px] text-amber-300 font-bold">
                                    [Item de Pré-Venda]
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                                {formatBRL(item.unitPrice * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-800 space-y-1 text-slate-400">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-mono tabular-nums">{formatBRL(ord.subtotal)}</span>
                          </div>
                          {ord.discountAmount > 0 && (
                            <div className="flex justify-between text-emerald-400">
                              <span>Cupom ({ord.couponCode}):</span>
                              <span className="font-mono tabular-nums">- {formatBRL(ord.discountAmount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-slate-300">
                            <span>Frete ({ord.shippingMethodName}):</span>
                            <span className="font-mono tabular-nums">
                              {ord.shippingCost === 0 ? 'GRÁTIS' : formatBRL(ord.shippingCost)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Col 3: Tracking Code & WhatsApp Notification */}
                      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                            Rastreamento (Correios / Jadlog / Loggi) & Contato
                          </span>

                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">
                              Transportadora e Código de Rastreio
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={carrierInputs[ord.id] ?? getDefaultCarrierForOrder(ord)}
                                onChange={(e) =>
                                  setCarrierInputs((prev) => ({
                                    ...prev,
                                    [ord.id]: e.target.value
                                  }))
                                }
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold outline-none focus:border-purple-500"
                              >
                                <option value="Correios">Correios</option>
                                <option value="Jadlog">Jadlog</option>
                                <option value="Loggi">Loggi</option>
                              </select>
                              <input
                                type="text"
                                value={currentTrackingVal}
                                onChange={(e) =>
                                  setTrackingInputs((prev) => ({
                                    ...prev,
                                    [ord.id]: e.target.value.toUpperCase()
                                  }))
                                }
                                placeholder="Código de rastreio..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono uppercase outline-none focus:border-purple-500"
                              />
                              <button
                                type="button"
                                disabled={savingOrderId === ord.id}
                                onClick={() => handleSaveTrackingAndShip(ord)}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shrink-0"
                              >
                                Salvar & Enviar
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <a
                            href={buildWhatsAppLink(ord)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle size={14} />
                            <span>
                              {currentTrackingVal
                                ? 'Enviar Rastreio no WhatsApp do Cliente'
                                : 'Chamar Cliente no WhatsApp'}
                            </span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= SUB-TAB 2: SHIPPING & COUPONS SETTINGS ================= */
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                CEP de Origem dos Envios
              </label>
              <input
                type="text"
                value={settings.originCep}
                onChange={(e) => setSettings({ ...settings, originCep: formatCep(e.target.value) })}
                placeholder="01001-000"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Frete Grátis Acima de (R$) (0 = desativado)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.freeShippingThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, freeShippingThreshold: Number(e.target.value) || 0 })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-emerald-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                WhatsApp de Suporte da Loja
              </label>
              <input
                type="text"
                value={settings.whatsappSupport || '5534992166735'}
                onChange={(e) => setSettings({ ...settings, whatsappSupport: e.target.value })}
                placeholder="5534992166735"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Aviso no Topo da Loja Oficial
            </label>
            <input
              type="text"
              value={settings.storeNotice || ''}
              onChange={(e) => setSettings({ ...settings, storeNotice: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
            />
          </div>

          {/* Automatic WhatsApp Notification on New Order */}
          <div className="p-4 sm:p-5 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/40 pb-3">
              <div>
                <h4 className="text-sm font-black text-emerald-300 flex items-center gap-2">
                  <MessageCircle size={16} className="text-emerald-400" />
                  <span>Alerta Automático no Seu WhatsApp a Cada Nova Compra</span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Receba automaticamente uma mensagem no seu WhatsApp com os itens, valor, cliente e endereço sempre que um pedido for gerado ou pago!
                </p>
              </div>
              <button
                type="button"
                disabled={testingWhatsapp}
                onClick={async () => {
                  try {
                    setTestingWhatsapp(true);
                    setWhatsappTestFeedback(null);
                    await saveStoreSettings(settings);
                    const res = await fetch('/api/whatsapp/notify-order', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        eventType: 'payment_approved',
                        phone: settings.whatsappNotifyPhone || settings.whatsappSupport || '5534992166735',
                        callmebotApiKey: settings.whatsappCallmebotApiKey,
                        webhookUrl: settings.whatsappWebhookUrl,
                        order: {
                          id: 'TESTE-001',
                          customerName: 'Duelista de Teste',
                          customerPhone: '(34) 99216-6735',
                          totalAmount: 89.9,
                          paymentMethod: 'pix',
                          shippingMethodName: 'Correios SEDEX',
                          shippingAddress: {
                            street: 'Av. Brasil',
                            number: '1000',
                            city: 'Uberlândia',
                            state: 'MG',
                            cep: '38400-000'
                          },
                          items: [{ quantity: 1, title: 'Deck Estrutural Light Dark', variationName: 'Full Foil' }]
                        }
                      })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.sent) {
                      setWhatsappTestFeedback('✅ Alerta enviado com sucesso para +55 34 99216-6735! Verifique seu WhatsApp.');
                    } else if (data.needsSetup) {
                      setWhatsappTestFeedback(
                        '⚠️ Conecte seu WhatsApp clicando em "Gerar QR Code" logo abaixo para que o próprio site envie os alertas!'
                      );
                    } else {
                      setWhatsappTestFeedback(
                        `⚠️ Não foi possível entregar: ${data.results?.directBot?.error || data.results?.callmebot?.detail || 'Conecte o QR Code abaixo.'}`
                      );
                    }
                  } catch {
                    setWhatsappTestFeedback('Falha ao conectar para envio de teste.');
                  } finally {
                    setTestingWhatsapp(false);
                    setTimeout(() => setWhatsappTestFeedback(null), 9000);
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow"
              >
                <MessageCircle size={14} />
                <span>{testingWhatsapp ? 'Enviando Teste...' : 'Testar Alerta no WhatsApp'}</span>
              </button>
            </div>

            {whatsappTestFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-900/40 border border-emerald-500/50 text-emerald-200 text-xs font-bold">
                {whatsappTestFeedback}
              </div>
            )}

            {/* Built-in Direct WhatsApp Connection (No third-party limits) */}
            <div className="bg-slate-950/95 border border-emerald-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-emerald-300 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        waBotStatus.status === 'connected'
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : waBotStatus.status === 'qr_ready' || waBotStatus.status === 'connecting'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span>
                      {waBotStatus.status === 'connected'
                        ? `Robô Próprio do Site CONECTADO (+${waBotStatus.connectedPhone || '5534992166735'})`
                        : 'Robô Próprio do Site (Sem depender do CallMeBot)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {waBotStatus.status === 'connected'
                      ? 'Tudo pronto! Sempre que houver uma nova compra ou pagamento aprovado, você receberá a mensagem imediatamente no seu WhatsApp (+55 34 99216-6735).'
                      : 'Como o CallMeBot está lotado ("Bot is full"), criamos um robô próprio dentro do seu site! Basta escanear o QR Code abaixo no seu WhatsApp (Aparelhos Conectados -> Conectar um aparelho).'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {waBotStatus.status === 'connected' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingWaConnect(true);
                        try {
                          const r = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
                          const d = await r.json();
                          setWaBotStatus(d);
                        } finally {
                          setLoadingWaConnect(false);
                        }
                      }}
                      disabled={loadingWaConnect}
                      className="px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-800/70 border border-rose-600/50 text-rose-200 text-xs font-bold transition"
                    >
                      Desconectar WhatsApp
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={loadingWaConnect}
                        onClick={async () => {
                          setLoadingWaConnect(true);
                          try {
                            const r = await fetch('/api/whatsapp/connect', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                usePairingCode: false,
                                phoneNumber: settings.whatsappNotifyPhone || '5534992166735',
                                forceReset: true
                              })
                            });
                            const d = await r.json();
                            if (d && d.status) setWaBotStatus(d);
                          } finally {
                            setLoadingWaConnect(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
                      >
                        {loadingWaConnect ? 'Gerando...' : 'Gerar QR Code do WhatsApp'}
                      </button>

                      <button
                        type="button"
                        disabled={loadingWaConnect}
                        onClick={async () => {
                          setLoadingWaConnect(true);
                          try {
                            const r = await fetch('/api/whatsapp/connect', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                usePairingCode: true,
                                phoneNumber: settings.whatsappNotifyPhone || '5534992166735',
                                forceReset: true
                              })
                            });
                            const d = await r.json();
                            if (d && d.status) setWaBotStatus(d);
                          } finally {
                            setLoadingWaConnect(false);
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition"
                      >
                        Conectar por Código de 8 Dígitos
                      </button>
                    </>
                  )}
                </div>
              </div>

              {(loadingWaConnect || (waBotStatus.status === 'connecting' && !waBotStatus.qrDataUrl && !waBotStatus.pairingCode)) && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/40 flex items-center gap-3 text-xs text-amber-200">
                  <RefreshCw size={16} className="animate-spin text-amber-400 shrink-0" />
                  <span>
                    Conectando ao servidor do WhatsApp e gerando o QR Code... aguarde alguns segundos.
                  </span>
                </div>
              )}

              {waBotStatus.lastError && waBotStatus.status !== 'connected' && !waBotStatus.qrDataUrl && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 font-semibold">
                  ⚠️ {waBotStatus.lastError}
                </div>
              )}

              {waBotStatus.qrDataUrl && waBotStatus.status !== 'connected' && (
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t border-slate-800">
                  <div className="bg-white p-2.5 rounded-xl shrink-0 shadow-lg">
                    <img
                      src={waBotStatus.qrDataUrl}
                      alt="QR Code WhatsApp"
                      className="w-44 h-44 object-contain"
                    />
                  </div>
                  <div className="text-xs text-slate-300 space-y-1.5">
                    <div className="font-bold text-emerald-300 text-sm">Escaneie no seu celular (+55 34 99216-6735):</div>
                    <div>1. Abra o <strong>WhatsApp</strong> no seu celular.</div>
                    <div>2. Toque em <strong>Configurações (ou ⋮) ➔ Aparelhos conectados ➔ Conectar um aparelho</strong>.</div>
                    <div>3. Aponte a câmera para este QR Code. Assim que conectar, este quadro ficará verde automaticamente!</div>
                  </div>
                </div>
              )}

              {waBotStatus.pairingCode && waBotStatus.status !== 'connected' && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-300">
                    Código de Pareamento para +55 34 99216-6735:
                  </div>
                  <div className="text-2xl font-black tracking-widest text-white font-mono bg-slate-900 px-4 py-2 rounded-lg inline-block border border-emerald-500/40">
                    {waBotStatus.pairingCode}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    No seu WhatsApp, vá em <strong>Aparelhos conectados ➔ Conectar um aparelho ➔ Conectar com número de telefone</strong> e digite o código acima.
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Seu WhatsApp p/ Receber Alertas (com DDD)
                </label>
                <input
                  type="text"
                  value={settings.whatsappNotifyPhone || '5534992166735'}
                  onChange={(e) => setSettings({ ...settings, whatsappNotifyPhone: e.target.value })}
                  placeholder="Ex: 5534992166735"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  CallMeBot API Key (Opcional)
                </label>
                <input
                  type="text"
                  value={settings.whatsappCallmebotApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, whatsappCallmebotApiKey: e.target.value })}
                  placeholder="Opcional se usar o QR Code acima"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Webhook URL Opcional (Z-API / Make / n8n)
                </label>
                <input
                  type="text"
                  value={settings.whatsappWebhookUrl || ''}
                  onChange={(e) => setSettings({ ...settings, whatsappWebhookUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Carriers Enable Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableMiniEnvios}
                  onChange={(e) => setSettings({ ...settings, enableMiniEnvios: e.target.checked })}
                  className="accent-purple-500 w-4 h-4"
                />
                <span>Correios Mini Envios (até 350g)</span>
              </label>
              {settings.enableMiniEnvios && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.10"
                      value={settings.miniEnviosPrice}
                      onChange={(e) =>
                        setSettings({ ...settings, miniEnviosPrice: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Prazo</label>
                    <input
                      type="text"
                      value={settings.miniEnviosDays}
                      onChange={(e) => setSettings({ ...settings, miniEnviosDays: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <label className="flex items-center gap-2 text-sm font-bold text-rose-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableJadlog !== false}
                  onChange={(e) => setSettings({ ...settings, enableJadlog: e.target.checked })}
                  className="accent-purple-500 w-4 h-4"
                />
                <span>Habilitar Jadlog (.Package e .Com)</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                Calcula modalidades econômica (.Package) e expressa (.Com) da Jadlog por região.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-center">
              <label className="flex items-center gap-2 text-sm font-bold text-sky-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableLoggi !== false}
                  onChange={(e) => setSettings({ ...settings, enableLoggi: e.target.checked })}
                  className="accent-purple-500 w-4 h-4"
                />
                <span>Habilitar Loggi Express</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                Calcula frete expresso via transportadora Loggi com rastreio em tempo real.
              </p>
            </div>
          </div>

          {/* Regional Table */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white">
              Tabela de Frete por Região (Correios, Jadlog e Loggi)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {(
                [
                  { key: 'SE', name: 'Sudeste (SP, RJ, MG, ES)' },
                  { key: 'S', name: 'Sul (PR, SC, RS)' },
                  { key: 'CO', name: 'Centro-Oeste' },
                  { key: 'NE', name: 'Nordeste' },
                  { key: 'N', name: 'Norte' }
                ] as const
              ).map((reg) => {
                const rData = settings.regionalRates[reg.key];
                return (
                  <div
                    key={reg.key}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="font-bold text-purple-300 border-b border-slate-800 pb-1.5">
                      {reg.name}
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-300/90 block font-semibold">Base Correios PAC (R$)</label>
                      <input
                        type="number"
                        step="0.10"
                        value={rData.pacBase}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, pacBase: Number(e.target.value) || 0 }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block">Prazo PAC</label>
                      <input
                        type="text"
                        value={rData.pacDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, pacDays: e.target.value }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-300/90 block font-semibold">Base Correios SEDEX (R$)</label>
                      <input
                        type="number"
                        step="0.10"
                        value={rData.sedexBase}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, sedexBase: Number(e.target.value) || 0 }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block">Prazo SEDEX</label>
                      <input
                        type="text"
                        value={rData.sedexDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, sedexDays: e.target.value }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white mt-0.5"
                      />
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80">
                      <label className="text-[11px] text-rose-300 block font-semibold">Base Jadlog .Package (R$)</label>
                      <input
                        type="number"
                        step="0.10"
                        value={rData.jadlogPackageBase ?? 19.9}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, jadlogPackageBase: Number(e.target.value) || 0 }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block">Prazo Jadlog .Package</label>
                      <input
                        type="text"
                        value={rData.jadlogPackageDays || '3 a 6 dias úteis'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, jadlogPackageDays: e.target.value }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white mt-0.5"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-rose-300 block font-semibold">Base Jadlog .Com (R$)</label>
                      <input
                        type="number"
                        step="0.10"
                        value={rData.jadlogComBase ?? 27.9}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, jadlogComBase: Number(e.target.value) || 0 }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block">Prazo Jadlog .Com</label>
                      <input
                        type="text"
                        value={rData.jadlogComDays || '1 a 3 dias úteis'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, jadlogComDays: e.target.value }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white mt-0.5"
                      />
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80">
                      <label className="text-[11px] text-sky-300 block font-semibold">Base Loggi Express (R$)</label>
                      <input
                        type="number"
                        step="0.10"
                        value={rData.loggiExpressBase ?? 21.5}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, loggiExpressBase: Number(e.target.value) || 0 }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block">Prazo Loggi Express</label>
                      <input
                        type="text"
                        value={rData.loggiExpressDays || '1 a 3 dias úteis'}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            regionalRates: {
                              ...settings.regionalRates,
                              [reg.key]: { ...rData, loggiExpressDays: e.target.value }
                            }
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white mt-0.5"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount Coupons */}
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Tag size={16} className="text-purple-400" />
                  <span>Cupons de Desconto, Tempo de Validade & Relatório de Compras</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Configure prazo de validade (data/hora limite) e acompanhe em tempo real quantas compras foram feitas com cada cupom.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                Total de cupons: <strong className="text-white">{(settings.coupons || []).length}</strong>
              </div>
            </div>

            {/* Active / Configured Coupons List */}
            {(settings.coupons || []).length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/80">
                Nenhum cupom cadastrado no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {(settings.coupons || []).map((c, idx) => {
                  const codeUpper = c.code.toUpperCase();
                  const usage = couponUsageMap[codeUpper] || {
                    totalPurchases: 0,
                    paidPurchases: 0,
                    totalRevenue: 0,
                    totalDiscountGiven: 0,
                    ordersList: []
                  };
                  const expired = isCouponExpired(c);
                  const isExpanded = expandedCouponCode === codeUpper;
                  const effectiveTotalPurchases = Math.max(usage.totalPurchases, c.usageCount || 0);

                  return (
                    <div
                      key={c.code + idx}
                      className={`rounded-xl border p-4 transition space-y-3 ${
                        expired
                          ? 'bg-red-950/15 border-red-900/50'
                          : !c.isActive
                          ? 'bg-slate-900/40 border-slate-800 opacity-75'
                          : 'bg-slate-900/90 border-slate-700/80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Left: Code, Discount, Status & Expiry badge */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono font-black text-sm px-3 py-1 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-400 tracking-wider">
                            {c.code}
                          </span>
                          <span className="text-xs font-black px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-700/50 text-purple-200">
                            -{c.discountPercent}% OFF
                          </span>
                          {c.minOrderValue ? (
                            <span className="text-xs font-mono text-slate-300 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
                              Mín: {formatBRL(c.minOrderValue)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">Sem valor mínimo</span>
                          )}

                          {expired ? (
                            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 flex items-center gap-1">
                              <Clock size={11} /> EXPIRADO
                            </span>
                          ) : c.isActive ? (
                            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                              <Check size={11} /> ATIVO
                            </span>
                          ) : (
                            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-700/40 border border-slate-600 text-slate-300">
                              PAUSADO
                            </span>
                          )}

                          <span
                            className={`text-xs font-mono px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                              expired
                                ? 'bg-red-950/50 border-red-800/60 text-red-200'
                                : c.expiresAt
                                ? 'bg-amber-950/40 border-amber-700/50 text-amber-200'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <Clock size={12} />
                            <span>
                              {c.expiresAt
                                ? `${expired ? 'Expirou em:' : 'Válido até:'} ${formatCouponExpiry(c.expiresAt)}`
                                : 'Sem prazo de validade'}
                            </span>
                          </span>
                        </div>

                        {/* Right: Purchase Counter & Quick Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs">
                            <ShoppingBag size={14} className="text-emerald-400" />
                            <div>
                              <span className="font-black text-white">{effectiveTotalPurchases}</span>{' '}
                              <span className="text-slate-300">
                                {effectiveTotalPurchases === 1 ? 'compra feita' : 'compras feitas'}
                              </span>
                              <span className="text-emerald-400 font-bold ml-1.5">
                                ({usage.paidPurchases} {usage.paidPurchases === 1 ? 'paga' : 'pagas'})
                              </span>
                            </div>
                          </div>

                          {usage.totalDiscountGiven > 0 && (
                            <div className="text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300">
                              Receita: <strong className="text-emerald-400">{formatBRL(usage.totalRevenue)}</strong> • Desc.:{' '}
                              <strong className="text-amber-300">-{formatBRL(usage.totalDiscountGiven)}</strong>
                            </div>
                          )}

                          {usage.ordersList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCouponCode(isExpanded ? null : codeUpper)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-700/50 text-purple-200 text-xs font-bold transition"
                            >
                              {isExpanded ? 'Ocultar Compras' : `Ver Compras (${usage.ordersList.length})`}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const nextCoupons = settings.coupons.map((item, i) =>
                                i === idx ? { ...item, isActive: !item.isActive } : item
                              );
                              setSettings({ ...settings, coupons: nextCoupons });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
                          >
                            {c.isActive ? 'Pausar' : 'Ativar'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setSettings({
                                ...settings,
                                coupons: settings.coupons.filter((_, i) => i !== idx)
                              })
                            }
                            className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800/50 text-red-300 transition"
                            title="Remover cupom"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Inline Expiry Date Editor */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-400 font-semibold">Alterar Validade:</span>
                          <input
                            type="datetime-local"
                            value={c.expiresAt ? c.expiresAt.slice(0, 16) : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextCoupons = settings.coupons.map((item, i) =>
                                i === idx ? { ...item, expiresAt: val ? val : undefined } : item
                              );
                              setSettings({ ...settings, coupons: nextCoupons });
                            }}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                          />
                          {c.expiresAt && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextCoupons = settings.coupons.map((item, i) =>
                                  i === idx ? { ...item, expiresAt: undefined } : item
                                );
                                setSettings({ ...settings, coupons: nextCoupons });
                              }}
                              className="text-[11px] text-amber-300 hover:text-amber-200 underline"
                            >
                              Deixar sem validade
                            </button>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Clique em &ldquo;Salvar Configurações de Frete &amp; Loja&rdquo; após editar um cupom existente.
                        </span>
                      </div>

                      {/* Expandable Orders List for this Coupon */}
                      {isExpanded && usage.ordersList.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                            Histórico de Pedidos com o cupom {c.code}:
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {usage.ordersList.map((ord) => {
                              const st = ORDER_STATUS_LABELS[ord.orderStatus] || ORDER_STATUS_LABELS.awaiting_payment;
                              return (
                                <div
                                  key={ord.id}
                                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-2">
                                      <span className="font-mono text-purple-300">#{ord.id}</span>
                                      <span>{ord.customerName}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      {new Date(ord.createdAt).toLocaleString('pt-BR')} • {st.label}
                                    </div>
                                  </div>
                                  <div className="text-right font-mono">
                                    <div className="font-bold text-emerald-400">{formatBRL(ord.totalAmount)}</div>
                                    {ord.discountAmount ? (
                                      <div className="text-[10px] text-amber-300">
                                        Desc: -{formatBRL(ord.discountAmount)}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add / Update Coupon Form */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Criar Novo Cupom ou Atualizar Cupom Existente
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Código do Cupom</label>
                  <input
                    type="text"
                    value={newCouponCode}
                    onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                    placeholder="Ex: MACROVERSO15"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Desconto (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newCouponPercent}
                    onChange={(e) => setNewCouponPercent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Pedido Mínimo (R$)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCouponMinVal}
                    onChange={(e) => setNewCouponMinVal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-300 block mb-1 font-semibold">
                    Tempo de Validade (Opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={newCouponExpiresAt}
                    onChange={(e) => setNewCouponExpiresAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCoupon}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 h-[34px]"
                >
                  <Plus size={14} />
                  <span>Salvar Cupom</span>
                </button>
              </div>

              {/* Quick Duration Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 mr-1">Atalhos de Validade:</span>
                {[
                  { label: 'Sem Prazo', hours: null },
                  { label: '+24 Horas', hours: 24 },
                  { label: '+3 Dias', hours: 72 },
                  { label: '+7 Dias', hours: 24 * 7 },
                  { label: '+15 Dias', hours: 24 * 15 },
                  { label: '+30 Dias', hours: 24 * 30 }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyExpiryPresetHours(preset.hours)}
                    className="px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-300 font-semibold transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {settingsSavedMsg && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Check size={14} /> Configurações de Frete e Loja salvas!
              </span>
            )}
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-2"
            >
              <Save size={15} />
              <span>{savingSettings ? 'Salvando...' : 'Salvar Configurações de Frete & Loja'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
