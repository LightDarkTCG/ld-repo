import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.resolve(process.cwd(), '.whatsapp_auth');

export interface WhatsAppBotStatus {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected';
  qrDataUrl: string | null;
  pairingCode: string | null;
  connectedPhone: string | null;
  lastError: string | null;
}

let sock: ReturnType<typeof makeWASocket> | null = null;
let botState: WhatsAppBotStatus = {
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: null,
  lastError: null
};
let isInitializing = false;

export function getWhatsAppBotStatus(): WhatsAppBotStatus {
  return { ...botState };
}

export async function startWhatsAppBot(options?: {
  usePairingCode?: boolean;
  phoneNumber?: string;
  forceReset?: boolean;
}): Promise<WhatsAppBotStatus> {
  if (options?.forceReset) {
    await disconnectWhatsAppBot(true);
  }

  if (botState.status === 'connected' && sock) {
    return getWhatsAppBotStatus();
  }

  if (isInitializing && !options?.usePairingCode) {
    return getWhatsAppBotStatus();
  }

  isInitializing = true;
  botState.status = 'connecting';
  botState.lastError = null;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307] as [number, number, number]
    }));

    const logger = pino({ level: 'silent' });

    const newSock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    sock = newSock;

    newSock.ev.on('creds.update', saveCreds);

    newSock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 280,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          botState.qrDataUrl = dataUrl;
          botState.status = 'qr_ready';
        } catch (err) {
          console.error('Erro ao gerar QRCode:', err);
        }
      }

      if (connection === 'open') {
        isInitializing = false;
        const rawId = newSock.user?.id || '';
        const cleanPhone = rawId.split(':')[0].split('@')[0];
        botState = {
          status: 'connected',
          qrDataUrl: null,
          pairingCode: null,
          connectedPhone: cleanPhone || '5534992166735',
          lastError: null
        };
      }

      if (connection === 'close') {
        isInitializing = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch {
            // ignore
          }
          sock = null;
          botState = {
            status: 'disconnected',
            qrDataUrl: null,
            pairingCode: null,
            connectedPhone: null,
            lastError: 'Sessão encerrada pelo celular.'
          };
        } else if (shouldReconnect) {
          setTimeout(() => {
            startWhatsAppBot().catch(() => {});
          }, 2500);
        } else {
          botState.status = 'disconnected';
        }
      }
    });

    if (options?.usePairingCode && options.phoneNumber && !state.creds.registered) {
      const cleanNumber = options.phoneNumber.replace(/\D/g, '');
      const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const code = await newSock.requestPairingCode(fullNumber);
        botState.pairingCode = code;
        botState.status = 'qr_ready';
      } catch (pairErr: any) {
        botState.lastError = pairErr?.message || 'Erro ao solicitar código de pareamento.';
      }
    }
  } catch (err: any) {
    isInitializing = false;
    botState.status = 'disconnected';
    botState.lastError = err?.message || 'Falha ao iniciar conexão com WhatsApp.';
  }

  return getWhatsAppBotStatus();
}

export async function disconnectWhatsAppBot(clearSession = true): Promise<void> {
  isInitializing = false;
  try {
    if (sock) {
      sock.end(undefined);
      sock = null;
    }
  } catch {
    // ignore
  }
  if (clearSession) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  botState = {
    status: 'disconnected',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    lastError: null
  };
}

export async function sendDirectWhatsAppMessage(
  phoneRaw: string,
  text: string
): Promise<{ ok: boolean; jid?: string; error?: string }> {
  if (!sock || botState.status !== 'connected') {
    return {
      ok: false,
      error: 'WhatsApp ainda não está conectado no painel.'
    };
  }

  try {
    const digits = phoneRaw.replace(/\D/g, '');
    const withCountry = digits.startsWith('55') ? digits : `55${digits}`;

    // Build candidate numbers (with 9th digit and without 9th digit for Brazilian DDDs like 34)
    const candidates: string[] = [withCountry];
    if (withCountry.length === 13 && withCountry.startsWith('55') && withCountry[4] === '9') {
      candidates.push(withCountry.slice(0, 4) + withCountry.slice(5));
    } else if (withCountry.length === 12 && withCountry.startsWith('55')) {
      candidates.push(withCountry.slice(0, 4) + '9' + withCountry.slice(4));
    }

    let targetJid: string | null = null;

    for (const candidate of candidates) {
      try {
        const results = await sock.onWhatsApp(candidate);
        if (results && results.length > 0 && results[0].exists && results[0].jid) {
          targetJid = results[0].jid;
          break;
        }
      } catch {
        // fallback below
      }
    }

    // If sending to the same number that is connected, or if onWhatsApp didn't resolve, fallback to connected user or candidate JID
    if (!targetJid) {
      if (sock.user?.id) {
        const ownUser = sock.user.id.split(':')[0];
        if (candidates.some((c) => ownUser.includes(c.slice(-8)))) {
          targetJid = `${ownUser}@s.whatsapp.net`;
        }
      }
    }

    if (!targetJid) {
      targetJid = `${candidates[0]}@s.whatsapp.net`;
    }

    await sock.sendMessage(targetJid, { text });
    return { ok: true, jid: targetJid };
  } catch (err: any) {
    console.error('Erro ao enviar mensagem via Baileys:', err);
    return {
      ok: false,
      error: err?.message || 'Erro ao enviar mensagem pelo WhatsApp conectado.'
    };
  }
}

// Auto-resume existing session if credentials already exist on disk
if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
  startWhatsAppBot().catch(() => {});
}
