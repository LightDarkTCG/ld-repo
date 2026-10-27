export default async function handler(req: any, res: any) {
  const accessToken = (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  const publicKey = (process.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim();

  res.status(200).json({
    configured: Boolean(accessToken),
    publicKey
  });
}
