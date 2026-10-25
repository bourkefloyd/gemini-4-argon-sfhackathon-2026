/**
 * ISO/IEC 18004 QR SVG (`src/multiplayer/qr-svg.ts`)
 *
 * Renders a scannable black-on-white SVG with a 4-module quiet zone via the
 * `qrcode` package (byte mode, ECC level M). iPhone Camera rejects the previous
 * hand-rolled matrix (near-black ink, 3-module margin, broken version 6+ blocks).
 */

import QRCode from 'qrcode';

export interface QrSvgOptions {
  /** Pixel width/height of the rendered SVG (default: 240) */
  readonly sizePx?: number;
  /** Quiet zone in modules. Always at least 4 (ISO/IEC 18004). */
  readonly marginModules?: number;
  /** Ignored. Modules are always #000000 so phone cameras lock on. */
  readonly darkColor?: string;
  /** Ignored. Background is always #ffffff. */
  readonly lightColor?: string;
  /** Optional rounded finder eye accent color (unused; kept for call-site compatibility) */
  readonly finderAccentColor?: string;
  /** Accessible title for screen readers */
  readonly title?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripXmlDeclaration(svg: string): string {
  return svg.replace(/^\uFEFF?\s*<\?xml[^?]*\?>\s*/i, '').trim();
}

/**
 * Renders a scannable `<svg>` QR code. Colors are forced to black on white and
 * the quiet zone is 4 modules, regardless of legacy color options.
 */
export async function renderQrSvg(text: string, options: QrSvgOptions = {}): Promise<string> {
  const payload = text.trim() || 'http://localhost:5173/?party=1';
  const sizePx = options.sizePx ?? 240;
  const margin = Math.max(4, options.marginModules ?? 4);
  const title = options.title ?? `QR Code for ${payload}`;
  const raw = await QRCode.toString(payload, {
    type: 'svg',
    margin,
    errorCorrectionLevel: 'M',
    width: sizePx,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
  const svg = stripXmlDeclaration(raw);
  const safeTitle = escapeXml(title);
  if (svg.includes('<title>')) return svg;
  return svg.replace(
    /<svg\b([^>]*)>/i,
    `<svg$1 role="img" aria-label="${safeTitle}"><title>${safeTitle}</title>`,
  );
}
