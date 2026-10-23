import {existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {DADOS, SAIDAS, UPLOADS} from './caminhos.mjs';
import {carregarMascara} from './mascaras.mjs';
import {renderizar} from './renderizador.mjs';

// Fila simples em arquivo: um render por vez, estado salvo em dados/posts.json.
// Quando o Supabase entrar, este módulo é o único que precisa mudar.
const ARQUIVO = path.join(DADOS, 'posts.json');
for (const pasta of [DADOS, UPLOADS, SAIDAS]) mkdirSync(pasta, {recursive: true});

let posts = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : [];
// Renders interrompidos por reinício voltam para a fila.
for (const p of posts) if (p.status === 'renderizando') Object.assign(p, {status: 'na_fila', progresso: 0});

let ocupado = false;
const ouvintes = [];

// Avisa interessados (ex: o bot do Telegram) sobre mudanças de status e progresso.
export const aoMudar = (fn) => ouvintes.push(fn);
const notificar = (post) => {
  for (const fn of ouvintes) {
    try {
      fn(post);
    } catch (erro) {
      console.error('Erro ao notificar mudança de post:', erro);
    }
  }
};
let urlMidia = (arquivo) => {
  throw new Error(`Fila não iniciada (${arquivo})`);
};

const salvar = () => {
  writeFileSync(`${ARQUIVO}.tmp`, JSON.stringify(posts, null, 2));
  renameSync(`${ARQUIVO}.tmp`, ARQUIVO);
};

export const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const listar = () => [...posts].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
export const obter = (id) => posts.find((p) => p.id === id);

export const criar = (post) => {
  posts.push({...post, criadoEm: new Date().toISOString(), status: 'na_fila', progresso: 0});
  salvar();
  notificar(obter(post.id));
  processar();
  return obter(post.id);
};

export const atualizar = (id, campos) => {
  const post = obter(id);
  if (!post) return null;
  if (post.status === 'renderizando') throw new Error('Aguarde o render atual terminar');
  Object.assign(post, campos, {status: 'na_fila', progresso: 0, erro: undefined});
  salvar();
  notificar(post);
  processar();
  return post;
};

// Guarda informações extras no post sem mexer no status (ex: mensagens do Telegram).
export const anotar = (id, campos) => {
  const post = obter(id);
  if (!post) return null;
  Object.assign(post, campos);
  salvar();
  return post;
};

export const remover = (id) => {
  const post = obter(id);
  if (!post) return false;
  if (post.status === 'renderizando') throw new Error('Aguarde o render atual terminar');
  rmSync(path.join(UPLOADS, post.arquivoMidia), {force: true});
  for (const f of [post.video, post.capa]) if (f) rmSync(path.join(SAIDAS, f), {force: true});
  posts = posts.filter((p) => p.id !== id);
  salvar();
  return true;
};

const processar = async () => {
  if (ocupado) return;
  const post = posts
    .filter((p) => p.status === 'na_fila')
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))[0];
  if (!post) return;

  ocupado = true;
  Object.assign(post, {status: 'renderizando', progresso: 0});
  salvar();
  notificar(post);
  const inicio = Date.now();
  // Nome muda a cada render para o navegador não mostrar a versão antiga do cache.
  const versao = Date.now().toString(36);
  const video = `${post.id}-${versao}.mp4`;
  const capa = `${post.id}-${versao}-capa.jpg`;
  try {
    const noticia = {
      ...post.noticia,
      midia: {tipo: post.tipoMidia, src: urlMidia(post.arquivoMidia)},
    };
    const {duracao} = await renderizar(
      {noticia, mascara: carregarMascara(post.mascaraId)},
      {
        saida: path.join(SAIDAS, video),
        capa: path.join(SAIDAS, capa),
        aoProgredir: (p) => {
          const progresso = Math.round(p * 100);
          if (progresso === post.progresso) return;
          post.progresso = progresso;
          notificar(post);
        },
      }
    );
    for (const f of [post.video, post.capa]) if (f) rmSync(path.join(SAIDAS, f), {force: true});
    Object.assign(post, {
      status: 'pronto',
      progresso: 100,
      video,
      capa,
      duracao,
      tempoRender: Math.round((Date.now() - inicio) / 1000),
    });
  } catch (erro) {
    console.error(`Erro no render ${post.id}:`, erro);
    Object.assign(post, {status: 'erro', erro: String(erro?.message ?? erro).slice(0, 500)});
  } finally {
    ocupado = false;
    salvar();
    notificar(post);
    processar();
  }
};

// urlMidia: como o renderizador (Chromium) busca o arquivo enviado.
export const iniciarFila = (opcoes) => {
  urlMidia = opcoes.urlMidia;
  processar();
};
