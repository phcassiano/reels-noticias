// Bot do Telegram: mande foto/vídeo + lead, revise com botões e receba o Reel pronto.
// Usa long polling, então funciona sem endereço público (inclusive num PC em casa).
import {Bot, GrammyError, InlineKeyboard, InputFile} from 'grammy';
import {createWriteStream, existsSync, copyFileSync, rmSync, statSync} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {SAIDAS, UPLOADS} from './caminhos.mjs';
import {lerCampos, TIPOS_MIDIA} from './campos.mjs';
import {anotar, aoMudar, atualizar, criar, novoId, obter, remover} from './fila.mjs';
import {mensagemDeErroIa, sugerir} from './ia.mjs';
import {listarMascaras} from './mascaras.mjs';

const LIMITE_DOWNLOAD = 20 * 1024 * 1024; // limite da API pública de bots para baixar arquivos
const LIMITE_ENVIO = 50 * 1024 * 1024; // limite para o bot enviar arquivos
const INTERVALO_PROGRESSO = 3000;

const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);
const leadHtml = (t) => esc(t).replace(/\*([^*]+)\*/g, '<b><u>$1</u></b>');
const semMarcacao = (t) => t.replace(/\*/g, '');
const ou = (v) => (v ? esc(v) : '<i>—</i>');

const CAMPOS_EDITAVEIS = {
  lead: {nome: 'lead', pedido: 'Mande o novo lead. Use *asteriscos* para destacar palavras.', max: 400},
  subtitulo: {nome: 'subtítulo', pedido: 'Mande o subtítulo (aparece na máscara Manchete). Envie - para remover.', max: 160},
  etiqueta: {nome: 'etiqueta', pedido: 'Mande a etiqueta (ex: #Política ou Urgente). Envie - para remover.', max: 30},
  editoria: {nome: 'editoria', pedido: 'Mande a editoria (ex: Economia). Envie - para remover.', max: 40},
  credito: {nome: 'crédito', pedido: 'Mande o crédito (ex: Foto: Agência Brasil). Envie - para remover.', max: 60},
  legenda: {nome: 'legenda', pedido: 'Mande a legenda do post. Envie - para remover.', max: 2200},
};

export const iniciarBot = ({token, autorizados, apiRoot}) => {
  const raiz = apiRoot || 'https://api.telegram.org';
  const bot = new Bot(token, {client: {apiRoot: raiz}});
  // chatId → rascunho em andamento (perde-se num reinício; a mídia já enviada é descartada)
  const rascunhos = new Map();

  const liberado = (de) =>
    de && (autorizados.has(String(de.id)) || (de.username && autorizados.has(`@${de.username.toLowerCase()}`)));

  bot.use(async (ctx, next) => {
    if (liberado(ctx.from)) return next();
    if (ctx.from)
      console.log(`Telegram: acesso negado para ${ctx.from.id} (@${ctx.from.username ?? '-'}, ${ctx.from.first_name})`);
    if (ctx.chat?.type === 'private' && ctx.message)
      await ctx.reply(
        `Este bot é privado. Seu ID do Telegram é <code>${ctx.from.id}</code>: peça para incluí-lo em TELEGRAM_AUTORIZADOS.`,
        {parse_mode: 'HTML'}
      );
    else if (ctx.callbackQuery) await ctx.answerCallbackQuery({text: 'Sem permissão'});
  });

  // ---------- rascunho ----------

  const descartarRascunho = (chatId) => {
    const r = rascunhos.get(chatId);
    // mídia de rascunho novo ainda não pertence a nenhum post
    if (r?.arquivoMidia && !r.postId) rmSync(path.join(UPLOADS, r.arquivoMidia), {force: true});
    rascunhos.delete(chatId);
  };

  const mascaraPadrao = () => listarMascaras()[0];

  const novoRascunho = (chatId) => {
    const mascara = mascaraPadrao();
    const r = {
      id: novoId(),
      campos: {lead: '', subtitulo: '', etiqueta: '', editoria: '', credito: '', legenda: '', mascaraId: mascara.id},
      pretoEBranco: Boolean(mascara.pretoEBranco),
    };
    rascunhos.set(chatId, r);
    return r;
  };

  const textoCartao = (r) => {
    const mascaras = listarMascaras();
    const mascara = mascaras.find((m) => m.id === r.campos.mascaraId);
    const midia = r.tipoMidia === 'video' ? '🎥 Vídeo' : r.tipoMidia === 'foto' ? '📷 Foto' : '⚠️ Falta a mídia';
    const legenda = r.campos.legenda
      ? `<i>${esc(r.campos.legenda.length > 350 ? `${r.campos.legenda.slice(0, 350)}…` : r.campos.legenda)}</i>`
      : '<i>—</i>';
    return [
      `${r.postId ? '✏️ <b>Editando Reel</b>' : '🎬 <b>Novo Reel</b>'} · ${midia}`,
      '',
      `<b>Lead:</b> ${r.campos.lead ? leadHtml(r.campos.lead) : '<i>falta o lead</i>'}`,
      `<b>Subtítulo:</b> ${ou(r.campos.subtitulo)}`,
      `<b>Etiqueta:</b> ${ou(r.campos.etiqueta)}   <b>Editoria:</b> ${ou(r.campos.editoria)}`,
      `<b>Crédito:</b> ${ou(r.campos.credito)}`,
      `<b>Máscara:</b> ${esc(mascara?.nome ?? r.campos.mascaraId)} · P&amp;B: ${r.pretoEBranco ? 'sim' : 'não'}`,
      '',
      `<b>Legenda do post:</b>\n${legenda}`,
      r.aviso ? `\n${r.aviso}` : '',
    ].join('\n');
  };

  const tecladoCartao = (r) => {
    const t = new InlineKeyboard();
    if (r.tipoMidia && r.campos.lead) t.text(r.postId ? '✅ Salvar e gerar de novo' : '✅ Gerar vídeo', 'gerar').row();
    t.text('✏️ Lead', 'campo:lead').text('🏷 Etiqueta', 'campo:etiqueta').text('📂 Editoria', 'campo:editoria').row();
    t.text('📄 Subtítulo', 'campo:subtitulo').text('©️ Crédito', 'campo:credito').text('📝 Legenda', 'campo:legenda').row();
    t.text(r.pretoEBranco ? '🎨 Colorido' : '⚫ Preto e branco', 'pb');
    if (listarMascaras().length > 1) t.text('🎭 Trocar máscara', 'mascara');
    t.row();
    if (r.campos.lead) t.text('✨ Sugerir com IA', 'ia');
    t.text('✖️ Cancelar', 'cancelar');
    return t;
  };

  // Envia um cartão novo (fica no fim da conversa) e tira os botões do anterior.
  const mostrarCartao = async (chatId, r) => {
    if (r.cartaoId) await bot.api.editMessageReplyMarkup(chatId, r.cartaoId).catch(() => {});
    const msg = await bot.api.sendMessage(chatId, textoCartao(r), {
      parse_mode: 'HTML',
      reply_markup: tecladoCartao(r),
      link_preview_options: {is_disabled: true},
    });
    r.cartaoId = msg.message_id;
  };

  // Sugestões do Claude: destaques no lead, etiqueta/editoria se vazias e legenda.
  const aplicarIa = async (chatId, r, {forcar = false} = {}) => {
    if (!r.campos.lead || (r.iaFeita && !forcar)) return;
    const aguarde = await bot.api.sendMessage(chatId, '✨ Pedindo sugestões à IA…');
    try {
      const s = await sugerir({lead: semMarcacao(r.campos.lead), editoria: r.campos.editoria});
      r.campos.lead = s.lead;
      if (!r.campos.etiqueta) r.campos.etiqueta = s.etiqueta;
      if (!r.campos.editoria) r.campos.editoria = s.editoria;
      r.campos.legenda = [s.legenda, s.hashtags.join(' ')].filter(Boolean).join('\n\n');
      r.aviso = '✨ <i>Sugestões da IA aplicadas. Revise antes de gerar.</i>';
    } catch (erro) {
      console.error('Erro na sugestão (Telegram):', erro);
      r.aviso = `⚠️ <i>IA indisponível: ${esc(mensagemDeErroIa(erro))}</i>`;
    } finally {
      r.iaFeita = true;
      await bot.api.deleteMessage(chatId, aguarde.message_id).catch(() => {});
    }
  };

  const avancar = async (ctx, r) => {
    if (!r.tipoMidia) return ctx.reply('📝 Lead anotado. Agora mande a foto ou o vídeo da notícia.');
    if (!r.campos.lead)
      return ctx.reply('📎 Mídia recebida. Agora mande o lead da notícia (use *asteriscos* para destacar palavras).');
    await aplicarIa(ctx.chat.id, r);
    await mostrarCartao(ctx.chat.id, r);
  };

  // ---------- comandos ----------

  const AJUDA = [
    '🎬 <b>Reels Notícias</b>',
    '',
    '1. Mande uma <b>foto ou vídeo</b> com o <b>lead na legenda</b> (ou mande o lead logo depois).',
    '2. Confira o cartão: a IA sugere destaques, etiqueta e legenda; ajuste pelos botões.',
    '3. Toque em <b>Gerar vídeo</b> e receba o Reel, a capa e a legenda prontos.',
    '',
    'Use <code>*asteriscos*</code> no lead para destacar palavras em cor.',
    'Vídeos de até 20 MB (limite do Telegram para bots).',
    '',
    '/cancelar — descarta o rascunho atual',
    '/id — mostra seu ID do Telegram',
  ].join('\n');

  bot.command(['start', 'ajuda', 'help'], (ctx) => ctx.reply(AJUDA, {parse_mode: 'HTML'}));
  bot.command('id', (ctx) => ctx.reply(`Seu ID: <code>${ctx.from.id}</code>`, {parse_mode: 'HTML'}));
  bot.command('cancelar', async (ctx) => {
    const r = rascunhos.get(ctx.chat.id);
    if (r?.cartaoId) await bot.api.editMessageReplyMarkup(ctx.chat.id, r.cartaoId).catch(() => {});
    descartarRascunho(ctx.chat.id);
    await ctx.reply('Rascunho descartado. Mande uma nova foto ou vídeo quando quiser.');
  });

  // ---------- mídia ----------

  const arquivoDaMensagem = (msg) => {
    const arquivo = msg.photo ? {...msg.photo.at(-1), mime_type: 'image/jpeg'} : (msg.video ?? msg.document);
    return arquivo && TIPOS_MIDIA[arquivo.mime_type] ? arquivo : null;
  };

  const baixar = async (fileId, destino) => {
    const info = await bot.api.getFile(fileId);
    // Servidor local da Bot API (--local) devolve o caminho no disco em vez de URL.
    if (path.isAbsolute(info.file_path) && existsSync(info.file_path)) return copyFileSync(info.file_path, destino);
    const resp = await fetch(`${raiz}/file/bot${token}/${info.file_path}`);
    if (!resp.ok) throw new Error(`Download falhou (${resp.status})`);
    await pipeline(Readable.fromWeb(resp.body), createWriteStream(destino));
  };

  bot.on(['message:photo', 'message:video', 'message:document'], async (ctx) => {
    const msg = ctx.message;
    const arquivo = arquivoDaMensagem(msg);
    if (!arquivo) return ctx.reply('Formato não suportado. Mande JPG, PNG, WEBP, MP4, MOV ou WEBM.');
    let r = rascunhos.get(ctx.chat.id);
    // Álbum: usa só o primeiro item.
    if (msg.media_group_id && r?.grupo === msg.media_group_id) return;
    if (arquivo.file_size > LIMITE_DOWNLOAD)
      return ctx.reply(
        `Arquivo de ${(arquivo.file_size / 1048576).toFixed(0)} MB: o Telegram só deixa bots baixarem até 20 MB. ` +
          'Mande comprimido (sem "enviar como arquivo") ou use o painel web.'
      );

    if (r?.postId) descartarRascunho(ctx.chat.id); // editando: mídia nova vira um Reel novo
    r = rascunhos.get(ctx.chat.id) ?? novoRascunho(ctx.chat.id);
    if (r.arquivoMidia) rmSync(path.join(UPLOADS, r.arquivoMidia), {force: true});

    const [tipo, extensao] = TIPOS_MIDIA[arquivo.mime_type];
    const nome = `${r.id}${extensao}`;
    await ctx.replyWithChatAction(tipo === 'video' ? 'upload_video' : 'upload_photo');
    try {
      await baixar(arquivo.file_id, path.join(UPLOADS, nome));
    } catch (erro) {
      console.error('Erro ao baixar mídia do Telegram:', erro);
      return ctx.reply('Não consegui baixar o arquivo do Telegram. Tente mandar de novo.');
    }
    Object.assign(r, {arquivoMidia: nome, tipoMidia: tipo, grupo: msg.media_group_id});
    const legenda = msg.caption?.trim();
    if (legenda) {
      r.campos.lead = legenda.slice(0, 400);
      r.iaFeita = false;
    }
    await avancar(ctx, r);
  });

  // ---------- texto ----------

  bot.on('message:text', async (ctx) => {
    const texto = ctx.message.text.trim();
    if (texto.startsWith('/')) return ctx.reply('Comando desconhecido. Veja /ajuda.');
    let r = rascunhos.get(ctx.chat.id);

    if (r?.esperando) {
      const campo = CAMPOS_EDITAVEIS[r.esperando];
      r.campos[r.esperando] = texto === '-' && r.esperando !== 'lead' ? '' : texto.slice(0, campo.max);
      if (r.esperando === 'lead') r.iaFeita = false;
      r.esperando = null;
      r.aviso = '';
      return mostrarCartao(ctx.chat.id, r);
    }

    r ??= novoRascunho(ctx.chat.id);
    r.campos.lead = texto.slice(0, 400);
    r.iaFeita = false;
    r.aviso = '';
    await avancar(ctx, r);
  });

  // ---------- botões do cartão ----------

  const rascunhoDoBotao = async (ctx) => {
    const r = rascunhos.get(ctx.chat.id);
    if (!r || r.cartaoId !== ctx.callbackQuery.message?.message_id) {
      await ctx.answerCallbackQuery({text: 'Este cartão não está mais ativo'});
      await ctx.editMessageReplyMarkup().catch(() => {});
      return null;
    }
    return r;
  };

  bot.callbackQuery(/^campo:(\w+)$/, async (ctx) => {
    const r = await rascunhoDoBotao(ctx);
    if (!r) return;
    const chave = ctx.match[1];
    if (!CAMPOS_EDITAVEIS[chave]) return ctx.answerCallbackQuery();
    r.esperando = chave;
    await ctx.answerCallbackQuery();
    const atual = r.campos[chave] ? `\n\nAtual:\n<code>${esc(r.campos[chave])}</code>` : '';
    await ctx.reply(`${esc(CAMPOS_EDITAVEIS[chave].pedido)}${atual}`, {
      parse_mode: 'HTML',
      reply_markup: {force_reply: true, input_field_placeholder: CAMPOS_EDITAVEIS[chave].nome},
    });
  });

  bot.callbackQuery('pb', async (ctx) => {
    const r = await rascunhoDoBotao(ctx);
    if (!r) return;
    r.pretoEBranco = !r.pretoEBranco;
    await ctx.answerCallbackQuery({text: r.pretoEBranco ? 'Preto e branco' : 'Colorido'});
    await ctx.editMessageText(textoCartao(r), {parse_mode: 'HTML', reply_markup: tecladoCartao(r)});
  });

  bot.callbackQuery('mascara', async (ctx) => {
    const r = await rascunhoDoBotao(ctx);
    if (!r) return;
    const mascaras = listarMascaras();
    const i = mascaras.findIndex((m) => m.id === r.campos.mascaraId);
    const proxima = mascaras[(i + 1) % mascaras.length];
    r.campos.mascaraId = proxima.id;
    r.pretoEBranco = Boolean(proxima.pretoEBranco);
    await ctx.answerCallbackQuery({text: proxima.nome});
    await ctx.editMessageText(textoCartao(r), {parse_mode: 'HTML', reply_markup: tecladoCartao(r)});
  });

  bot.callbackQuery('ia', async (ctx) => {
    const r = await rascunhoDoBotao(ctx);
    if (!r) return;
    await ctx.answerCallbackQuery();
    await aplicarIa(ctx.chat.id, r, {forcar: true});
    await mostrarCartao(ctx.chat.id, r);
  });

  bot.callbackQuery('cancelar', async (ctx) => {
    const r = await rascunhoDoBotao(ctx);
    if (!r) return;
    descartarRascunho(ctx.chat.id);
    await ctx.answerCallbackQuery({text: 'Descartado'});
    await ctx.editMessageText(`${textoCartao(r)}\n\n✖️ <b>Cancelado</b>`, {parse_mode: 'HTML'});
  });

  bot.callbackQuery('gerar', async (ctx) => {
    const r = await rascunhoDoBotao(ctx);
    if (!r) return;
    let campos;
    try {
      campos = lerCampos({...r.campos, pretoEBranco: String(r.pretoEBranco)});
    } catch (erro) {
      return ctx.answerCallbackQuery({text: erro.message, show_alert: true});
    }
    await ctx.answerCallbackQuery({text: 'Enviado para a fila'});
    await ctx.editMessageText(`${textoCartao({...r, aviso: ''})}\n\n⏳ <b>Na fila…</b>`, {parse_mode: 'HTML'});
    const telegram = {chatId: ctx.chat.id, statusId: r.cartaoId};
    rascunhos.delete(ctx.chat.id);
    try {
      if (r.postId) {
        anotar(r.postId, {telegram});
        atualizar(r.postId, campos);
      } else {
        criar({
          id: r.id,
          ...campos,
          tipoMidia: r.tipoMidia,
          arquivoMidia: r.arquivoMidia,
          nomeOriginal: 'telegram',
          telegram,
        });
      }
    } catch (erro) {
      await ctx.reply(`Não foi possível gerar: ${esc(erro.message)}`, {parse_mode: 'HTML'});
    }
  });

  // ---------- botões do vídeo pronto ----------

  bot.callbackQuery(/^editar:(\w+)$/, async (ctx) => {
    const post = obter(ctx.match[1]);
    if (!post) return ctx.answerCallbackQuery({text: 'Este Reel não existe mais'});
    if (post.status === 'renderizando' || post.status === 'na_fila')
      return ctx.answerCallbackQuery({text: 'Aguarde o render atual terminar'});
    await ctx.answerCallbackQuery();
    const anterior = rascunhos.get(ctx.chat.id);
    if (anterior?.cartaoId) await bot.api.editMessageReplyMarkup(ctx.chat.id, anterior.cartaoId).catch(() => {});
    descartarRascunho(ctx.chat.id);
    const n = post.noticia;
    const r = {
      id: post.id,
      postId: post.id,
      arquivoMidia: post.arquivoMidia,
      tipoMidia: post.tipoMidia,
      campos: {
        lead: n.lead,
        subtitulo: n.subtitulo ?? '',
        etiqueta: n.etiqueta ?? '',
        editoria: n.editoria ?? '',
        credito: n.credito ?? '',
        legenda: post.legenda ?? '',
        mascaraId: post.mascaraId,
      },
      pretoEBranco: n.pretoEBranco ?? Boolean(listarMascaras().find((m) => m.id === post.mascaraId)?.pretoEBranco),
      iaFeita: true,
    };
    rascunhos.set(ctx.chat.id, r);
    await mostrarCartao(ctx.chat.id, r);
  });

  bot.callbackQuery(/^excluir:(\w+)$/, async (ctx) => {
    try {
      const existia = remover(ctx.match[1]);
      await ctx.answerCallbackQuery({text: existia ? 'Reel excluído' : 'Já tinha sido excluído'});
      await ctx.editMessageCaption({caption: '🗑 Reel excluído do servidor.'}).catch(() => {});
    } catch (erro) {
      await ctx.answerCallbackQuery({text: erro.message, show_alert: true});
    }
  });

  bot.on('callback_query:data', (ctx) => ctx.answerCallbackQuery());

  // ---------- avisos da fila ----------

  const ultimaEdicao = new Map(); // postId → {quando, texto}
  const cadeias = new Map(); // postId → promessa, para as mensagens saírem em ordem

  const barra = (p) => '▓'.repeat(Math.round(p / 10)) + '░'.repeat(10 - Math.round(p / 10));

  const textoStatus = (post) => {
    const lead = `<b>Lead:</b> ${leadHtml(post.noticia.lead)}`;
    if (post.status === 'na_fila') return `${lead}\n\n⏳ <b>Na fila…</b>`;
    if (post.status === 'renderizando') return `${lead}\n\n🎞 <b>Renderizando</b> ${barra(post.progresso)} ${post.progresso}%`;
    if (post.status === 'pronto') return `${lead}\n\n✅ <b>Pronto</b> em ${post.tempoRender}s`;
    return `${lead}\n\n❌ <b>O render falhou:</b> ${esc(post.erro)}`;
  };

  const editarStatus = async ({chatId, statusId}, texto) => {
    try {
      await bot.api.editMessageText(chatId, statusId, texto, {parse_mode: 'HTML'});
    } catch (erro) {
      if (!(erro instanceof GrammyError && erro.description.includes('not modified'))) throw erro;
    }
  };

  const entregar = async (post) => {
    const {chatId} = post.telegram;
    const arquivo = path.join(SAIDAS, post.video);
    const teclado = new InlineKeyboard().text('✏️ Editar texto', `editar:${post.id}`).text('🗑 Excluir', `excluir:${post.id}`);
    if (statSync(arquivo).size > LIMITE_ENVIO) {
      await bot.api.sendMessage(chatId, 'O vídeo passou de 50 MB, o limite do Telegram. Baixe pelo painel web.', {
        reply_markup: teclado,
      });
    } else {
      await bot.api.sendChatAction(chatId, 'upload_video');
      await bot.api.sendVideo(chatId, new InputFile(arquivo, `reel-${post.id}.mp4`), {
        caption: semMarcacao(post.noticia.lead).slice(0, 1000),
        width: 1080,
        height: 1920,
        duration: Math.round(post.duracao),
        supports_streaming: true,
        thumbnail: new InputFile(path.join(SAIDAS, post.capa)),
        reply_markup: teclado,
      });
    }
    await bot.api.sendPhoto(chatId, new InputFile(path.join(SAIDAS, post.capa), `capa-${post.id}.jpg`), {
      caption: '🖼 Capa do Reel',
    });
    if (post.legenda)
      await bot.api.sendMessage(chatId, `📝 <b>Legenda</b> (toque para copiar)\n<pre>${esc(post.legenda)}</pre>`, {
        parse_mode: 'HTML',
      });
  };

  const aoMudarPost = async (post) => {
    if (!post.telegram) return;
    const texto = textoStatus(post);
    const anterior = ultimaEdicao.get(post.id);
    const final = post.status === 'pronto' || post.status === 'erro';
    // Progresso no máximo a cada 3 s para não esbarrar no limite de edições do Telegram.
    if (!final && anterior && anterior.status === post.status && Date.now() - anterior.quando < INTERVALO_PROGRESSO) return;
    if (anterior?.texto === texto) return;
    ultimaEdicao.set(post.id, {quando: Date.now(), texto, status: post.status});
    await editarStatus(post.telegram, texto);
    if (post.status === 'pronto') await entregar(post);
    if (final) ultimaEdicao.delete(post.id);
  };

  aoMudar((post) => {
    const copia = structuredClone(post);
    const proxima = (cadeias.get(post.id) ?? Promise.resolve())
      .then(() => aoMudarPost(copia))
      .catch((erro) => console.error(`Erro ao avisar no Telegram (post ${post.id}):`, erro))
      .finally(() => cadeias.get(post.id) === proxima && cadeias.delete(post.id));
    cadeias.set(post.id, proxima);
  });

  bot.catch(({error, ctx}) => {
    console.error(`Erro no bot do Telegram (update ${ctx.update.update_id}):`, error);
    ctx.reply('Algo deu errado aqui. Tente de novo ou mande /cancelar.').catch(() => {});
  });

  bot.start({
    onStart: (eu) => console.log(`Bot do Telegram ativo: @${eu.username} (${autorizados.size} autorizado(s))`),
  });
  return bot;
};
