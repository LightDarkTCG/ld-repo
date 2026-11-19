import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Search,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  QrCode,
  CreditCard,
  MapPin,
  MessageCircle,
  Bell,
  Sparkles,
  Trash2,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { OrderStatus, StoreOrder } from '../types';
import {
  fetchStoreSettings,
  formatBRL,
  formatCep,
  getCarrierTrackingUrl,
  getSavedCustomerLookup,
  ORDER_STATUS_LABELS,
  searchAndLinkCustomerOrders,
  subscribeCustomerOrders,
  syncOrderPaymentStatus,
  updateStoreOrderFields
} from '../storeService';

interface CustomerOrdersAreaProps {
  user?: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  onOpenOrderPayment?: (orderId: string) => void;
  onContinueShopping?: () => void;
}

const ORDER_TIMELINE_STEPS: {
  key: OrderStatus;
  label: string;
  preOrderLabel?: string;
  shortDesc: string;
}[] = [
  {
    key: 'awaiting_payment',
    label: 'Pedido Recebido',
    shortDesc: 'Aguardando confirmação'
  },
  {
    key: 'paid',
    label: 'Pagamento Aprovado',
    preOrderLabel: 'Pré-Venda Confirmada',
    shortDesc: 'Pedido confirmado'
  },
  {
    key: 'preparing_shipment',
    label: 'Em Separação',
    shortDesc: 'Preparando e embalando'
  },
  {
    key: 'shipped',
    label: 'Pedido Enviado',
    shortDesc: 'Em trânsito c/ rastreio'
  },
  {
    key: 'delivered',
    label: 'Entregue',
    shortDesc: 'Recebido no destino'
  }
];

function getStepIndexForStatus(status: OrderStatus): number {
  switch (status) {
    case 'awaiting_payment':
      return 0;
    case 'paid':
    case 'pre_order_reserved':
      return 1;
    case 'preparing_shipment':
      return 2;
    case 'shipped':
      return 3;
    case 'delivered':
      return 4;
    default:
      return 0;
  }
}

export const CustomerOrdersArea: React.FC<CustomerOrdersAreaProps> = ({
  user,
  onOpenOrderPayment,
  onContinueShopping
}) => {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'shipped' | 'delivered'>('all');
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState('5534992166735');
  const [lookupTrigger, setLookupTrigger] = useState(0);

  useEffect(() => {
    fetchStoreSettings()
      .then((s) => {
        if (s.whatsappSupport) setSupportPhone(s.whatsappSupport);
      })
      .catch(() => {});
  }, []);

  // Real-time subscription to customer orders
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeCustomerOrders(
      {
        userId: user?.uid,
        userEmail: user?.email || undefined
      },
      (liveOrders) => {
        setOrders(liveOrders);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid, user?.email, lookupTrigger]);

  const handleSearchOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setSearchFeedback(null);
    try {
      const found = await searchAndLinkCustomerOrders(q);
      if (found.length > 0) {
        setLookupTrigger((prev) => prev + 1);
        setSearchFeedback({
          type: 'ok',
          text:
            found.length === 1
              ? `Pedido #${found[0].id} localizado e vinculado à sua Área do Cliente!`
              : `${found.length} pedidos localizados e vinculados à sua Área do Cliente!`
        });
        setSearchQuery('');
      } else {
        setSearchFeedback({
          type: 'err',
          text: 'Nenhuma compra ativa encontrada para este Código, CPF ou E-mail.'
        });
      }
    } catch {
      setSearchFeedback({
        type: 'err',
        text: 'Não foi possível consultar o pedido no momento.'
      });
    } finally {
      setSearching(false);
      setTimeout(() => setSearchFeedback(null), 6000);
    }
  };

  const handleManualVerifyPayment = async (ord: StoreOrder) => {
    setCheckingOrderId(ord.id);
    try {
      await syncOrderPaymentStatus(ord);
    } finally {
      setCheckingOrderId(null);
    }
  };

  const handleCancelPendingOrder = async (ord: StoreOrder) => {
    setCheckingOrderId(ord.id);
    try {
      await updateStoreOrderFields(ord.id, {
        orderStatus: 'cancelled',
        paymentStatus: 'cancelled'
      });
    } finally {
      setCheckingOrderId(null);
    }
  };

  const summary = useMemo(() => {
    const total = orders.length;
    const preparing = orders.filter((o) =>
      ['paid', 'pre_order_reserved', 'preparing_shipment'].includes(o.orderStatus)
    ).length;
    const shipped = orders.filter((o) => o.orderStatus === 'shipped').length;
    const delivered = orders.filter((o) => o.orderStatus === 'delivered').length;
    return { total, preparing, shipped, delivered };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter === 'active') {
        return ['awaiting_payment', 'paid', 'pre_order_reserved', 'preparing_shipment'].includes(
          o.orderStatus
        );
      }
      if (statusFilter === 'shipped') return o.orderStatus === 'shipped';
      if (statusFilter === 'delivered') return o.orderStatus === 'delivered';
      return true;
    });
  }, [orders, statusFilter]);

  const savedLookup = getSavedCustomerLookup();

  const buildSupportWhatsAppUrl = (ord: StoreOrder) => {
    const cleanPhone = supportPhone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const st = ORDER_STATUS_LABELS[ord.orderStatus]?.label || ord.orderStatus;
    const msg = `Olá! Estou acompanhando minha compra *#${ord.id}* (${st}) na Área do Cliente da *Light Dark TCG* e gostaria de tirar uma dúvida.`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      {/* ================= HEADER & SEARCH BAR ================= */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0e111a] to-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Área do Cliente · Atualização em Tempo Real</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Truck size={24} className="text-emerald-400 shrink-0" />
              <span>Acompanhar Minhas Compras</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Acompanhe cada etapa do seu pedido ao vivo. Sempre que a loja atualizar o status da sua compra, informar uma previsão ou postar o código de rastreio, a tela atualiza automaticamente.
            </p>
          </div>

          {/* Search / Link Order by Code, CPF or Email */}
          <form onSubmit={handleSearchOrders} className="w-full lg:w-auto flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search
                size={15}
                className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Código (LD-...), CPF ou E-mail..."
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-emerald-500 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer shrink-0"
            >
              {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
              <span>{searching ? 'Buscando...' : 'Localizar Compra'}</span>
            </button>
          </form>
        </div>

        {searchFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              searchFeedback.type === 'ok'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                : 'bg-red-950/80 border-red-500/50 text-red-200'
            }`}
          >
            <Bell size={15} className="shrink-0" />
            <span>{searchFeedback.text}</span>
          </div>
        )}

        {/* Quick Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`text-left p-3 rounded-xl border transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-purple-950/50 border-purple-500/60'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[11px] text-slate-400 block">Total de Compras</span>
            <span className="text-lg sm:text-xl font-black font-mono text-white tabular-nums">
              {summary.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`text-left p-3 rounded-xl border transition cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-cyan-950/50 border-cyan-500/60'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[11px] text-slate-400 block">Confirmados / Em Preparo</span>
            <span className="text-lg sm:text-xl font-black font-mono text-cyan-300 tabular-nums">
              {summary.preparing}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('shipped')}
            className={`text-left p-3 rounded-xl border transition cursor-pointer ${
              statusFilter === 'shipped'
                ? 'bg-blue-950/50 border-blue-500/60'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[11px] text-slate-400 block">Enviados / Em Trânsito</span>
            <span className="text-lg sm:text-xl font-black font-mono text-blue-300 tabular-nums">
              {summary.shipped}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('delivered')}
            className={`text-left p-3 rounded-xl border transition cursor-pointer ${
              statusFilter === 'delivered'
                ? 'bg-emerald-950/50 border-emerald-500/60'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[11px] text-slate-400 block">Entregues</span>
            <span className="text-lg sm:text-xl font-black font-mono text-emerald-400 tabular-nums">
              {summary.delivered}
            </span>
          </button>
        </div>
      </div>

      {/* ================= ORDERS LIST ================= */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm flex items-center justify-center gap-2.5 bg-slate-900/50 rounded-2xl border border-slate-800">
          <RefreshCw size={18} className="animate-spin text-emerald-400" />
          <span>Sincronizando suas compras em tempo real...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Package size={32} />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-white">
              {orders.length === 0
                ? 'Nenhuma compra vinculada encontrada neste dispositivo'
                : 'Nenhum pedido encontrado neste filtro'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {orders.length === 0
                ? 'Se você já realizou uma compra, digite seu CPF, E-mail usado no pedido ou o código (#LD-...) no campo "Localizar Compra" acima para acompanhar todas as atualizações aqui.'
                : 'Selecione "Total de Compras" acima para visualizar todos os seus pedidos.'}
            </p>
            {(user?.email || savedLookup.email || savedLookup.cpf) && orders.length === 0 && (
              <p className="text-[11px] text-emerald-400/90 font-mono pt-1">
                Monitorando compras para:{' '}
                {user?.email || savedLookup.email || `CPF final ${savedLookup.cpf?.slice(-4)}`}
              </p>
            )}
          </div>
          {onContinueShopping && (
            <button
              type="button"
              onClick={onContinueShopping}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Ver Produtos da Loja Oficial
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((ord) => {
            const st = ORDER_STATUS_LABELS[ord.orderStatus] || ORDER_STATUS_LABELS.awaiting_payment;
            const currentStepIdx = getStepIndexForStatus(ord.orderStatus);
            const carrierLabel =
              ord.trackingCarrier ||
              (ord.shippingMethodName?.toLowerCase().includes('loggi')
                ? 'Loggi'
                : ord.shippingMethodName?.toLowerCase().includes('jadlog')
                ? 'Jadlog'
                : 'Correios');

            return (
              <div
                key={ord.id}
                className="bg-[#0e1017] border border-slate-800 hover:border-slate-700/90 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xl transition"
              >
                {/* 1. Order Top Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/90 pb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-black text-xs sm:text-sm text-white bg-slate-950 border border-slate-700 px-3 py-1 rounded-lg">
                        #{ord.id}
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${st.color}`}>
                        {st.label}
                      </span>
                      {ord.hasPreOrderItems && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-950/90 border border-purple-500/50 text-purple-200 flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Lote Pré-Venda</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span>
                        Compra feita em:{' '}
                        <strong className="text-slate-300">
                          {new Date(ord.createdAt).toLocaleString('pt-BR')}
                        </strong>
                      </span>
                      {ord.updatedAt && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Clock size={11} />
                          <span>
                            Última atualização: {new Date(ord.updatedAt).toLocaleString('pt-BR')}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions & Total */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="text-left md:text-right mr-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                        Valor Total ({ord.paymentMethod === 'pix' ? 'PIX' : 'Cartão/MP'})
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-emerald-400 tabular-nums">
                        {formatBRL(ord.totalAmount)}
                      </span>
                    </div>

                    {ord.paymentStatus !== 'approved' && ord.orderStatus === 'awaiting_payment' && (
                      <>
                        {ord.mpPixQrCode && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(ord.mpPixQrCode || '');
                              setCopiedPixId(ord.id);
                              setTimeout(() => setCopiedPixId(null), 2500);
                            }}
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedPixId === ord.id ? <Check size={14} /> : <QrCode size={14} />}
                            <span>{copiedPixId === ord.id ? 'PIX Copiado!' : 'Copiar PIX'}</span>
                          </button>
                        )}
                        {ord.mpInitPoint && (
                          <a
                            href={ord.mpInitPoint}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <CreditCard size={14} />
                            <span>Pagar no MP</span>
                          </a>
                        )}
                        {onOpenOrderPayment && (
                          <button
                            type="button"
                            onClick={() => onOpenOrderPayment(ord.id)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold transition cursor-pointer"
                          >
                            Ver QR Code
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={checkingOrderId === ord.id}
                          onClick={() => handleCancelPendingOrder(ord)}
                          className="px-2.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Cancelar pedido pendente"
                        >
                          <Trash2 size={13} />
                          <span>Cancelar</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={checkingOrderId === ord.id}
                      onClick={() => handleManualVerifyPayment(ord)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Verificar atualização de pagamento"
                    >
                      <RefreshCw
                        size={15}
                        className={checkingOrderId === ord.id ? 'animate-spin text-emerald-400' : ''}
                      />
                    </button>
                  </div>
                </div>

                {/* 2. Visual 5-Stage Progress Stepper */}
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>Progresso da Sua Compra</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">
                      Etapa {currentStepIdx + 1} de {ORDER_TIMELINE_STEPS.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    {ORDER_TIMELINE_STEPS.map((step, idx) => {
                      const isCompleted = idx < currentStepIdx || ord.orderStatus === 'delivered';
                      const isCurrent = idx === currentStepIdx && ord.orderStatus !== 'delivered';
                      const stepTitle =
                        idx === 1 && (ord.hasPreOrderItems || ord.orderStatus === 'pre_order_reserved')
                          ? step.preOrderLabel || step.label
                          : step.label;

                      return (
                        <div
                          key={step.key}
                          className={`p-3 rounded-xl border transition flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5 ${
                            isCurrent
                              ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/50'
                              : isCompleted
                              ? 'bg-emerald-950/20 border-emerald-700/50 text-emerald-200'
                              : 'bg-slate-900/50 border-slate-800/80 text-slate-500'
                          }`}
                        >
                          <div className="flex items-center justify-between w-auto sm:w-full">
                            <span
                              className={`w-6 h-6 rounded-full text-xs font-black font-mono flex items-center justify-center shrink-0 ${
                                isCurrent
                                  ? 'bg-emerald-500 text-slate-950 shadow'
                                  : isCompleted
                                  ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {isCompleted ? <Check size={13} /> : idx + 1}
                            </span>
                            {isCurrent && (
                              <span className="hidden sm:inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Atual
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-xs font-bold leading-tight ${
                                isCurrent
                                  ? 'text-white'
                                  : isCompleted
                                  ? 'text-emerald-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {stepTitle}
                            </div>
                            <div className="text-[10px] opacity-80 leading-snug mt-0.5">
                              {step.shortDesc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Admin Status Note / Live Update Banner */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    ord.adminNotes
                      ? 'bg-amber-950/35 border-amber-500/50 text-amber-100'
                      : 'bg-slate-900/70 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300">
                      <Sparkles size={14} className="text-amber-400 shrink-0" />
                      <span>
                        {ord.adminNotes
                          ? 'Mensagem / Atualização da Loja para Você:'
                          : `Status Atual: ${st.label}`}
                      </span>
                    </div>
                    {ord.adminNotes ? (
                      <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                        "{ord.adminNotes}"
                      </p>
                    ) : (
                      <p className="text-xs text-slate-300">{st.desc}</p>
                    )}
                    {ord.preOrderReleaseNotes && (
                      <p className="text-[11px] text-purple-300 font-semibold pt-1">
                        Info de Pré-Venda: {ord.preOrderReleaseNotes}
                      </p>
                    )}
                  </div>

                  <a
                    href={buildSupportWhatsAppUrl(ord)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <MessageCircle size={14} />
                    <span>Falar no WhatsApp</span>
                  </a>
                </div>

                {/* 4. Tracking Code Box (if available) */}
                {ord.trackingCode && (
                  <div className="p-4 rounded-2xl bg-blue-950/50 border border-blue-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                        <Truck size={20} />
                      </div>
                      <div>
                        <span className="text-[11px] text-blue-300 font-black uppercase tracking-wider block">
                          Código de Rastreio ({carrierLabel})
                        </span>
                        <span className="font-mono font-black text-base text-white tracking-wide">
                          {ord.trackingCode}
                        </span>
                        {ord.shippedAt && (
                          <span className="text-[11px] text-blue-200/80 block">
                            Postado em: {new Date(ord.shippedAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ord.trackingCode || '');
                          setCopiedTrackingId(ord.id);
                          setTimeout(() => setCopiedTrackingId(null), 2000);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedTrackingId === ord.id ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedTrackingId === ord.id ? 'Copiado!' : 'Copiar Código'}</span>
                      </button>

                      <a
                        href={getCarrierTrackingUrl(carrierLabel, ord.trackingCode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <span>Rastrear na {carrierLabel}</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                )}

                {/* 5. Items & Delivery Address Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                  {/* Items Purchased */}
                  <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-2.5">
                    <span className="font-black text-slate-300 uppercase tracking-wider text-[11px] block border-b border-slate-800 pb-2">
                      Produtos da Compra ({ord.items.reduce((a, b) => a + b.quantity, 0)})
                    </span>

                    <div className="space-y-2">
                      {ord.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 py-1 border-b border-slate-900 last:border-0"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                <Package size={15} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate">
                                {item.quantity}x {item.title}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                {item.variationName && (
                                  <span className="text-purple-300 font-semibold">
                                    {item.variationName}
                                  </span>
                                )}
                                {item.isPreOrder && (
                                  <span className="text-amber-300 font-bold">[Pré-Venda]</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                            {formatBRL(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-slate-400">
                      <div className="flex justify-between">
                        <span>Frete ({ord.shippingMethodName}):</span>
                        <span className="font-mono text-slate-200 tabular-nums">
                          {ord.shippingCost === 0 ? 'GRÁTIS' : formatBRL(ord.shippingCost)}
                        </span>
                      </div>
                      {ord.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Desconto ({ord.couponCode}):</span>
                          <span className="font-mono tabular-nums">
                            - {formatBRL(ord.discountAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-2">
                    <span className="font-black text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <MapPin size={13} className="text-purple-400" />
                      <span>Endereço & Modalidade de Entrega</span>
                    </span>

                    <div className="text-white font-bold">{ord.customerName}</div>
                    <div className="text-slate-300">
                      {ord.shippingAddress.street}, Nº {ord.shippingAddress.number}
                      {ord.shippingAddress.complement ? ` (${ord.shippingAddress.complement})` : ''}
                    </div>
                    <div className="text-slate-400">
                      {ord.shippingAddress.neighborhood} — {ord.shippingAddress.city}/
                      {ord.shippingAddress.state}
                    </div>
                    <div className="font-mono text-amber-300 font-bold">
                      CEP: {formatCep(ord.shippingAddress.cep)}
                    </div>
                    <div className="pt-1.5 text-[11px] text-slate-400">
                      Envio selecionado: <strong className="text-white">{ord.shippingMethodName}</strong>{' '}
                      {ord.shippingEstimatedDays ? `(${ord.shippingEstimatedDays})` : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
