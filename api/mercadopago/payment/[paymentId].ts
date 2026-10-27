export default async function handler(req: any, res: any) {
  const accessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    res.status(500).json({ error: 'Credenciais não configuradas.' });
    return;
  }

  try {
    const paymentId = String(req.query?.paymentId || '').replace(/\D/g, '');
    if (!paymentId) {
      res.status(400).json({ error: 'ID de pagamento inválido.' });
      return;
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const mpData: any = await mpResponse.json();
    if (!mpResponse.ok) {
      res.status(mpResponse.status).json({ error: mpData?.message || 'Pagamento não encontrado.' });
      return;
    }

    res.status(200).json({
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
}
