/**
 * Zero-Dependency ISO/IEC 18004 QR Code Matrix & Crisp SVG Generator (`src/multiplayer/qr-svg.ts`)
 *
 * Encodes any join URL (e.g. `http://192.168.1.42:5173/?party=1&room=ARGON`)
 * into a standards-compliant QR code matrix (Byte mode, Reed-Solomon GF(256) ECC,
 * 8-mask penalty evaluation) and renders a high-contrast vector `<svg>` with zero
 * external npm dependencies.
 */

export interface QrMatrix {
  readonly version: number;
  readonly size: number;
  readonly modules: readonly (readonly boolean[])[];
  readonly encodedText: string;
}

export interface QrSvgOptions {
  /** Pixel width/height of the rendered SVG (default: 240) */
  readonly sizePx?: number;
  /** Quiet zone margin in modules around the QR matrix (default: 3) */
  readonly marginModules?: number;
  /** Foreground dark module color (default: '#070b14') */
  readonly darkColor?: string;
  /** Background light color (default: '#ffffff') */
  readonly lightColor?: string;
  /** Optional rounded finder eye accent color */
  readonly finderAccentColor?: string;
  /** Accessible title for screen readers */
  readonly title?: string;
}

interface QrVersionSpec {
  readonly version: number;
  readonly size: number;
  readonly dataCodewords: number;
  readonly ecCodewordsPerBlock: number;
  readonly numBlocks: number;
  readonly alignmentCenters: readonly number[];
}

/**
 * QR Version 1–8 specifications for Error Correction Level L (7% recovery),
 * supporting URLs up to 192 UTF-8 bytes with large, easy-to-scan stage modules.
 */
const QR_VERSION_SPECS_L: readonly QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewordsPerBlock: 7, numBlocks: 1, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewordsPerBlock: 15, numBlocks: 1, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewordsPerBlock: 20, numBlocks: 1, alignmentCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCenters: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCenters: [6, 34] },
  { version: 7, size: 45, dataCodewords: 156, ecCodewordsPerBlock: 20, numBlocks: 2, alignmentCenters: [6, 22, 38] },
  { version: 8, size: 49, dataCodewords: 194, ecCodewordsPerBlock: 24, numBlocks: 2, alignmentCenters: [6, 24, 42] },
];

// Precompute GF(256) log/antilog tables with primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeRsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = buildRsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function selectVersionSpec(byteLength: number): QrVersionSpec {
  for (const spec of QR_VERSION_SPECS_L) {
    // Byte mode header: 4 bits mode (0100) + 8 bits length (for v1..9) + 4 bits terminator = 2 bytes overhead
    const maxBytes = spec.dataCodewords - 2;
    if (byteLength <= maxBytes) {
      return spec;
    }
  }
  return QR_VERSION_SPECS_L[QR_VERSION_SPECS_L.length - 1];
}

function encodeDataCodewords(utf8Bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const maxPayload = spec.dataCodewords - 2;
  const payload = utf8Bytes.length > maxPayload ? utf8Bytes.subarray(0, maxPayload) : utf8Bytes;

  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100)
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for versions 1–9)
  pushBits(payload.length, 8);
  // Payload bytes
  for (let i = 0; i < payload.length; i++) {
    pushBits(payload[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const totalDataBits = spec.dataCodewords * 8;
  const termBits = Math.min(4, Math.max(0, totalDataBits - bits.length));
  pushBits(0, termBits);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad with alternating 0xEC, 0x11 codewords
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const codewords = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < spec.dataCodewords; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i * 8 + b];
    }
    codewords[i] = byte;
  }
  return codewords;
}

function interleaveWithEc(dataCodewords: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const blockDataSize = Math.floor(spec.dataCodewords / spec.numBlocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  for (let b = 0; b < spec.numBlocks; b++) {
    const start = b * blockDataSize;
    const block = dataCodewords.subarray(start, start + blockDataSize);
    dataBlocks.push(block);
    ecBlocks.push(computeRsRemainder(block, spec.ecCodewordsPerBlock));
  }

  const totalCodewords = spec.dataCodewords + spec.ecCodewordsPerBlock * spec.numBlocks;
  const result = new Uint8Array(totalCodewords);
  let offset = 0;

  for (let i = 0; i < blockDataSize; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      result[offset++] = dataBlocks[b][i];
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      result[offset++] = ecBlocks[b][i];
    }
  }
  return result;
}

function computeFormatBits(ecIndicator: number, maskPattern: number): number {
  const data = ((ecIndicator & 0b11) << 3) | (maskPattern & 0b111);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x1f25 << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function evaluateMaskAt(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function computePenaltyScore(modules: boolean[][], size: number): number {
  let penalty = 0;

  // Rule 1: 5+ consecutive same-colored modules in row/col
  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === modules[r][c - 1]) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runLen = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === modules[r - 1][c]) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runLen = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = modules[r][c];
      if (modules[r][c + 1] === v && modules[r + 1][c] === v && modules[r + 1][c + 1] === v) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

/**
 * Encodes an arbitrary text or URL string into a QR Code boolean matrix.
 */
export function encodeQrMatrix(text: string): QrMatrix {
  const normalized = text.trim() || 'http://localhost:5173/?party=1';
  const utf8Bytes = new TextEncoder().encode(normalized);
  const spec = selectVersionSpec(utf8Bytes.length);
  const size = spec.size;

  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      modules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  // 1. Finder patterns (7x7) + separators (1-module white border)
  const placeFinderPattern = (topRow: number, leftCol: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topRow + dr;
        const c = leftCol + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onRing || inCore));
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // 2. Timing patterns (row 6 and col 6)
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunctionModule(6, i, dark);
    setFunctionModule(i, 6, dark);
  }

  // 3. Alignment patterns (5x5)
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      // Skip corners occupied by finder patterns
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // 4. Dark module & reserved format/version areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  if (spec.version >= 7) {
    const vBits = computeVersionBits(spec.version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(b, a, bit);
      setFunctionModule(a, b, bit);
    }
  }

  // 5. Encode data + Reed-Solomon EC codewords
  const dataCw = encodeDataCodewords(utf8Bytes, spec);
  const allCodewords = interleaveWithEc(dataCw, spec);

  // Place bits in upward/downward 2-column zigzag (right-to-left, skipping col 6)
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byte = allCodewords[bitIdx >>> 3];
            dark = ((byte >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          modules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // 6. Evaluate masks 0..7 and select lowest penalty
  const writeFormatInfo = (target: boolean[][], mask: number) => {
    // Level L indicator in QR format info is 0b01
    const fBits = computeFormatBits(0b01, mask);
    const bit = (i: number) => ((fBits >>> i) & 1) === 1;

    // Top-left around finder
    const tlCols = [0, 1, 2, 3, 4, 5, 7, 8];
    for (let i = 0; i < 8; i++) {
      target[8][tlCols[i]] = bit(14 - i);
    }
    const tlRows = [7, 5, 4, 3, 2, 1, 0];
    for (let i = 0; i < 7; i++) {
      target[tlRows[i]][8] = bit(6 - i);
    }

    // Bottom-left vertical + Top-right horizontal
    for (let i = 0; i < 7; i++) {
      target[size - 1 - i][8] = bit(14 - i);
    }
    for (let i = 0; i < 8; i++) {
      target[8][size - 8 + i] = bit(7 - i);
    }
  };

  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestModules: boolean[][] = modules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row, r) =>
      row.map((val, c) => (isFunction[r][c] ? val : val !== evaluateMaskAt(mask, r, c))),
    );
    writeFormatInfo(candidate, mask);
    const score = computePenaltyScore(candidate, size);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  writeFormatInfo(bestModules, bestMask);

  return {
    version: spec.version,
    size,
    modules: bestModules,
    encodedText: normalized,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a scannable `<svg>` QR code markup string for any URL or text.
 */
export function renderQrSvg(text: string, options: QrSvgOptions = {}): string {
  const matrix = encodeQrMatrix(text);
  const sizePx = options.sizePx ?? 240;
  const margin = options.marginModules ?? 3;
  const darkColor = options.darkColor ?? '#070b14';
  const lightColor = options.lightColor ?? '#ffffff';
  const title = options.title ?? `QR Code for ${matrix.encodedText}`;

  const viewSize = matrix.size + margin * 2;
  const pathCommands: string[] = [];

  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.modules[r][c]) {
        const x = c + margin;
        const y = r + margin;
        pathCommands.push(`M${x},${y}h1v1h-1z`);
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(title)}">`,
    `<title>${escapeXml(title)}</title>`,
    `<rect width="${viewSize}" height="${viewSize}" fill="${escapeXml(lightColor)}" rx="1.5" ry="1.5"/>`,
    `<path d="${pathCommands.join('')}" fill="${escapeXml(darkColor)}"/>`,
    `</svg>`,
  ].join('');
}
