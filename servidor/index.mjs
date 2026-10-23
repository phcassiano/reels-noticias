// Painel de envio: recebe mídia + lead, sugere textos com o Claude e renderiza o Reel.
// Uso: npm run painel   (variáveis: PORTA, PAINEL_SENHA, ANTHROPIC_API_KEY, TELEGRAM_TOKEN,
// TELEGRAM_AUTORIZADOS, REMOTION_BROWSER_EXECUTABLE)
import express from 'express';
import multer from 'multer';
import {timingSafeEqual} from 'node:crypto';
import {rmSync} from 'node:fs';
import path from 'node:path';
import {RAIZ, SAIDAS, UPLOADS} from './caminhos.mjs';
import {atualizar, criar, iniciarFila, listar, novoId, obter, remover} from './fila.mjs';
import {mensagemDeErroIa, sugerir} from './ia.mjs';
import {lerCampos, TIPOS_MIDIA} from './campos.mjs';
import {listarMascaras} from './mascaras.mjs';
import {prepararPacote} from './renderizador.mjs';
import {iniciarBot} from './telegram.mjs';

const PORTA = Number(process.env.PORTA ?? 3000);
const SENHA = process.env.PAINEL_SENHA ?? '';


const app = express();
app.disable('x-powered-by');

const ehLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

// Mídias enviadas, lidas só pelo Chromium do render na própria máquina.
app.use(
  '/interno/uploads',
  (req, res, next) => (ehLocal(req) ? next() : res.sendStatus(403)),
  (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(UPLOADS, {fallthrough: false})
);

// Verificação de saúde para o Docker / monitoramento (sem senha, sem dados).
app.get('/saude', (req, res) => res.json({ok: true}));

// Senha única (Basic Auth) quando PAINEL_SENHA estiver definida.
const senhaConfere = (recebida) => {
  const a = Buffer.from(recebida);
  const b = Buffer.from(SENHA);
  return a.length === b.length && timingSafeEqual(a, b);
};
app.use((req, res, next) => {
  if (!SENHA) return next();
  const [tipo, valor] = (req.headers.authorization ?? '').split(' ');
  const senha = tipo === 'Basic' ? Buffer.from(valor ?? '', 'base64').toString().split(':').slice(1).join(':') : '';
  if (senhaConfere(senha)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Reels Noticias", charset="UTF-8"').sendStatus(401);
});

app.use(express.static(path.join(RAIZ, 'painel')));
app.use('/fontes', express.static(path.join(RAIZ, 'node_modules', '@fontsource', 'outfit')));
app.use('/arquivos', express.static(SAIDAS));
app.use(express.json({limit: '100kb'}));

const enviar = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, arquivo, cb) => {
      req.idPost = novoId();
      cb(null, `${req.idPost}${TIPOS_MIDIA[arquivo.mimetype][1]}`);
    },
  }),
  limits: {fileSize: 500 * 1024 * 1024, files: 1},
  fileFilter: (req, arquivo, cb) =>
    TIPOS_MIDIA[arquivo.mimetype]
      ? cb(null, true)
      : cb(new Error('Formato não suportado. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.')),
});

const rota = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (erro) {
    res.status(400).json({erro: erro?.message ?? String(erro)});
  }
};

app.get(
  '/api/mascaras',
  rota((req, res) => res.json(listarMascaras()))
);

app.post('/api/sugerir', async (req, res) => {
  const lead = String(req.body?.lead ?? '').trim();
  if (!lead) return res.status(400).json({erro: 'Escreva o lead antes de pedir sugestões'});
  try {
    res.json(await sugerir({lead, editoria: String(req.body?.editoria ?? '').trim()}));
  } catch (erro) {
    console.error('Erro na sugestão:', erro);
    res.status(502).json({erro: mensagemDeErroIa(erro)});
  }
});

app.get(
  '/api/posts',
  rota((req, res) => res.json(listar()))
);

app.post(
  '/api/posts',
  (req, res, next) =>
    enviar.single('midia')(req, res, (erro) =>
      erro ? res.status(400).json({erro: erro.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 500 MB' : erro.message}) : next()
    ),
  rota((req, res) => {
    if (!req.file) throw new Error('Envie uma foto ou um vídeo');
    let campos;
    try {
      campos = lerCampos(req.body);
    } catch (erro) {
      rmSync(req.file.path, {force: true});
      throw erro;
    }
    const post = criar({
      id: req.idPost,
      ...campos,
      tipoMidia: TIPOS_MIDIA[req.file.mimetype][0],
      arquivoMidia: req.file.filename,
      nomeOriginal: req.file.originalname,
    });
    res.status(201).json(post);
  })
);

app.get(
  '/api/posts/:id',
  rota((req, res) => {
    const post = obter(req.params.id);
    post ? res.json(post) : res.sendStatus(404);
  })
);

// Edita os textos e renderiza de novo com a mesma mídia.
app.put(
  '/api/posts/:id',
  rota((req, res) => {
    const post = atualizar(req.params.id, lerCampos(req.body));
    post ? res.json(post) : res.sendStatus(404);
  })
);

app.delete(
  '/api/posts/:id',
  rota((req, res) => res.sendStatus(remover(req.params.id) ? 204 : 404))
);

app.listen(PORTA, () => {
  console.log(`Painel em http://localhost:${PORTA}${SENHA ? '' : '  (sem senha: defina PAINEL_SENHA antes de expor na internet)'}`);
  iniciarFila({urlMidia: (arquivo) => `http://127.0.0.1:${PORTA}/interno/uploads/${encodeURIComponent(arquivo)}`});
  if (process.env.TELEGRAM_TOKEN) {
    const autorizados = new Set(
      (process.env.TELEGRAM_AUTORIZADOS ?? '')
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
        .map((v) => (/^\d+$/.test(v) || v.startsWith('@') ? v : `@${v}`))
    );
    iniciarBot({token: process.env.TELEGRAM_TOKEN, autorizados, apiRoot: process.env.TELEGRAM_API});
  }
  // Adianta o empacotamento do template para o primeiro render sair mais rápido.
  prepararPacote().then(
    () => console.log('Template pronto para renderizar'),
    (erro) => console.error('Falha ao empacotar o template:', erro)
  );
});
