import { CardData } from './types';

export interface DeckCardEntry {
  code: string;
  qty: number;
  card?: CardData;
}

export interface ParsedDeckData {
  isValid: boolean;
  isDeckBuilderCode: boolean;
  mainDeck: DeckCardEntry[];
  sideDeck: DeckCardEntry[];
  totalMainCount: number;
  totalSideCount: number;
  totalCount: number;
  rawDeckBuilderCode: string;
  missingCodes: string[];
}

const normalizeCode = (val: string | undefined | null) => 
  (val ? String(val) : '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

/**
 * Helper to parse a card code into structured components:
 * year, set, letter prefix (e.g. 'B'), and numeric value.
 */
function parseCardCodeParts(code: string | undefined | null) {
  if (!code) return null;
  const parts = String(code).trim().split('/');
  if (parts.length === 3) {
    const rawNum = parts[2];
    const match = rawNum.match(/^([a-zA-Z]*)(\d+)$/);
    if (match) {
      return {
        year: parts[0],
        set: parts[1],
        letter: match[1].toUpperCase(),
        num: parseInt(match[2], 10)
      };
    }
  }
  return null;
}

/**
 * Encodes a single card into an ultra-short token:
 * - 2025/0001/00042 -> "42"
 * - 2025/0001/B0152 -> "B152"
 * - 2026/0001/00301 -> "2.301"
 * - 2026/0002/00315 -> "3.315"
 * - If Modern frame -> appends "m" (e.g. "152m")
 */
export function encodeCardToken(card: CardData): string {
  const code = (card.code || card.id || '').trim();
  const isMod = card.frame === 'Moderno' || (card.id && card.id.includes('-MOD'));
  const modSuffix = isMod ? 'm' : '';

  const parsed = parseCardCodeParts(code);
  if (!parsed) {
    return `${code}${modSuffix}`;
  }

  const { year, set, letter, num } = parsed;
  let pfx = '';
  if (year === '2025' && set === '0001') {
    pfx = '';
  } else if (year === '2026' && set === '0001') {
    pfx = '2.';
  } else if (year === '2026' && set === '0002') {
    pfx = '3.';
  } else {
    pfx = `${year.slice(2)}_${parseInt(set, 10)}.`;
  }

  return `${pfx}${letter}${num}${modSuffix}`;
}

/**
 * Encodes a complete deck (Main + Side) into an ultra-compact string:
 * Format: "LDT:1,2,3,4...;31,32,33"
 * Size is typically ~70-150 characters (compared to ~900 characters in previous Base64 JSON).
 */
export function encodeDeckCode(mainDeck: CardData[], sideDeck: CardData[] = []): string {
  const mainPart = (mainDeck || []).map(encodeCardToken).join(',');
  const sidePart = (sideDeck || []).map(encodeCardToken).join(',');
  if (sidePart) {
    return `LDT:${mainPart};${sidePart}`;
  }
  return `LDT:${mainPart}`;
}

/**
 * Decodes a single token back to CardData from the available cards list
 */
export function decodeCardToken(token: string, cards: CardData[]): CardData | null {
  token = (token || '').trim();
  if (!token) return null;

  const isMod = token.endsWith('m') || token.endsWith('M');
  const clean = isMod ? token.slice(0, -1) : token;

  let targetYear = '2025';
  let targetSet = '0001';
  let rest = clean;

  if (clean.includes('.')) {
    const [pfx, numPart] = clean.split('.');
    rest = numPart;
    if (pfx === '2') {
      targetYear = '2026';
      targetSet = '0001';
    } else if (pfx === '3') {
      targetYear = '2026';
      targetSet = '0002';
    } else if (pfx.includes('_')) {
      const [y, s] = pfx.split('_');
      targetYear = y.length === 2 ? `20${y}` : y;
      targetSet = s.padStart(4, '0');
    }
  }

  const matchLetterNum = rest.match(/^([a-zA-Z]*)(\d+)$/);
  if (matchLetterNum) {
    const targetLetter = matchLetterNum[1].toUpperCase();
    const targetNum = parseInt(matchLetterNum[2], 10);

    // 1. Try frame-exact match first
    let match = cards.find(c => {
      const pk = parseCardCodeParts(c.code);
      if (!pk) return false;
      if (pk.year !== targetYear || parseInt(pk.set, 10) !== parseInt(targetSet, 10)) return false;
      if (pk.letter !== targetLetter || pk.num !== targetNum) return false;
      if (isMod) {
        return c.frame === 'Moderno' || (c.id && c.id.includes('-MOD'));
      } else {
        return c.frame !== 'Moderno';
      }
    });
    if (match) return match;

    // 2. Try match without frame requirement
    match = cards.find(c => {
      const pk = parseCardCodeParts(c.code);
      if (!pk) return false;
      return pk.year === targetYear && parseInt(pk.set, 10) === parseInt(targetSet, 10) && pk.letter === targetLetter && pk.num === targetNum;
    });
    if (match) return match;
  }

  // 3. Fallback: Direct code or name match
  const norm = (s?: string) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanNorm = norm(clean);

  const fallback = cards.find(c => {
    return norm(c.code) === cleanNorm || norm(c.id) === cleanNorm || norm(c.name) === cleanNorm;
  });

  return fallback || null;
}

/**
 * Universal deck decoder supporting:
 * 1. Compact LDT format ("LDT:1,2,3;31,32")
 * 2. Legacy Base64 JSON ("eyJtYWluIjp...")
 * 3. Raw JSON ({ main: [...], side: [...] })
 * 4. Plain comma or newline separated card codes
 */
export function decodeDeckCode(
  rawInput: string | undefined | null,
  cards: CardData[]
): { main: CardData[]; side: CardData[]; missingCount: number; isValid: boolean } {
  if (!rawInput || typeof rawInput !== 'string') {
    return { main: [], side: [], missingCount: 0, isValid: false };
  }
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { main: [], side: [], missingCount: 0, isValid: false };
  }

  const cardsList = Array.isArray(cards) ? cards : [];
  const mainList: CardData[] = [];
  const sideList: CardData[] = [];
  let missing = 0;

  // 1. Compact LDT format
  if (trimmed.startsWith('LDT:') || trimmed.startsWith('ldt:') || trimmed.startsWith('LDT1:')) {
    const content = trimmed.replace(/^LDT1?:/i, '').trim();
    const [mainStr, sideStr] = content.split(';');

    if (mainStr) {
      const tokens = mainStr.split(',').map(t => t.trim()).filter(Boolean);
      for (const t of tokens) {
        const found = decodeCardToken(t, cardsList);
        if (found) mainList.push(found);
        else missing++;
      }
    }

    if (sideStr) {
      const tokens = sideStr.split(',').map(t => t.trim()).filter(Boolean);
      for (const t of tokens) {
        const found = decodeCardToken(t, cardsList);
        if (found) sideList.push(found);
        else missing++;
      }
    }

    return {
      main: mainList,
      side: sideList,
      missingCount: missing,
      isValid: mainList.length > 0 || sideList.length > 0
    };
  }

  // 2. Base64 JSON (Legacy Deck Builder format) or Raw JSON
  let parsedJson: any = null;
  try {
    const decoded = atob(trimmed);
    parsedJson = JSON.parse(decoded);
  } catch {
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      parsedJson = null;
    }
  }

  if (parsedJson && typeof parsedJson === 'object') {
    let rawMain: string[] = [];
    let rawSide: string[] = [];

    if (Array.isArray(parsedJson)) {
      rawMain = parsedJson;
    } else {
      if (Array.isArray(parsedJson.main)) rawMain = parsedJson.main;
      if (Array.isArray(parsedJson.side)) rawSide = parsedJson.side;
    }

    for (const code of rawMain) {
      const found = decodeCardToken(code, cardsList);
      if (found) mainList.push(found);
      else missing++;
    }

    for (const code of rawSide) {
      const found = decodeCardToken(code, cardsList);
      if (found) sideList.push(found);
      else missing++;
    }

    return {
      main: mainList,
      side: sideList,
      missingCount: missing,
      isValid: mainList.length > 0 || sideList.length > 0
    };
  }

  // 3. Fallback: Comma/newline separated list
  const lines = trimmed.split(/[\n,]/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const found = decodeCardToken(line, cardsList);
    if (found) mainList.push(found);
    else missing++;
  }

  return {
    main: mainList,
    side: sideList,
    missingCount: missing,
    isValid: mainList.length > 0
  };
}

/**
 * Parses deck codes from either:
 * 1. Ultra-compact LDT format: LDT:1,2,3;31,32
 * 2. Legacy Base64 encoded string generated by the Deck Builder: btoa(JSON.stringify({ main: string[], side: string[] }))
 * 3. Raw JSON string: { main: [...], side: [...] } or [...]
 * 4. Comma/newline separated codes with optional multipliers: "3x 2026/0001/00301, 2025/0001/00001"
 */
export function parseDeckFromCode(rawInput: string | undefined | null, allCards?: CardData[]): ParsedDeckData {
  const emptyResult: ParsedDeckData = {
    isValid: false,
    isDeckBuilderCode: false,
    mainDeck: [],
    sideDeck: [],
    totalMainCount: 0,
    totalSideCount: 0,
    totalCount: 0,
    rawDeckBuilderCode: '',
    missingCodes: []
  };

  if (!rawInput || typeof rawInput !== 'string') return emptyResult;
  const trimmed = rawInput.trim();
  if (!trimmed) return emptyResult;

  const cardsList = Array.isArray(allCards) ? allCards : [];

  // 1. Try Compact LDT format first
  if (trimmed.startsWith('LDT:') || trimmed.startsWith('ldt:') || trimmed.startsWith('LDT1:')) {
    const decoded = decodeDeckCode(trimmed, cardsList);
    const groupCardList = (list: CardData[]): DeckCardEntry[] => {
      const map = new Map<string, { qty: number; card: CardData }>();
      for (const c of list) {
        const key = c.code || c.id || c.name;
        const existing = map.get(key);
        if (existing) {
          existing.qty++;
        } else {
          map.set(key, { qty: 1, card: c });
        }
      }
      return Array.from(map.entries()).map(([code, item]) => ({
        code,
        qty: item.qty,
        card: item.card
      }));
    };

    const mainDeck = groupCardList(decoded.main);
    const sideDeck = groupCardList(decoded.side);

    return {
      isValid: decoded.isValid,
      isDeckBuilderCode: true,
      mainDeck,
      sideDeck,
      totalMainCount: decoded.main.length,
      totalSideCount: decoded.side.length,
      totalCount: decoded.main.length + decoded.side.length,
      rawDeckBuilderCode: trimmed,
      missingCodes: []
    };
  }

  let parsedJson: any = null;
  let isDeckBuilderCode = false;

  // 2. Try Base64 decoding (legacy Deck Builder format)
  try {
    const decoded = atob(trimmed);
    parsedJson = JSON.parse(decoded);
    isDeckBuilderCode = true;
  } catch {
    // 3. Try direct JSON parsing
    try {
      parsedJson = JSON.parse(trimmed);
      isDeckBuilderCode = true;
    } catch {
      parsedJson = null;
    }
  }

  const findCard = (code: string | undefined | null): CardData | undefined => {
    if (!code) return undefined;
    const safeCode = String(code).trim();
    if (!safeCode) return undefined;
    const safeCodeLower = safeCode.toLowerCase();
    const normalizedTarget = normalizeCode(safeCode);

    return cardsList.find(c => {
      if (!c) return false;
      const cCode = c.code ? String(c.code).trim() : '';
      const cName = c.name ? String(c.name).trim() : '';
      return (
        (cCode !== '' && cCode === safeCode) || 
        (cCode !== '' && normalizeCode(cCode) === normalizedTarget) ||
        (cName !== '' && cName.toLowerCase() === safeCodeLower)
      );
    });
  };

  const groupCodes = (codes: (string | undefined | null)[]): { entries: DeckCardEntry[]; missing: string[] } => {
    const counts = new Map<string, number>();
    const originalCodes = new Map<string, string>();

    for (const rawC of codes) {
      if (!rawC) continue;
      const c = String(rawC).trim();
      if (!c) continue;
      const key = normalizeCode(c);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!originalCodes.has(key)) {
        originalCodes.set(key, c);
      }
    }

    const entries: DeckCardEntry[] = [];
    const missing: string[] = [];

    for (const [key, qty] of counts.entries()) {
      const orig = originalCodes.get(key) || key;
      const card = findCard(orig);
      if (!card) {
        missing.push(orig);
      }
      entries.push({
        code: card && card.code ? card.code : orig,
        qty,
        card
      });
    }

    return { entries, missing };
  };

  // If successfully parsed from Deck Builder JSON/Base64
  if (parsedJson && (typeof parsedJson === 'object')) {
    let mainCodesRaw: string[] = [];
    let sideCodesRaw: string[] = [];

    if (Array.isArray(parsedJson)) {
      mainCodesRaw = parsedJson;
    } else {
      if (Array.isArray(parsedJson.main)) mainCodesRaw = parsedJson.main;
      if (Array.isArray(parsedJson.side)) sideCodesRaw = parsedJson.side;
    }

    const { entries: mainDeck, missing: missingMain } = groupCodes(mainCodesRaw);
    const { entries: sideDeck, missing: missingSide } = groupCodes(sideCodesRaw);

    const totalMainCount = mainCodesRaw.length;
    const totalSideCount = sideCodesRaw.length;

    // Convert to compact LDT code
    let rawDeckBuilderCode = trimmed;
    try {
      const flatMainCards: CardData[] = [];
      mainDeck.forEach(entry => {
        for (let i = 0; i < entry.qty; i++) {
          flatMainCards.push(entry.card || ({ code: entry.code } as any));
        }
      });
      const flatSideCards: CardData[] = [];
      sideDeck.forEach(entry => {
        for (let i = 0; i < entry.qty; i++) {
          flatSideCards.push(entry.card || ({ code: entry.code } as any));
        }
      });
      rawDeckBuilderCode = encodeDeckCode(flatMainCards, flatSideCards);
    } catch {
      rawDeckBuilderCode = trimmed;
    }

    return {
      isValid: mainDeck.length > 0 || sideDeck.length > 0,
      isDeckBuilderCode: true,
      mainDeck,
      sideDeck,
      totalMainCount,
      totalSideCount,
      totalCount: totalMainCount + totalSideCount,
      rawDeckBuilderCode,
      missingCodes: [...missingMain, ...missingSide]
    };
  }

  // 3. Fallback: Parse line-by-line or comma-separated list
  const rawEntries = trimmed
    .split(/[,\n]/)
    .map(entry => entry.trim())
    .filter(Boolean);

  const flatMainCodes: string[] = [];
  const entries: DeckCardEntry[] = [];
  const missing: string[] = [];
  const flatCards: CardData[] = [];

  for (const entry of rawEntries) {
    const match = entry.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    let qty = 1;
    let codeRaw = entry;
    if (match) {
      qty = parseInt(match[1], 10) || 1;
      codeRaw = match[2].trim();
    }

    const card = findCard(codeRaw);
    const finalCode = card && card.code ? card.code : codeRaw;
    if (!card) {
      missing.push(codeRaw);
    }

    for (let i = 0; i < qty; i++) {
      flatMainCodes.push(finalCode);
      if (card) flatCards.push(card);
      else flatCards.push({ code: finalCode } as any);
    }

    entries.push({
      code: finalCode,
      qty,
      card
    });
  }

  let generatedCompactCode = '';
  try {
    generatedCompactCode = encodeDeckCode(flatCards, []);
  } catch {
    generatedCompactCode = '';
  }

  return {
    isValid: entries.length > 0,
    isDeckBuilderCode: false,
    mainDeck: entries,
    sideDeck: [],
    totalMainCount: flatMainCodes.length,
    totalSideCount: 0,
    totalCount: flatMainCodes.length,
    rawDeckBuilderCode: generatedCompactCode,
    missingCodes: missing
  };
}

/**
 * Helper to parse a code segment into prefix and numeric value for natural sorting.
 * Handles standard numbers ("00001" -> 1), booster/promo variants ("B0001" -> prefix "B", num 1, "0B188" -> prefix "B", num 188),
 * and general alphanumeric formats ("BIC-01" -> prefix "BIC", num 1).
 */
function parseCodeSegment(seg: string): { prefix: string; num: number | null; raw: string } {
  const s = seg.trim();
  if (/^\d+$/.test(s)) {
    return { prefix: "", num: parseInt(s, 10), raw: s };
  }
  const matchB = s.match(/^0?([a-zA-Z]+)(\d+)$/);
  if (matchB) {
    return { prefix: matchB[1].toUpperCase(), num: parseInt(matchB[2], 10), raw: s };
  }
  const matchGen = s.match(/^([a-zA-Z\-_]*?)(\d+)$/);
  if (matchGen) {
    return { prefix: matchGen[1].toUpperCase(), num: parseInt(matchGen[2], 10), raw: s };
  }
  return { prefix: s.toUpperCase(), num: null, raw: s };
}

function compareSegments(segA: string, segB: string): number {
  const pA = parseCodeSegment(segA);
  const pB = parseCodeSegment(segB);

  // If both have numbers: compare numerical values first!
  // This ensures A0301 (card 301 variation) comes before card 00302
  if (pA.num !== null && pB.num !== null && pA.num !== pB.num) {
    return pA.num - pB.num;
  }

  // Same number (e.g. 00301 vs A0301 vs B0301): base card (empty prefix) comes first
  if (pA.prefix !== pB.prefix) {
    if (pA.prefix === "") return -1;
    if (pB.prefix === "") return 1;
    const prefCmp = pA.prefix.localeCompare(pB.prefix, undefined, { sensitivity: 'base' });
    if (prefCmp !== 0) return prefCmp;
  }

  return segA.localeCompare(segB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Robust natural/numerical sorting comparison for card codes.
 * Ensures cards are ordered by set and numeric index (e.g. 00001, 00002, 00010, 0011, 00100).
 * Handles multi-sheet standard sets (e.g. 2026/0001/00314 followed by 2026/0002/00315, and 00449 followed by 00450 through 00453 Melty).
 */
export function compareCardCodes(codeA?: string | null, codeB?: string | null): number {
  if (!codeA && !codeB) return 0;
  if (!codeA) return 1;
  if (!codeB) return -1;

  const rawA = String(codeA).trim();
  const rawB = String(codeB).trim();

  if (rawA === rawB) return 0;

  // Clean suffixes like -MOD, -M, -ALT so variations/modern frames stay directly alongside their base code
  const cleanA = rawA.replace(/-(?:ALT|MOD|alt|mod|M)$/i, '').trim();
  const cleanB = rawB.replace(/-(?:ALT|MOD|alt|mod|M)$/i, '').trim();

  const partsA = cleanA.split('/');
  const partsB = cleanB.split('/');

  if (partsA.length === 3 && partsB.length === 3) {
    // 1. Year comparison
    const yearCmp = compareSegments(partsA[0], partsB[0]);
    if (yearCmp !== 0) return yearCmp;

    // Check if middle segments are standard release sheets (0001, 0002, etc. < 100)
    const isStdSheet = (s: string) => {
      const n = parseInt(s, 10);
      return !isNaN(n) && n < 100;
    };
    const stdA = isStdSheet(partsA[1]);
    const stdB = isStdSheet(partsB[1]);

    if (stdA && stdB) {
      // Both standard sequential sheets: compare card number (parts[2]) first!
      // This ensures 00314 (sheet 1) is immediately followed by 00315 (sheet 2),
      // 00449 (sheet 2) is followed by 00450 (sheet 1), and Melty (00453) is at the very end!
      const numCmp = compareSegments(partsA[2], partsB[2]);
      if (numCmp !== 0) return numCmp;
      const sheetCmp = compareSegments(partsA[1], partsB[1]);
      if (sheetCmp !== 0) return sheetCmp;
    } else if (stdA && !stdB) {
      return -1; // standard sets before special event sets (e.g. 1508)
    } else if (!stdA && stdB) {
      return 1;
    } else {
      // Both are special event sets (e.g. 1508): compare set code, then card number
      const sheetCmp = compareSegments(partsA[1], partsB[1]);
      if (sheetCmp !== 0) return sheetCmp;
      const numCmp = compareSegments(partsA[2], partsB[2]);
      if (numCmp !== 0) return numCmp;
    }
  } else if (partsA.length === partsB.length && partsA.length > 1) {
    for (let i = 0; i < partsA.length; i++) {
      const cmp = compareSegments(partsA[i], partsB[i]);
      if (cmp !== 0) return cmp;
    }
  } else {
    const cmp = compareSegments(cleanA, cleanB);
    if (cmp !== 0) return cmp;
  }

  // If base codes are equal, sort base before modern/alt
  return rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: 'base' });
}

export const STRUCTURAL_FLAGSHIP_HEROES: Record<string, string> = {
  'Insanis': 'Jim - O Senhor do Macroverso',
  'Príncipe do Macroverso': 'Jenos Senhor do Macroverso',
  'Mechs e Mangas': 'Spear Vellret',
  'Herdeiro do Caos': 'Mahina - O Herdeiro de Lúmeni',
  'Mundo em Chamas': 'Donnie - Samurai das Chamas',
  'Corruptor Profano': 'Otto - Arauto da Corrupção',
  'O Escolhido': 'Salazar - Guia dos Escolhidos',
  'Deusa da Lua': 'Selena - Deusa da Lua',
  'Invasão do Caos': 'Mahina - O Arauto do Véu'
};

export function isModernCard(card?: CardData | null): boolean {
  if (!card) return false;
  return card.frame === 'Moderno' || (typeof card.code === 'string' && (card.code.endsWith('-M') || card.code.endsWith('-MOD')));
}

/**
 * Normaliza o texto removendo acentos, pontuação, guilhotinas e espaços extras
 */
export function normalizeHeroText(val: string | undefined | null): string {
  if (!val) return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[«»"'"'`()\[\]]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Identifica a identidade central / família do herói pelo nome
 * Heróis com a mesma identidade base representam o mesmo personagem
 * (ex: Mahina Arauto do Véu, Estrategista Mahina, Equilíbrio Imperfeito Mahina, Mahina Herdeiro de Lúmeni são todos Mahina)
 */
export function getHeroIdentity(heroName: string | undefined | null): string | null {
  const norm = normalizeHeroText(heroName);
  if (!norm) return null;
  if (norm.includes('mahina')) return 'mahina';
  if (norm.includes('jenos')) return 'jenos';
  if (norm.includes('donnie')) return 'donnie';
  if (norm.includes('salazar')) return 'salazar';
  if (norm.includes('selena')) return 'selena';
  if (norm.includes('vellret') || norm.includes('spear')) return 'vellret';
  if (norm.includes('jim')) return 'jim';
  if (norm.includes('otto')) return 'otto';
  if (norm.includes('asmonious')) return 'asmonious';
  if (norm.includes('arqcuia')) return 'arqcuia';
  if (norm.includes('criven')) return 'criven';
  if (norm.includes('vasta')) return 'vasta';
  if (norm.includes('conceito caos')) return 'conceito_caos';
  if (norm.includes('linden')) return 'von_linden';
  if (norm.includes('labri')) return 'labri';
  return null;
}

/**
 * Verifica se a descrição de um herói cita o nome completo de outro herói
 */
function citesHeroFullName(desc: string | undefined | null, heroFullName: string | undefined | null): boolean {
  if (!desc || !heroFullName) return false;
  const cleanD = normalizeHeroText(desc);
  const cleanN = normalizeHeroText(heroFullName);
  if (!cleanD || !cleanN || cleanN.length < 3) return false;
  return cleanD.includes(cleanN);
}

/**
 * Verifica se dois heróis são compatíveis no mesmo deck de acordo com as regras:
 * 1. Pertencem à mesma identidade/personagem:
 *    - Mahina - O Arauto do Véu pode ser colocado com todos os outros Mahinas.
 *    - Jenos pode ser colocado com outros Jenos, Donnie com Donnie, Salazar com Salazar, etc.
 * 2. HEROIS COM NOMES DIFERENTES:
 *    - SOMENTE heróis que citem nomes completos de outros heróis podem ser combinados!
 *    - Exemplo: Salazar Sucumbido pelo Caos pode ser colocado com Conceito Caos, mas Conceito Caos NÃO pode ser colocado com outros Salazar's!
 *    - Von Linden + Selena Macroverso Inverso (somente Selena Macroverso Inverso, não outras Selenas)
 *    - Labri a Filha Imperfeita + Jenos Destinado (somente Jenos Destinado, não outros Jenos)
 *    - Otto - Arauto da Corrupção + Asmonious - O Corruptor (citado expressamente no efeito do Otto)
 */
export function areTwoHeroesCompatible(h1: CardData, h2: CardData): boolean {
  if (!h1 || !h2) return true;
  const name1 = normalizeHeroText(h1.name);
  const name2 = normalizeHeroText(h2.name);
  if (name1 === name2) return true;

  const id1 = getHeroIdentity(h1.name);
  const id2 = getHeroIdentity(h2.name);

  // 1. Mesma identidade/personagem (Ex: Mahina com Mahina, Jenos com Jenos, Donnie com Donnie, Salazar com Salazar, Selena com Selena, Vellret com Vellret, Jim com Jim)
  if (id1 && id2 && id1 === id2) {
    return true;
  }

  // 2. HEROIS COM NOMES DIFERENTES:
  // A) Citação direta do nome completo no efeito/descrição:
  if (citesHeroFullName(h1.description, h2.name) || citesHeroFullName(h2.description, h1.name)) {
    return true;
  }

  // B) Pares canônicos explícitos confirmados pelo criador:
  // - Salazar Sucumbido pelo Caos + Conceito Caos
  // (Conceito Caos pode ser colocado com Salazar Sucumbido pelo Caos, mas NUNCA com outros Salazars)
  const isSalazarSucumbidoAndCaos =
    (name1.includes('sucumbido') && name2.includes('conceito caos')) ||
    (name2.includes('sucumbido') && name1.includes('conceito caos'));
  if (isSalazarSucumbidoAndCaos) return true;

  // - Von Linden + Selena Macroverso Inverso
  // (Von Linden pode ser colocado com Selena Macroverso Inverso, mas NUNCA com outras Selenas como Deusa da Lua)
  const isVonLindenAndSelenaInverso =
    ((id1 === 'von_linden' && name2.includes('macroverso inverso')) ||
     (id2 === 'von_linden' && name1.includes('macroverso inverso')));
  if (isVonLindenAndSelenaInverso) return true;

  // - Labri a Filha Imperfeita + Jenos Destinado
  // (Labri pode ser colocada com Jenos Destinado, mas NUNCA com outros Jenos como Corrompido ou Senhor do Macroverso)
  const isLabriAndJenosDestinado =
    ((id1 === 'labri' && name2.includes('destinado')) ||
     (id2 === 'labri' && name1.includes('destinado')));
  if (isLabriAndJenosDestinado) return true;

  return false;
}

export function isHeroGroupValid(heroes: CardData[]): boolean {
  if (!heroes || heroes.length <= 1) return true;

  // Se todos os heróis compartilham da mesma identidade base (ex: todos são Mahina, todos Jenos, todos Donnie)
  const firstId = getHeroIdentity(heroes[0]?.name);
  if (firstId && heroes.every(h => getHeroIdentity(h?.name) === firstId)) {
    return true;
  }

  // Se há heróis com identidades diferentes, TODOS os pares dentro do grupo devem ser mutuamente compatíveis
  // (garante que se Conceito Caos estiver com Salazar Sucumbido pelo Caos, outro Salazar incompatível não possa entrar)
  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      if (!areTwoHeroesCompatible(heroes[i], heroes[j])) {
        return false;
      }
    }
  }

  return true;
}

export const STRUCTURAL_COLLECTIONS_ALIASES: Record<string, string> = {
  'jim': 'Insanis',
  'insanis': 'Insanis',
  'jenos': 'Príncipe do Macroverso',
  'principe do macroverso': 'Príncipe do Macroverso',
  'príncipe do macroverso': 'Príncipe do Macroverso',
  'herdeiro do caos': 'Herdeiro do Caos',
  'mahina': 'Herdeiro do Caos',
  'mechs e mangas': 'Mechs e Mangas',
  'vellret': 'Mechs e Mangas',
  'mundo em chamas': 'Mundo em Chamas',
  'donnie': 'Mundo em Chamas',
  'corruptor profano': 'Corruptor Profano',
  'otto': 'Corruptor Profano',
  'o escolhido': 'O Escolhido',
  'salazar': 'O Escolhido',
  'deusa da lua': 'Deusa da Lua',
  'selena': 'Deusa da Lua',
  'invasao do caos': 'Invasão do Caos',
  'invasão do caos': 'Invasão do Caos',
  'arauto do veu': 'Invasão do Caos',
  'arauto do véu': 'Invasão do Caos'
};

export function getStructuralDeck(collectionName: string, allCards: CardData[]): { mainDeck: CardData[]; sideDeck: CardData[] } {
  const normKey = (collectionName || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let targetCollection = STRUCTURAL_COLLECTIONS_ALIASES[normKey] || collectionName;

  // 1. Filter cards of that collection (case and accent insensitive)
  const targetNorm = targetCollection.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const collectionCards = (allCards || []).filter(c => {
    if (!c || !c.collection) return false;
    const cCollNorm = c.collection.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return cCollNorm === targetNorm;
  });

  if (collectionCards.length === 0) {
    return { mainDeck: [], sideDeck: [] };
  }

  // 2. Map every unique card name to its best modern version ("COLOQUE SOMENTE AS MODERNAS")
  const uniqueByName = new Map<string, CardData>();
  for (const card of collectionCards) {
    const key = (card.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!key) continue;

    if (!uniqueByName.has(key)) {
      let chosen = card;
      // If legacy, look for modern counterpart in allCards
      if (!isModernCard(chosen)) {
        const modernMatch = allCards.find(ac => 
          isModernCard(ac) && 
          (ac.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === key
        );
        if (modernMatch) {
          chosen = modernMatch;
        }
      }
      // Force frame to Moderno
      if (chosen.frame !== 'Moderno') {
        chosen = { ...chosen, frame: 'Moderno' as const };
      }
      uniqueByName.set(key, chosen);
    } else {
      // If existing is not modern but current is modern, upgrade
      const existing = uniqueByName.get(key)!;
      if (!isModernCard(existing) && isModernCard(card)) {
        uniqueByName.set(key, { ...card, frame: 'Moderno' as const });
      }
    }
  }

  // 3. Return all modern cards of the structural deck in mainDeck (exactly 30 cards)
  const cleanCards: CardData[] = Array.from(uniqueByName.values()).map(c => ({
    ...c,
    frame: 'Moderno' as const
  }));

  const mainDeck = [...cleanCards].sort((a, b) => compareCardCodes(a.code, b.code));

  return { mainDeck, sideDeck: [] };
}

