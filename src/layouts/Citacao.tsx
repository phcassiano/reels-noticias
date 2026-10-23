import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  INICIO_PALAVRAS,
  MidiaAnimada,
  PASSO_PALAVRAS,
  Palavra,
  palavrasDoLead,
  SAIDA,
  useProgresso,
} from '../compartilhado';
import {FONTE} from '../fontes';
import type {ReelProps} from '../tipos';
import {resolverSrc} from '../util';

// Layout "citação": mídia em tela cheia, círculo com aspas/logo, etiqueta e texto com barra vertical.
// Geometria em 1080x1920, proporcional ao modelo.
const MARGEM_ESQ = 142;
const BARRA_V = 14;
const TEXTO_X = 285;
const TEXTO_FIM = 1000;
const BLOCO_BASE = 1700; // onde termina a assinatura (fora da zona da legenda do Reels)
const TOPO_Y = 300; // centro vertical do círculo e da etiqueta
const CIRCULO = 210;
const CIRCULO_X = 243; // centro horizontal do círculo

const Circulo: React.FC<ReelProps> = ({mascara}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const pop = spring({frame: frame - 12, fps, config: {damping: 11, mass: 0.7}});
  const sai = interpolate(frame, [durationInFrames - SAIDA + 4, durationInFrames - 4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.back(1.6)),
  });
  const icone = useProgresso(20, 12, 2);
  return (
    <div
      style={{
        position: 'absolute',
        left: CIRCULO_X - CIRCULO / 2,
        top: TOPO_Y - CIRCULO / 2,
        width: CIRCULO,
        height: CIRCULO,
        borderRadius: '50%',
        background: mascara.cores.destaque,
        transform: `scale(${pop * sai})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}
    >
      {mascara.logo ? (
        <Img
          src={resolverSrc(mascara.logo)}
          style={{width: '74%', height: '74%', objectFit: 'contain', opacity: icone}}
        />
      ) : (
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontWeight: 700,
            fontSize: 190,
            lineHeight: 1,
            height: 100,
            marginTop: 10,
            color: mascara.cores.textoSobreDestaque ?? '#fff',
            opacity: icone,
            transform: `rotate(${(1 - icone) * -40}deg)`,
          }}
        >
          {'”'}
        </div>
      )}
    </div>
  );
};

const Etiqueta: React.FC<ReelProps> = ({noticia, mascara}) => {
  const frame = useCurrentFrame();
  const texto = noticia.etiqueta ?? (noticia.editoria ? `#${noticia.editoria}` : '');
  const caixa = useProgresso(4, 12, 4);
  const digitado = Math.round(
    interpolate(frame, [14, 14 + Math.min(18, texto.length * 1.2)], [0, texto.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  if (!texto) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: 1080 - TEXTO_FIM,
        top: TOPO_Y,
        transform: 'translateY(-50%)',
        padding: '4px 14px 6px',
        background: mascara.cores.etiquetaFundo ?? '#fff',
        color: mascara.cores.etiquetaTexto ?? '#1a1a1a',
        fontFamily: FONTE,
        fontWeight: 700,
        fontSize: 44,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        // a caixa abre da direita para a esquerda, como no modelo
        clipPath: `inset(0 0 0 ${(1 - caixa) * 100}%)`,
      }}
    >
      {/* texto completo invisível fixa a largura; o visível é "digitado" por cima */}
      <span style={{visibility: 'hidden'}}>{texto}</span>
      <span style={{position: 'absolute', left: 14, top: 4}}>{texto.slice(0, digitado)}</span>
    </div>
  );
};

const BlocoTexto: React.FC<ReelProps> = ({noticia, mascara}) => {
  const palavras = palavrasDoLead(noticia.lead);
  const caracteres = palavras.reduce((n, p) => n + p.texto.length + 1, 0);
  const fonte = caracteres <= 70 ? 76 : caracteres <= 110 ? 66 : caracteres <= 150 ? 58 : 52;
  const fimPalavras = INICIO_PALAVRAS + palavras.length * PASSO_PALAVRAS;

  const barra = useProgresso(18, 16, 6);
  const assinatura = useProgresso(fimPalavras + 4, 16, 2);
  const detalhe = useProgresso(fimPalavras + 10, 14, 0);
  const linha2 = [`@${mascara.perfil.handle}`, noticia.credito].filter(Boolean).join('  ·  ');

  return (
    <div
      style={{
        position: 'absolute',
        left: MARGEM_ESQ,
        right: 1080 - TEXTO_FIM,
        bottom: 1920 - BLOCO_BASE,
        display: 'flex',
        gap: TEXTO_X - MARGEM_ESQ - BARRA_V,
        fontFamily: FONTE,
      }}
    >
      <div
        style={{
          width: BARRA_V,
          flexShrink: 0,
          background: mascara.cores.destaque,
          transform: `scaleY(${barra})`,
          transformOrigin: 'top',
        }}
      />
      <div style={{paddingTop: 6}}>
        <div
          style={{
            fontWeight: 700,
            fontSize: fonte,
            lineHeight: 1.16,
            letterSpacing: '-0.01em',
            color: '#fff',
            textShadow: '0 2px 24px rgba(0,0,0,0.35)',
          }}
        >
          {palavras.map((p, i) => (
            <Palavra
              key={i}
              indice={i}
              total={palavras.length}
              texto={p.texto}
              cor={p.destaque ? mascara.cores.destaque : '#fff'}
            />
          ))}
        </div>
        <div
          style={{
            marginTop: 44,
            fontWeight: 700,
            fontSize: 40,
            color: 'rgba(255,255,255,0.88)',
            textTransform: 'uppercase',
            letterSpacing: `${0.22 + (1 - assinatura) * 0.3}em`,
            opacity: assinatura,
          }}
        >
          {mascara.perfil.nome}
        </div>
        <div
          style={{
            marginTop: 8,
            fontWeight: 600,
            fontSize: 25,
            color: 'rgba(255,255,255,0.85)',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            opacity: detalhe,
            transform: `translateY(${(1 - detalhe) * 14}px)`,
          }}
        >
          {linha2}
        </div>
      </div>
    </div>
  );
};

const BarraInferior: React.FC<ReelProps> = ({mascara}) => {
  const p = useProgresso(8, 18, 8);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 30,
        width: `${p * 100}%`,
        background: mascara.cores.destaque,
      }}
    />
  );
};

export const Citacao: React.FC<ReelProps> = (props) => {
  const {noticia, mascara} = props;
  const pb = noticia.pretoEBranco ?? mascara.pretoEBranco ?? false;
  return (
    <AbsoluteFill style={{backgroundColor: '#111'}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <MidiaAnimada midia={noticia.midia} pb={pb} />
      </AbsoluteFill>
      {/* escurece só onde há texto, preservando a foto no meio */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.82) 100%)',
        }}
      />
      <Circulo {...props} />
      <Etiqueta {...props} />
      <BlocoTexto {...props} />
      <BarraInferior {...props} />
      {mascara.overlayPng && (
        <AbsoluteFill>
          <Img src={resolverSrc(mascara.overlayPng)} style={{width: '100%', height: '100%'}} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
