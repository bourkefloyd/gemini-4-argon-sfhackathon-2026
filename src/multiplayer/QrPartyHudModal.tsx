/**
 * Clean, Instant "Scan to Play on Your Phone" QR Modal (`src/multiplayer/QrPartyHudModal.tsx`)
 *
 * Displays a crisp black-on-white SVG QR code pointing directly to the permanent
 * public GitHub Pages game link so anyone can scan and play Marble Madness SDF
 * directly on their phone with zero install.
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { PartyRoomClient } from './party-client';
import { renderQrSvg } from './qr-svg';

export const PERMANENT_GAME_URL =
  'https://bourkefloyd.github.io/gemini-4-argon-sfhackathon-2026/';

export interface QrPartyHudModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly client?: PartyRoomClient;
  readonly roomCode?: string;
  readonly onSynthesizeCrowdTwist?: (combinedPrompt: string) => void;
}

export const QrPartyHudModal: React.FC<QrPartyHudModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [qrSvgMarkup, setQrSvgMarkup] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    void renderQrSvg(PERMANENT_GAME_URL, {
      sizePx: 280,
      marginModules: 4,
      title: 'SCAN TO PLAY MARBLE MADNESS SDF ON YOUR PHONE',
    }).then((svg) => {
      if (!cancelled) setQrSvgMarkup(svg);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopyUrl = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(PERMANENT_GAME_URL);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard fallback ignored
    }
  }, []);

  if (!isOpen) return null;

  return (
    <aside
      className="qr-party-hud-modal"
      data-testid="qr-party-hud-modal"
      role="dialog"
      aria-label="Scan to Play Marble Madness SDF on Your Phone"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(5, 9, 20, 0.85)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'rgba(11, 18, 34, 0.96)',
          border: '1.5px solid rgba(56, 189, 248, 0.5)',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.88), 0 0 40px rgba(56, 189, 248, 0.18)',
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: '21px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: '#f8fafc',
            }}
          >
            SCAN TO PLAY MARBLE MADNESS SDF ON YOUR PHONE
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '13px',
              fontWeight: 600,
              color: '#38bdf8',
              letterSpacing: '0.02em',
            }}
          >
            Instant Zero-Install WebGL2 SDF Game • Drag Anywhere as a Virtual Trackball
          </p>
        </div>

        <div
          data-testid="qr-svg-container"
          style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(56, 189, 248, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
        />

        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <a
            href={PERMANENT_GAME_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="party-join-url"
            style={{
              display: 'block',
              padding: '10px 12px',
              background: '#070b14',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '10px',
              fontFamily: 'monospace',
              fontSize: '13px',
              fontWeight: 700,
              color: '#38bdf8',
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {PERMANENT_GAME_URL}
          </a>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '4px',
            }}
          >
            <button
              type="button"
              data-testid="copy-permanent-url-btn"
              onClick={() => void handleCopyUrl()}
              style={{
                background: copied
                  ? 'linear-gradient(135deg, #059669, #10b981)'
                  : 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied Link!' : 'Copy Game Link'}
            </button>

            <button
              type="button"
              data-testid="close-qr-party-modal"
              onClick={onClose}
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '10px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Back to Game [ESC]
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
