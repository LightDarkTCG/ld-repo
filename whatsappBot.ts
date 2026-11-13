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
let currentSessionId = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let cachedVersion: [number, number, number] | null = null;

let botState: WhatsAppBotStatus = {
  status: 'disconnected',
  qrDataUrl: null,
  pairingCode: null,
  connectedPhone: null,
  lastError: null
};

// Pre-fetch Baileys version in background so QR generation is instant
fetchLatestBaileysVersion()
  .then((res) => {
    if (res?.version) cachedVersion = res.version;
  })
  .catch(() => {});

export function getWhatsAppBotStatus(): WhatsAppBotStatus {
  return { ...botState };
}

export async function startWhatsAppBot(options?: {
  usePairingCode?: boolean;
  phoneNumber?: string;
  forceReset?: boolean;
}): Promise<WhatsAppBotStatus> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (options?.forceReset) {
    await disconnectWhatsAppBot(true);
  }

  if (botState.status === 'connected' && sock && !options?.forceReset) {
    return getWhatsAppBotStatus();
  }

  const sessionId = ++currentSessionId;
  botState = {
    status: 'connecting',
    qrDataUrl: null,
    pairingCode: null,
    connectedPhone: null,
    lastError: null
  };

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    if (sessionId !== currentSessionId) {
      return getWhatsAppBotStatus();
    }

    let version: [number, number, number] = cachedVersion || [2, 3000, 1015901307];
    if (!cachedVersion) {
      try {
        const vRes = await Promise.race([
          fetchLatestBaileysVersion(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        if (vRes?.version) {
          cachedVersion = vRes.version;
          version = vRes.version;
        }
      } catch {
        // use default version
      }
    }

    if (sessionId !== currentSessionId) {
      return getWhatsAppBotStatus();
    }

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

    newSock.ev.on('creds.update', () => {
      if (sessionId === currentSessionId) {
        saveCreds().catch(() => {});
      }
    });

    newSock.ev.on('connection.update', async (update) => {
      if (sessionId !== currentSessionId) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr && !options?.usePairingCode) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 300,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          if (sessionId === currentSessionId) {
            botState.qrDataUrl = dataUrl;
            botState.status = 'qr_ready';
            botState.lastError = null;
          }
        } catch (err: any) {
          console.error('Erro ao gerar QRCode:', err);
          if (sessionId === currentSessionId) {
            botState.lastError = 'Erro ao renderizar imagem do QR Code.';
          }
        }
      }

      if (connection === 'open') {
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
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (isLoggedOut) {
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
            lastError: 'Sessão encerrada ou desconectada pelo celular. Clique em "Gerar QR Code" para reconectar.'
          };
        } else {
          // Reconnect automatically to refresh QR or resume connection
          reconnectTimer = setTimeout(() => {
            if (sessionId === currentSessionId) {
              startWhatsAppBot({
                usePairingCode: options?.usePairingCode,
                phoneNumber: options?.phoneNumber,
                forceReset: false
              }).catch(() => {});
            }
          }, 1500);
        }
      }
    });

    if (options?.usePairingCode && options.phoneNumber && !state.creds.registered) {
      const cleanNumber = options.phoneNumber.replace(/\D/g, '');
      const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
      await new Promise((r) => setTimeout(r, 1800));
      if (sessionId === currentSessionId) {
        try {
          const code = await newSock.requestPairingCode(fullNumber);
          if (sessionId === currentSessionId) {
            botState.pairingCode = code;
            botState.qrDataUrl = null;
            botState.status = 'qr_ready';
            botState.lastError = null;
          }
        } catch (pairErr: any) {
          if (sessionId === currentSessionId) {
            botState.lastError =
              pairErr?.message || 'Não foi possível gerar o código de 8 dígitos. Tente usar o botão Gerar QR Code.';
          }
        }
      }
    }
  } catch (err: any) {
    if (sessionId === currentSessionId) {
      botState.status = 'disconnected';
      botState.lastError = err?.message || 'Falha ao iniciar conexão com WhatsApp.';
    }
  }

  return getWhatsAppBotStatus();
}

export async function disconnectWhatsAppBot(clearSession = true): Promise<void> {
  currentSessionId++;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    if (sock) {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
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

if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
  startWhatsAppBot().catch(() => {});
}
