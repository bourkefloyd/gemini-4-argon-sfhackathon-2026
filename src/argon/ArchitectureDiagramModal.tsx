/**
 * In-drawer modal that shows the self-contained architecture diagram.
 * Judges can click blocks without leaving the Architect panel.
 */

import React, { useMemo } from 'react';
import {
  buildArchitectureDiagramHtml,
  type ArchitectureDiagramStats,
} from './architecture-diagram';

export interface ArchitectureDiagramModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly stats: ArchitectureDiagramStats;
}

export const ArchitectureDiagramModal: React.FC<ArchitectureDiagramModalProps> = ({
  open,
  onClose,
  stats,
}) => {
  const html = useMemo(() => buildArchitectureDiagramHtml(stats), [stats]);
  if (!open) return null;

  return (
    <div
      className="argon-diagram-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(2, 6, 14, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-label="How it works, 1M architecture diagram"
        data-testid="architecture-diagram-modal"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(960px, 100%)',
          height: 'min(640px, 100%)',
          background: '#07101c',
          border: '1px solid rgba(217, 107, 255, 0.55)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px' }}>
          <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#d96bff' }}>
            HOW IT WORKS / 1M DIAGRAM
          </strong>
          <button type="button" className="hud-btn hud-btn-sm" onClick={onClose}>
            CLOSE
          </button>
        </div>
        <iframe
          title="Marble Madness SDF architecture diagram"
          sandbox="allow-scripts"
          srcDoc={html}
          style={{ flex: 1, width: '100%', border: 0, background: '#07101c' }}
        />
      </div>
    </div>
  );
};
