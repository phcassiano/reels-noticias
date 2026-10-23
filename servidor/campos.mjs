import {carregarMascara} from './mascaras.mjs';

// Formatos aceitos: mime → [tipo de mídia, extensão do arquivo salvo]
export const TIPOS_MIDIA = {
  'image/jpeg': ['foto', '.jpg'],
  'image/png': ['foto', '.png'],
  'image/webp': ['foto', '.webp'],
  'video/mp4': ['video', '.mp4'],
  'video/quicktime': ['video', '.mov'],
  'video/webm': ['video', '.webm'],
};

// Campos de texto aceitos (painel ou bot), já limpos.
export const lerCampos = (corpo) => {
  const texto = (v, max) => String(v ?? '').trim().slice(0, max);
  const lead = texto(corpo.lead, 400);
  if (!lead) throw new Error('Escreva o lead da notícia');
  const mascaraId = texto(corpo.mascaraId, 60) || 'padrao';
  carregarMascara(mascaraId); // valida
  const noticia = {lead};
  for (const [campo, max] of [
    ['editoria', 40],
    ['etiqueta', 30],
    ['credito', 60],
  ]) {
    const v = texto(corpo[campo], max);
    if (v) noticia[campo] = v;
  }
  if (corpo.pretoEBranco !== undefined && corpo.pretoEBranco !== '')
    noticia.pretoEBranco = corpo.pretoEBranco === true || corpo.pretoEBranco === 'true';
  const duracao = Number(corpo.duracaoFoto);
  if (duracao >= 3 && duracao <= 60) noticia.duracaoFoto = duracao;
  return {noticia, mascaraId, legenda: texto(corpo.legenda, 2200)};
};
