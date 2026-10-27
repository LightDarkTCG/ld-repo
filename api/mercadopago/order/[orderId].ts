export default async function handler(req: any, res: any) {
  const accessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    res.status(500).json({ error: 'Credenciais não configuradas.' });
    return;
  }

  try {
    const orderId = String(req.query?.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({ error: 'ID do pedido inválido.' });
      return;
    }

    const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc`;
    const mpResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
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
      res.status(200).json({ found: false, status: 'pending' });
      return;
    }

    res.status(200).json({
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
}
