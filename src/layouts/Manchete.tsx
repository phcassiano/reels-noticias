import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {
  INICIO_PALAVRAS,
  MidiaAnimada,
  PASSO_PALAVRAS,
  Palavra,
  palavrasDoLead,
  useProgresso,
} from '../compartilhado';
import {FONTE_MANCHETE} from '../fontes';
import type {ReelProps} from '../tipos';
import {resolverSrc} from '../util';

// Layout "manchete": mídia no topo que se dissolve num fundo sólido, título grande
// (branco + destaque), subtítulo, marca centralizada e faixa colorida na lateral esquerda.
const MARGEM = 84;
const ALTURA_MIDIA = 1260;
const BASE_TEXTO = 1530; // fim do bloco de texto (o resto fica para a marca e a legenda do Reels)
const MARCA_Y = 1620;
const FAIXA = 16;

const FUNDO_PADRAO = '#001F3E';
const FAIXA_PADRAO = ['#DA00D3', '#FE1630', '#FFAA01', '#E1FF01', '#23FACE'];

const FaixaLateral: React.FC<{cores: string[]}> = ({cores}) => {
  const p = useProgresso(0, 22, 10);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: FAIXA,
        background: `linear-gradient(180deg, ${cores.join(', ')})`,
        transform: `scaleY(${p})`,
        transformOrigin: 'top',
      }}
    />
  );
};

const Etiqueta: React.FC<{texto: string; cor: string}> = ({texto, cor}) => {
  const p = useProgresso(14, 14, 4);
  return (
    <div
      style={{
        alignSelf: 'flex-start',
        marginBottom: 30,
        padding: '8px 24px 9px',
        border: `3px solid ${cor}`,
        borderRadius: 999,
        color: cor,
        fontWeight: 900,
        fontSize: 30,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
      }}
    >
      {texto}
    </div>
  );
};

const Marca: React.FC<ReelProps> = ({mascara}) => {
  const p = useProgresso(40, 16, 0);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: MARCA_Y,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: FONTE_MANCHETE,
        color: '#fff',
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
      }}
    >
      {mascara.logo ? (
        <Img src={resolverSrc(mascara.logo)} style={{height: 84, maxWidth: 560, objectFit: 'contain'}} />
      ) : (
        <>
          <div style={{fontWeight: 900, fontSize: 46, letterSpacing: '0.04em', textTransform: 'uppercase'}}>
            {mascara.perfil.nome}
          </div>
          <div style={{fontWeight: 400, fontSize: 28, opacity: 0.75, marginTop: 2}}>@{mascara.perfil.handle}</div>
        </>
      )}
    </div>
  );
};

export const Manchete: React.FC<ReelProps> = (props) => {
  const {noticia, mascara} = props;
  const fundo = mascara.cores.fundo ?? FUNDO_PADRAO;
  const pb = noticia.pretoEBranco ?? mascara.pretoEBranco ?? false;

  const palavras = palavrasDoLead(noticia.lead);
  const caracteres = palavras.reduce((n, p) => n + p.texto.length + 1, 0);
  const fonte = caracteres <= 40 ? 108 : caracteres <= 70 ? 94 : caracteres <= 100 ? 82 : caracteres <= 140 ? 72 : 62;
  const fimPalavras = INICIO_PALAVRAS + palavras.length * PASSO_PALAVRAS;
  const subtitulo = useProgresso(fimPalavras + 2, 16, 2);
  const credito = useProgresso(30, 14, 0);
  const etiqueta = noticia.etiqueta ?? noticia.editoria;

  return (
    <AbsoluteFill style={{backgroundColor: fundo, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: ALTURA_MIDIA, overflow: 'hidden'}}>
        <MidiaAnimada midia={noticia.midia} pb={pb} />
      </div>
      {/* a mídia se dissolve no fundo; leve escurecimento no topo para o crédito */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: ALTURA_MIDIA + 2,
          background: `linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 14%, ${fundo}00 42%, ${fundo}b3 70%, ${fundo} 100%)`,
        }}
      />
      <div
        style={{position: 'absolute', left: 0, right: 0, top: ALTURA_MIDIA, bottom: 0, background: fundo}}
      />

      {noticia.credito && (
        <div
          style={{
            position: 'absolute',
            top: 150,
            right: 60,
            fontFamily: FONTE_MANCHETE,
            fontWeight: 400,
            fontSize: 24,
            color: '#fff',
            padding: '5px 14px 6px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.45)',
            opacity: credito,
          }}
        >
          {noticia.credito}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: MARGEM,
          right: MARGEM,
          bottom: 1920 - BASE_TEXTO,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTE_MANCHETE,
        }}
      >
        {etiqueta && <Etiqueta texto={etiqueta} cor={mascara.cores.destaque} />}
        <div
          style={{
            fontWeight: 900,
            fontSize: fonte,
            lineHeight: 1.06,
            letterSpacing: '-0.012em',
            color: '#fff',
            textShadow: '0 4px 30px rgba(0,0,0,0.25)',
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
        {noticia.subtitulo && (
          <div
            style={{
              marginTop: 40,
              fontWeight: 400,
              fontSize: 46,
              lineHeight: 1.24,
              color: '#fff',
              opacity: subtitulo,
              transform: `translateY(${(1 - subtitulo) * 18}px)`,
            }}
          >
            {noticia.subtitulo}
          </div>
        )}
      </div>

      <Marca {...props} />
      <FaixaLateral cores={mascara.cores.faixa ?? FAIXA_PADRAO} />
      {mascara.overlayPng && (
        <AbsoluteFill>
          <Img src={resolverSrc(mascara.overlayPng)} style={{width: '100%', height: '100%'}} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
