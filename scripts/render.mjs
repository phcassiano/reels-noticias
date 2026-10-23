// Uso: node scripts/render.mjs <post.json> [saida.mp4]
// O post.json traz os campos da notícia e "mascara" (id em mascaras/ ou objeto completo).
// Gera o MP4 e uma capa JPG ao lado.
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {RAIZ} from '../servidor/caminhos.mjs';
import {carregarMascara} from '../servidor/mascaras.mjs';
import {renderizar} from '../servidor/renderizador.mjs';

const [arquivoPost, saidaArg] = process.argv.slice(2);
if (!arquivoPost) {
  console.error('Uso: node scripts/render.mjs <post.json> [saida.mp4]');
  process.exit(1);
}

const post = JSON.parse(readFileSync(arquivoPost, 'utf8'));
const {mascara: mascaraRef = 'padrao', ...noticia} = post;
const mascara = typeof mascaraRef === 'string' ? carregarMascara(mascaraRef) : mascaraRef;

// Arquivos locais fora de public/ são copiados para public/_entrada/ antes do empacotamento.
const prepararMidia = (src) => {
  if (/^https?:/.test(src) || existsSync(path.join(RAIZ, 'public', src))) return src;
  const local = path.resolve(path.dirname(arquivoPost), src);
  if (!existsSync(local)) throw new Error(`Mídia não encontrada: ${src}`);
  const hash = createHash('sha1').update(readFileSync(local)).digest('hex').slice(0, 12);
  const destino = path.join('_entrada', `${hash}${path.extname(local).toLowerCase()}`);
  mkdirSync(path.join(RAIZ, 'public', '_entrada'), {recursive: true});
  copyFileSync(local, path.join(RAIZ, 'public', destino));
  return destino;
};
noticia.midia = {...noticia.midia, src: prepararMidia(noticia.midia.src)};

const saida = path.resolve(saidaArg ?? path.join(RAIZ, 'out', `${path.basename(arquivoPost, '.json')}.mp4`));
const capa = saida.replace(/\.mp4$/i, '') + '-capa.jpg';

console.log('Renderizando...');
let ultimo = -1;
const {duracao} = await renderizar(
  {noticia, mascara},
  {
    saida,
    capa,
    aoProgredir: (p) => {
      const pct = Math.floor(p * 10) * 10;
      if (pct !== ultimo) console.log(`  ${(ultimo = pct)}%`);
    },
  }
);
console.log(`Pronto (${duracao.toFixed(1)}s):\n  vídeo: ${saida}\n  capa:  ${capa}`);
