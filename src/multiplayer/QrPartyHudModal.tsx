/**
 * Stage Projector QR Code Party HUD Modal & Live Crowd Feed (`src/multiplayer/QrPartyHudModal.tsx`)
 *
 * Displays:
 * - Zero-dependency scannable SVG QR Code (`renderQrSvg`)
 * - Auto-detected LAN IPv4 URL + Editable Public Tunnel URL (for 5G/LTE & AP-isolated venue Wi-Fi)
 * - 1-Click "🤖 Simulate 6 Crowd Phones" Stage Button (spawns 6 autonomous racers & crowd architects)
 * - Live Arena Racers Roster (Up to 8 Marbles), Crowd CSG Toast Feed, and Argon 1M Twist Queue
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPartyRoomClient, type PartyRoomClient } from './party-client';
import type { PartyRoomSnapshot } from './party-types';
import { renderQrSvg } from './qr-svg';

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
  client: externalClient,
  roomCode = 'ARGON',
  onSynthesizeCrowdTwist,
}) => {
  const [internalClient] = useState<PartyRoomClient>(() =>
    externalClient ?? createPartyRoomClient({ roomCode }),
  );
  const activeClient = externalClient ?? internalClient;

  const [snapshot, setSnapshot] = useState<PartyRoomSnapshot>(() =>
    activeClient.getSnapshot(),
  );
  const [tunnelInput, setTunnelInput] = useState<string>(
    () => activeClient.getSnapshot().customTunnelUrl ?? '',
  );
  const [simulatingCrowd, setSimulatingCrowd] = useState<boolean>(false);

  useEffect(() => {
    const unsub = activeClient.subscribe((snap) => {
      setSnapshot(snap);
    });
    return () => {
      unsub();
    };
  }, [activeClient]);

  useEffect(() => {
    if (!simulatingCrowd) return;
    const interval = window.setInterval(() => {
      void activeClient.simulateCrowdPhones(6, true);
    }, 350);
    return () => window.clearInterval(interval);
  }, [activeClient, simulatingCrowd]);

  const qrSvgMarkup = useMemo(
    () =>
      renderQrSvg(snapshot.joinUrl, {
        sizePx: 210,
        marginModules: 3,
        darkColor: '#050811',
        lightColor: '#ffffff',
        title: `Join Marble Madness Party Room ${snapshot.roomCode}`,
      }),
    [snapshot.joinUrl, snapshot.roomCode],
  );

  const handleApplyTunnelUrl = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = tunnelInput.trim();
      await activeClient.setCustomTunnelUrl(cleaned.length > 0 ? cleaned : null);
    },
    [activeClient, tunnelInput],
  );

  const handleSimulateSixPhones = useCallback(async () => {
    await activeClient.simulateCrowdPhones(6, false);
    setSimulatingCrowd(true);
  }, [activeClient]);

  const handleSelectRoom = useCallback(
    async (targetRoomId: string) => {
      await activeClient.selectRoom(targetRoomId);
    },
    [activeClient],
  );

  const handleMaxMarblesChange = useCallback(
    async (maxMarbles: number) => {
      await activeClient.setMaxMarblesPerRoom(maxMarbles);
    },
    [activeClient],
  );

  const handleSynthesizeClick = useCallback(() => {
    if (!onSynthesizeCrowdTwist) return;
    const topTwists = snapshot.crowdPrompts
      .slice(0, 3)
      .map((p) => p.twist)
      .join(' + ');
    onSynthesizeCrowdTwist(
      topTwists || 'low gravity ice pinball + triple portal abyss leap',
    );
  }, [onSynthesizeCrowdTwist, snapshot.crowdPrompts]);

  if (!isOpen) return null;

  const focusedRoomPlayers = snapshot.roomPlayers ?? snapshot.players;
  const racers = focusedRoomPlayers.filter((p) => p.role === 'racer');
  const roomsSummary = snapshot.allRoomsSummary ?? [
    {
      roomId: snapshot.roomId ?? `${snapshot.roomCode}-1`,
      roomIndex: snapshot.roomIndex ?? 1,
      playerCount: racers.length,
      maxPlayers: snapshot.maxMarblesPerRoom ?? 4,
      isFull: racers.length >= (snapshot.maxMarblesPerRoom ?? 4),
      leaderName: racers[0]?.handle ?? null,
    },
  ];

  return (
    <aside
      className="qr-party-hud-modal"
      data-testid="qr-party-hud-modal"
      role="dialog"
      aria-label="Multiplayer QR Party Arena"
      style={{
        position: 'fixed',
        inset: '20px',
        zIndex: 60,
        background: 'rgba(7, 11, 22, 0.94)',
        backdropFilter: 'blur(14px)',
        border: '1.5px solid rgba(56, 189, 248, 0.45)',
        borderRadius: '18px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Banner */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          background: 'rgba(15, 23, 42, 0.9)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#38bdf8',
              textTransform: 'uppercase',
            }}
          >
            WI-FI & 5G/LTE STAGE PARTY MODE • ROOM {snapshot.roomCode}
          </div>
          <h2 style={{ margin: '2px 0 0', fontSize: '19px', fontWeight: 800 }}>
            Scan to Roll a Glass Marble or Sculpt the SDF Track Live!
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            data-testid="simulate-crowd-phones-btn"
            onClick={() => void handleSimulateSixPhones()}
            style={{
              background: simulatingCrowd
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : 'linear-gradient(135deg, #f59e0b, #ea580c)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
            }}
          >
            {simulatingCrowd
              ? '🤖 6 Crowd Phones Active!'
              : '🤖 Simulate 6 Crowd Phones'}
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
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Stage [ESC]
          </button>
        </div>
      </header>

      {/* Active Rooms Rail (Auto-Overflow Switcher) */}
      <div
        data-testid="active-rooms-rail"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 20px',
          background: 'rgba(9, 14, 26, 0.92)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.22)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.07em',
              color: '#94a3b8',
              textTransform: 'uppercase',
              marginRight: '4px',
            }}
          >
            ACTIVE ROOMS RAIL:
          </span>
          {roomsSummary.map((rm) => {
            const isSelected = rm.roomId === snapshot.roomId;
            const statusLabel = rm.isFull
              ? `${rm.playerCount}/${rm.maxPlayers} FULL`
              : `${rm.playerCount}/${rm.maxPlayers} ACTIVE`;
            return (
              <button
                key={rm.roomId}
                type="button"
                data-testid={`room-pill-${rm.roomId}`}
                onClick={() => void handleSelectRoom(rm.roomId)}
                style={{
                  background: isSelected
                    ? 'linear-gradient(135deg, #0284c7, #2563eb)'
                    : 'rgba(30, 41, 59, 0.85)',
                  color: '#f8fafc',
                  border: isSelected
                    ? '1.5px solid #38bdf8'
                    : rm.isFull
                      ? '1px solid rgba(250, 204, 21, 0.5)'
                      : '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '999px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>
                  {rm.roomId} ({statusLabel})
                </span>
                {rm.leaderName && (
                  <span style={{ fontSize: '10px', color: '#bae6fd', fontWeight: 600 }}>
                    ★ @{rm.leaderName}
                  </span>
                )}
              </button>
            );
          })}
          <span
            data-testid="auto-overflow-ready-pill"
            style={{
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#6ee7b7',
              border: '1px dashed rgba(52, 211, 153, 0.5)',
              borderRadius: '999px',
              padding: '5px 11px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            + Auto-Overflow Ready ({snapshot.roomCode}-{roomsSummary.length + 1})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#cbd5e1' }}>
          <span>Room Cap:</span>
          {[4, 6, 8].map((cap) => (
            <button
              key={cap}
              type="button"
              data-testid={`room-cap-btn-${cap}`}
              onClick={() => void handleMaxMarblesChange(cap)}
              style={{
                background:
                  snapshot.maxMarblesPerRoom === cap ? '#0ea5e9' : '#1e293b',
                color: '#ffffff',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {cap}/room
            </button>
          ))}
        </div>
      </div>

      {/* Main 3-Column Stage Layout */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr 1fr',
          gap: '16px',
          padding: '16px 20px',
          overflowY: 'auto',
        }}
      >
        {/* Column 1: Scannable SVG QR Code & Venue Wi-Fi / Tunnel Override */}
        <section
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            data-testid="qr-svg-container"
            style={{
              background: '#ffffff',
              padding: '10px',
              borderRadius: '14px',
              boxShadow: '0 8px 24px rgba(56, 189, 248, 0.25)',
            }}
            dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
          />

          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
              INSTANT JOIN URL (&lt;20 KB CONTROLLER)
            </div>
            <div
              data-testid="party-join-url"
              style={{
                marginTop: '4px',
                padding: '6px 8px',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#38bdf8',
                wordBreak: 'break-all',
              }}
            >
              {snapshot.joinUrl}
            </div>
          </div>

          {/* Editable Public Tunnel / Join Base URL for AP-Isolated Venue Wi-Fi & 5G */}
          <form
            onSubmit={(e) => void handleApplyTunnelUrl(e)}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: '4px',
            }}
          >
            <label
              htmlFor="party-tunnel-url-input"
              style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}
            >
              5G / Venue Tunnel Override (AP Isolation Bypass):
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                id="party-tunnel-url-input"
                data-testid="party-tunnel-url-input"
                type="text"
                placeholder="https://argon-demo.trycloudflare.com"
                value={tunnelInput}
                onChange={(e) => setTunnelInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '12px',
                }}
              />
              <button
                type="submit"
                data-testid="apply-tunnel-url-btn"
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Set URL
              </button>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
              Tip: npx cloudflared tunnel --url http://localhost:5173
            </div>
          </form>
        </section>

        {/* Column 2: Arena Racers (8 Glass Marbles) + Crowd Chaos Roster */}
        <section
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '0.06em',
              }}
            >
              {snapshot.roomId} RACERS ({racers.length}/{snapshot.maxMarblesPerRoom} MARBLES)
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              {snapshot.players.length} Total Crowd ({roomsSummary.length} Rooms)
            </span>
          </div>

          <div
            data-testid="party-racer-roster"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {snapshot.leaderboard.length === 0 ? (
              <div
                style={{
                  padding: '18px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '13px',
                  border: '1px dashed #334155',
                  borderRadius: '10px',
                }}
              >
                Scan the QR code or click &ldquo;Simulate 6 Crowd Phones&rdquo; to populate the arena!
              </div>
            ) : (
              focusedRoomPlayers.slice(0, 10).map((entry) => (
                <div
                  key={entry.playerId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.65)',
                    borderLeft: `4px solid ${entry.colorHex}`,
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <strong style={{ color: '#f8fafc' }}>@{entry.handle}</strong>{' '}
                    <span
                      style={{
                        fontSize: '11px',
                        color: entry.role === 'racer' ? '#38bdf8' : '#facc15',
                        marginLeft: '6px',
                      }}
                    >
                      {entry.role === 'racer' && entry.racerSlot !== null
                        ? `${entry.roomId} • Marble #${entry.racerSlot + 1}`
                        : `${entry.roomId} • Crowd Architect`}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#facc15' }}>
                    {entry.score} pts
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Column 3: Live Crowd CSG Toast Feed + Argon 1M Twist Swarm */}
        <section
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(192, 132, 252, 0.28)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: '#22d3ee',
                letterSpacing: '0.06em',
                marginBottom: '8px',
              }}
            >
              LIVE CROWD SDF MUTATION FEED ({snapshot.activeMutations.length} ACTIVE CSG)
            </div>
            <div
              data-testid="party-toast-feed"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '170px',
                overflowY: 'auto',
              }}
            >
              {snapshot.recentToasts.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '6px 10px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderLeft: `3px solid ${t.accentColor}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                  }}
                >
                  {t.text}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#c084fc',
                  letterSpacing: '0.06em',
                }}
              >
                ✨ ARGON 1M CROWD TWIST SWARM
              </span>
              {onSynthesizeCrowdTwist && (
                <button
                  type="button"
                  data-testid="synthesize-crowd-twist-btn"
                  onClick={handleSynthesizeClick}
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Synthesize Top Twists
                </button>
              )}
            </div>

            <div
              data-testid="party-crowd-prompts"
              style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              {snapshot.crowdPrompts.slice(0, 5).map((prm) => (
                <div
                  key={prm.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    background: 'rgba(88, 28, 135, 0.25)',
                    border: '1px solid rgba(192, 132, 252, 0.35)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                >
                  <span>
                    &ldquo;{prm.twist}&rdquo;{' '}
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                      by @{prm.playerHandle}
                    </span>
                  </span>
                  <strong style={{ color: '#e9d5ff' }}>▲ {prm.votes}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};
