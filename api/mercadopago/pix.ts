export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  const accessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    res.status(500).json({
      error:
        'Credenciais do Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) não configuradas nas variáveis de ambiente da hospedagem (Vercel).'
    });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const {
      orderId,
      amount,
      description,
      payerEmail,
      payerName,
      payerCpf
    } = body;

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
        Authorization: `Bearer ${accessToken}`,
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

    res.status(200).json({
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
}
