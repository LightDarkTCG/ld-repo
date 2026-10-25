import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.env.NODE_ENV || 'development';
const env = loadEnv(mode, __dirname, '');

const getMpAccessToken = (): string => {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    env.MERCADOPAGO_ACCESS_TOKEN ||
    ''
  ).trim();
};

const getMpPublicKey = (): string => {
  return (
    process.env.VITE_MERCADOPAGO_PUBLIC_KEY ||
    env.VITE_MERCADOPAGO_PUBLIC_KEY ||
    ''
  ).trim();
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '5mb' }));

  // Health & Config Check
  app.get('/api/mercadopago/config', (_req, res) => {
    const hasToken = Boolean(getMpAccessToken());
    const publicKey = getMpPublicKey();
    res.json({
      configured: hasToken,
      publicKey
    });
  });

  // CEP Lookup Proxy with ViaCEP + BrasilAPI fallback
  app.get('/api/cep/:cep', async (req, res) => {
    const cleanCep = String(req.params.cep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      res.status(400).json({ error: 'CEP inválido. Digite 8 números.' });
      return;
    }

    try {
      const viaRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (viaRes.ok) {
        const data: any = await viaRes.json();
        if (!data.erro) {
          res.json({
            cep: data.cep || cleanCep,
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || ''
          });
          return;
        }
      }
    } catch {
      // Fallback to BrasilAPI below
    }

    try {
      const brRes = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
      if (brRes.ok) {
        const data: any = await brRes.json();
        res.json({
          cep: data.cep || cleanCep,
          street: data.street || '',
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || ''
        });
        return;
      }
    } catch {
      // Both failed
    }

    res.status(404).json({ error: 'CEP não encontrado.' });
  });

  // 1. Create Transparent PIX Payment via Mercado Pago API
  app.post('/api/mercadopago/pix', async (req, res) => {
    const accessToken = getMpAccessToken();
    if (!accessToken) {
      res.status(500).json({ error: 'Credenciais do Mercado Pago não configuradas no servidor.' });
      return;
    }

    try {
      const {
        orderId,
        amount,
        description,
        payerEmail,
        payerName,
        payerCpf
      } = req.body || {};

      const numericAmount = Number(Number(amount).toFixed(2));
      if (!numericAmount || numericAmount <= 0) {
        res.status(400).json({ error: 'Valor do pedido inválido para geração do PIX.' });
        return;
      }

      const cleanCpf = String(payerCpf || '').replace(/\D/g, '');
      const nameParts = String(payerName || 'Cliente Light Dark').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'TCG';
      const email = String(payerEmail || '').trim() || 'comprador@lightdark.com.br';

      const payload: any = {
        transaction_amount: numericAmount,
        description: String(description || `Pedido #${orderId} - Light Dark TCG`).slice(0, 250),
        payment_method_id: 'pix',
        external_reference: String(orderId || `LD-${Date.now()}`),
        payer: {
          email,
          first_name: firstName,
          last_name: lastName,
          ...(cleanCpf.length === 11
            ? {
                identification: {
                  type: 'CPF',
                  number: cleanCpf
                }
              }
            : {})
        }
      };

      const idempotencyKey = `pix_${orderId || 'order'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(payload)
      });

      const mpData: any = await mpResponse.json();

      if (!mpResponse.ok) {
        const detail =
          mpData?.cause?.[0]?.description ||
          mpData?.message ||
          'Não foi possível gerar o QR Code PIX no Mercado Pago.';
        res.status(mpResponse.status).json({
          error: detail,
          details: mpData
        });
        return;
      }

      const txData = mpData?.point_of_interaction?.transaction_data || {};

      res.json({
        paymentId: String(mpData.id),
        status: mpData.status || 'pending',
        statusDetail: mpData.status_detail || '',
        qrCode: txData.qr_code || '',
        qrCodeBase64: txData.qr_code_base64 || '',
        ticketUrl: txData.ticket_url || '',
        expiresAt: mpData.date_of_expiration || null
      });
    } catch (err: any) {
      console.error('Erro ao criar pagamento PIX Mercado Pago:', err);
      res.status(500).json({
        error: err.message || 'Erro interno ao comunicar com o Mercado Pago.'
      });
    }
  });

  // 2. Create Checkout Pro Preference (Credit Card up to 12x, PIX, Boleto, Saldo MP)
  app.post('/api/mercadopago/preference', async (req, res) => {
    const accessToken = getMpAccessToken();
    if (!accessToken) {
      res.status(500).json({ error: 'Credenciais do Mercado Pago não configuradas no servidor.' });
      return;
    }

    try {
      const {
        orderId,
        items,
        shippingCost,
        discountAmount,
        payer,
        originUrl
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'O carrinho está vazio.' });
        return;
      }

      const discountRatio = Number(discountAmount) > 0
        ? Math.max(0, 1 - Number(discountAmount) / items.reduce((acc: number, it: any) => acc + (Number(it.unitPrice) * Number(it.quantity || 1)), 0))
        : 1;

      const mpItems = items.map((item: any, idx: number) => ({
        id: String(item.id || `item-${idx + 1}`),
        title: String(item.title || 'Produto Light Dark TCG').slice(0, 250),
        description: String(item.variationName ? `${item.title} - ${item.variationName}` : item.title).slice(0, 250),
        picture_url: item.imageUrl || undefined,
        category_id: 'games',
        quantity: Math.max(1, Number(item.quantity) || 1),
        currency_id: 'BRL',
        unit_price: Number(Math.max(0.5, Number(item.unitPrice) * discountRatio).toFixed(2))
      }));

      const numericShipping = Number(Number(shippingCost || 0).toFixed(2));
      if (numericShipping > 0) {
        mpItems.push({
          id: 'frete-envio',
          title: `Frete e Envio (${payer?.shippingMethodName || 'Correios'})`,
          description: 'Custo de envio do pedido',
          picture_url: undefined,
          category_id: 'shipping',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: numericShipping
        });
      }

      const baseUrl = String(originUrl || 'https://lightdark.com.br').replace(/\/+$/, '');
      const cleanCpf = String(payer?.cpf || '').replace(/\D/g, '');
      const cleanCep = String(payer?.cep || '').replace(/\D/g, '');
      const nameParts = String(payer?.name || 'Cliente Light Dark').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'TCG';

      const preferencePayload: any = {
        items: mpItems,
        external_reference: String(orderId || `LD-${Date.now()}`),
        statement_descriptor: 'LIGHTDARKTCG',
        payer: {
          name: firstName,
          surname: lastName,
          email: String(payer?.email || 'comprador@lightdark.com.br').trim(),
          ...(cleanCpf.length === 11
            ? {
                identification: {
                  type: 'CPF',
                  number: cleanCpf
                }
              }
            : {}),
          ...(cleanCep.length === 8
            ? {
                address: {
                  zip_code: cleanCep,
                  street_name: String(payer?.street || ''),
                  street_number: Number(String(payer?.number || '0').replace(/\D/g, '')) || 0
                }
              }
            : {})
        },
        back_urls: {
          success: `${baseUrl}/?mp_order=${encodeURIComponent(String(orderId || ''))}&mp_status=approved`,
          failure: `${baseUrl}/?mp_order=${encodeURIComponent(String(orderId || ''))}&mp_status=failure`,
          pending: `${baseUrl}/?mp_order=${encodeURIComponent(String(orderId || ''))}&mp_status=pending`
        },
        auto_return: 'approved'
      };

      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferencePayload)
      });

      const mpData: any = await mpResponse.json();

      if (!mpResponse.ok) {
        const detail =
          mpData?.cause?.[0]?.description ||
          mpData?.message ||
          'Erro ao gerar link de Checkout no Mercado Pago.';
        res.status(mpResponse.status).json({
          error: detail,
          details: mpData
        });
        return;
      }

      res.json({
        preferenceId: String(mpData.id),
        initPoint: mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point
      });
    } catch (err: any) {
      console.error('Erro ao criar preferência Mercado Pago:', err);
      res.status(500).json({
        error: err.message || 'Erro interno ao criar preferência no Mercado Pago.'
      });
    }
  });

  // 3. Check Payment Status by Payment ID
  app.get('/api/mercadopago/payment/:paymentId', async (req, res) => {
    const accessToken = getMpAccessToken();
    if (!accessToken) {
      res.status(500).json({ error: 'Credenciais não configuradas.' });
      return;
    }

    try {
      const paymentId = String(req.params.paymentId || '').replace(/\D/g, '');
      if (!paymentId) {
        res.status(400).json({ error: 'ID de pagamento inválido.' });
        return;
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const mpData: any = await mpResponse.json();
      if (!mpResponse.ok) {
        res.status(mpResponse.status).json({ error: mpData?.message || 'Pagamento não encontrado.' });
        return;
      }

      res.json({
        paymentId: String(mpData.id),
        status: mpData.status,
        statusDetail: mpData.status_detail,
        externalReference: mpData.external_reference,
        transactionAmount: mpData.transaction_amount,
        paymentMethodId: mpData.payment_method_id,
        paymentTypeId: mpData.payment_type_id,
        dateApproved: mpData.date_approved
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao consultar pagamento.' });
    }
  });

  // 4. Search Payment Status by Order ID (external_reference)
  app.get('/api/mercadopago/order/:orderId', async (req, res) => {
    const accessToken = getMpAccessToken();
    if (!accessToken) {
      res.status(500).json({ error: 'Credenciais não configuradas.' });
      return;
    }

    try {
      const orderId = String(req.params.orderId || '').trim();
      if (!orderId) {
        res.status(400).json({ error: 'ID do pedido inválido.' });
        return;
      }

      const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc`;
      const mpResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const mpData: any = await mpResponse.json();
      if (!mpResponse.ok) {
        res.status(mpResponse.status).json({ error: mpData?.message || 'Erro na busca de pagamentos.' });
        return;
      }

      const results = Array.isArray(mpData.results) ? mpData.results : [];
      const approvedPayment = results.find((p: any) => p.status === 'approved');
      const latestPayment = approvedPayment || results[0] || null;

      if (!latestPayment) {
        res.json({ found: false, status: 'pending' });
        return;
      }

      res.json({
        found: true,
        paymentId: String(latestPayment.id),
        status: latestPayment.status,
        statusDetail: latestPayment.status_detail,
        transactionAmount: latestPayment.transaction_amount,
        paymentMethodId: latestPayment.payment_method_id,
        dateApproved: latestPayment.date_approved
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao consultar pedido no Mercado Pago.' });
    }
  });

  // Vite middleware in development or static dist in production
  const distPath = path.join(__dirname, 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
