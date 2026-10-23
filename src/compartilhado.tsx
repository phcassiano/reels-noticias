import React from 'react';
import {Easing, Img, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Midia} from './tipos';
import {resolverSrc} from './util';

export const SAIDA = 16; // frames da animação de saída

export const suave = Easing.bezier(0.22, 1, 0.36, 1);

// Progresso 0→1 de entrada no intervalo [ini, ini+dur], e volta a 0 nos últimos frames.
export const useProgresso = (ini: number, dur: number, atrasoSaida = 0) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const entrada = interpolate(frame, [ini, ini + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: suave,
  });
  const iniSaida = durationInFrames - SAIDA + atrasoSaida;
  const saida = interpolate(frame, [iniSaida, iniSaida + 9], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  return Math.min(entrada, saida);
};

export const MidiaAnimada: React.FC<{midia: Midia; pb: boolean}> = ({midia, pb}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  // Zoom de entrada rápido (1.16 → 1.05) e depois um afastamento lento até 1.0.
  const entrada = interpolate(frame, [0, 40], [0.11, 0], {
    extrapolateRight: 'clamp',
    easing: suave,
  });
  const deriva = interpolate(frame, [0, durationInFrames], [0.05, 0]);
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${1 + entrada + deriva})`,
    filter: pb ? 'grayscale(1) contrast(1.12) brightness(1.02)' : 'saturate(1.05)',
  };
  return midia.tipo === 'video' ? (
    <OffthreadVideo src={resolverSrc(midia.src)} style={style} />
  ) : (
    <Img src={resolverSrc(midia.src)} style={style} />
  );
};

// Separa o lead em palavras, marcando as que estão entre *asteriscos*.
export const palavrasDoLead = (lead: string) =>
  lead
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .flatMap((trecho) => {
      const destaque = trecho.startsWith('*') && trecho.endsWith('*');
      return trecho
        .replace(/^\*|\*$/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((texto) => ({texto, destaque}));
    });

export const INICIO_PALAVRAS = 24;
export const PASSO_PALAVRAS = 1.6;

// Palavra que sobe de dentro de uma máscara; entra em cascata e, na saída, as últimas descem primeiro.
export const Palavra: React.FC<{texto: string; cor: string; indice: number; total: number}> = ({
  texto,
  cor,
  indice,
  total,
}) => {
  const p = useProgresso(
    INICIO_PALAVRAS + indice * PASSO_PALAVRAS,
    14,
    Math.max(0, 6 - (total - indice) * 0.4)
  );
  return (
    <span
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        padding: '0.12em 0 0.14em',
        margin: '-0.12em 0.24em -0.14em 0',
        verticalAlign: 'top',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          color: cor,
          transform: `translateY(${(1 - p) * 115}%)`,
        }}
      >
        {texto}
      </span>
    </span>
  );
};
