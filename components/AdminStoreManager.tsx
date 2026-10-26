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
  ExternalLink
} from 'lucide-react';
import { OrderStatus, StoreCoupon, StoreOrder, StoreSettings } from '../types';
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  formatBRL,
  formatCep,
  formatCpf,
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

  // New Coupon Form
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState('10');
  const [newCouponMinVal, setNewCouponMinVal] = useState('0');

  useEffect(() => {
    fetchStoreSettings().then(setSettings);
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
    return {
      totalOrders: orders.length,
      approvedCount: approved.length,
      totalRevenue,
      pendingShipment,
      preOrdersCount
    };
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
      const updates: Partial<StoreOrder> = {
        orderStatus: nextStatus,
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

  const handleAddCoupon = () => {
    const cleanCode = newCouponCode.trim().toUpperCase();
    if (!cleanCode) return;
    const newC: StoreCoupon = {
      code: cleanCode,
      discountPercent: Math.max(1, Math.min(90, Number(newCouponPercent) || 5)),
      minOrderValue: Math.max(0, Number(newCouponMinVal) || 0),
      isActive: true
    };
    const filtered = (settings.coupons || []).filter((c) => c.code.toUpperCase() !== cleanCode);
    setSettings({
      ...settings,
      coupons: [...filtered, newC]
    });
    setNewCouponCode('');
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
                          <option value="cancelled">Cancelado</option>
                        </select>
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
                value={settings.whatsappSupport}
                onChange={(e) => setSettings({ ...settings, whatsappSupport: e.target.value })}
                placeholder="5511999999999"
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
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag size={15} className="text-purple-400" />
              <span>Cupons de Desconto Ativos</span>
            </h4>

            <div className="flex flex-wrap gap-2">
              {(settings.coupons || []).map((c, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs"
                >
                  <span className="font-mono font-bold text-emerald-400">{c.code}</span>
                  <span className="text-slate-300">(-{c.discountPercent}%)</span>
                  {c.minOrderValue ? (
                    <span className="text-slate-500">Mín: {formatBRL(c.minOrderValue)}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        coupons: settings.coupons.filter((_, i) => i !== idx)
                      })
                    }
                    className="text-red-400 hover:text-red-300 ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Código do Cupom</label>
                <input
                  type="text"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  placeholder="Ex: HALLOWEEN10"
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Desconto (%)</label>
                <input
                  type="number"
                  value={newCouponPercent}
                  onChange={(e) => setNewCouponPercent(e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Pedido Mínimo (R$)</label>
                <input
                  type="number"
                  value={newCouponMinVal}
                  onChange={(e) => setNewCouponMinVal(e.target.value)}
                  className="w-28 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCoupon}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Adicionar Cupom</span>
              </button>
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
