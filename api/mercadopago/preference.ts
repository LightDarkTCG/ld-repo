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
      items,
      shippingCost,
      discountAmount,
      payer,
      originUrl
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'O carrinho está vazio.' });
      return;
    }

    const discountRatio =
      Number(discountAmount) > 0
        ? Math.max(
            0,
            1 -
              Number(discountAmount) /
                items.reduce(
                  (acc: number, it: any) => acc + Number(it.unitPrice) * Number(it.quantity || 1),
                  0
                )
          )
        : 1;

    const mpItems = items.map((item: any, idx: number) => ({
      id: String(item.id || `item-${idx + 1}`),
      title: String(item.title || 'Produto Light Dark TCG').slice(0, 250),
      description: String(
        item.variationName ? `${item.title} - ${item.variationName}` : item.title
      ).slice(0, 250),
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
        Authorization: `Bearer ${accessToken}`,
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

    res.status(200).json({
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
}
