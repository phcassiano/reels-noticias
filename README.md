# Reels Notícias

Gera Reels de notícia (1080×1920, 30 fps, H.264 + AAC) a partir de **uma foto ou vídeo + manchete + lead**,
aplicando uma **máscara** (identidade visual do perfil/site). O motion graphics é feito com [Remotion](https://www.remotion.dev/).

Etapa atual: **template de vídeo + painel de envio com sugestões do Claude**. Ainda não há Supabase nem publicação automática no Instagram.

## Painel de envio

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... PAINEL_SENHA=uma-senha npm run painel
# abra http://localhost:3000 (usuário qualquer, senha = PAINEL_SENHA)
```

No painel (feito para usar no celular):

1. Escolha a foto ou o vídeo e escreva o lead.
2. Opcional: **Sugerir destaques, etiqueta e legenda** — o Claude marca 1 a 3 trechos-chave do lead com
   `*asteriscos*`, sugere editoria/etiqueta e escreve a legenda com hashtags. O texto do lead nunca é alterado:
   se a IA mudar qualquer palavra, a sugestão de destaque é descartada.
3. **Gerar vídeo**: o Reel entra na fila e aparece na lista com o progresso. Quando fica pronto, dá para assistir,
   baixar o MP4 e a capa e copiar a legenda.
4. **Editar** muda os textos e renderiza de novo com a mesma mídia; **Excluir** apaga o post e os arquivos.

| Variável | Uso |
|---|---|
| `PORTA` | Porta HTTP (padrão 3000) |
| `PAINEL_SENHA` | Senha de acesso (Basic Auth). **Obrigatória** se o painel ficar exposto na internet |
| `ANTHROPIC_API_KEY` | Chave da API do Claude, usada só no botão de sugestões |
| `PASTA_DADOS` | Onde ficam uploads, vídeos e `posts.json` (padrão `./dados`) |
| `REMOTION_BROWSER_EXECUTABLE` | Chromium local, se o Remotion não puder baixar o dele |

Os renders rodam um por vez na própria máquina (cerca de 30 a 60 s para um Reel de 8 s em 4 núcleos).
As sugestões usam o modelo `claude-opus-5-5` com fallback automático do servidor caso o modelo recuse o pedido.

## Render por linha de comando

```bash
npm run studio                                  # editor visual com prévia ao vivo
npm run render -- exemplos/post-video.json      # gera out/post-video.mp4 e out/post-video-capa.jpg
```

Se o Chrome do Remotion não puder ser baixado, aponte para um Chromium local:
`REMOTION_BROWSER_EXECUTABLE=/caminho/do/chrome-headless-shell npm run render -- ...`

## Layout

Mídia em tela cheia (opcionalmente em P&B), círculo na cor de destaque com aspas ou o logo da máscara,
etiqueta no canto superior direito, texto principal grande com barra vertical, assinatura em caixa alta
e barra na base. Tudo entra em sequência (zoom da mídia, etiqueta "digitada", círculo com mola,
palavras subindo em cascata) e sai no último meio segundo para o loop do Reels ficar suave.

## Formato do post

```json
{
  "mascara": "padrao",
  "midia": {"tipo": "foto", "src": "minha-pasta/foto.jpg"},
  "editoria": "Política",
  "etiqueta": "#Urgente",
  "lead": "Governo anuncia *corte de 10%* na conta de luz a partir de janeiro",
  "credito": "Foto: Agência Brasil",
  "pretoEBranco": false,
  "duracaoFoto": 8,
  "duracaoMaxima": 90
}
```

- `lead`: texto principal. Trechos entre `*asteriscos*` ficam na cor de destaque. O tamanho da fonte se ajusta ao comprimento.
- `etiqueta`: caixa no topo; se omitida, usa `#editoria`.
- `credito`: aparece na linha abaixo da assinatura, ao lado do @.
- `midia.src`: caminho relativo ao JSON, caminho dentro de `public/` ou URL `https://`.
- Foto vira vídeo com zoom lento (`duracaoFoto`, padrão 8 s). Vídeo usa a duração original, cortada em `duracaoMaxima` (padrão 90 s), com o áudio original.
- `pretoEBranco` sobrescreve a configuração da máscara para esse post.
- `mascara` pode ser o id de um arquivo em `mascaras/` ou o objeto completo.

## Máscaras

Cada máscara é um JSON em `mascaras/<id>.json`, com arquivos em `public/mascaras/<id>/`:

| Campo | Uso |
|---|---|
| `perfil.nome` | Assinatura em caixa alta abaixo do texto |
| `perfil.handle` | @ na linha de detalhe |
| `logo` (opcional) | Vai dentro do círculo; sem logo, o círculo mostra aspas |
| `pretoEBranco` | Mídia em P&B por padrão |
| `cores.destaque` | Círculo, barras e palavras destacadas |
| `cores.textoSobreDestaque` | Aspas dentro do círculo |
| `cores.etiquetaFundo` / `cores.etiquetaTexto` | Caixa da etiqueta |
| `overlayPng` (opcional) | PNG 1080×1920 transparente aplicado por cima de tudo |

Para criar uma nova: copie `mascaras/padrao.json`, troque os campos e coloque os arquivos na pasta correspondente
(há um `public/mascaras/padrao/logo.svg` de exemplo).

Os exemplos em `exemplos/` apontam para `public/exemplo/foto.jpg` e `public/exemplo/video.mp4`, que não são
versionados: coloque ali seus próprios arquivos de teste.

## Estrutura

```
src/Reel.tsx            composição: mídia, círculo, etiqueta, texto, assinatura e animações
src/Root.tsx            registro da composição e cálculo da duração
src/tipos.ts            tipos de Noticia e Mascara
servidor/index.mjs      painel: rotas HTTP, upload e senha
servidor/fila.mjs       fila de render e estado dos posts (dados/posts.json)
servidor/ia.mjs         sugestões com o Claude
servidor/renderizador.mjs  render MP4 + capa (compartilhado com o script)
painel/index.html       interface do painel
scripts/render.mjs      render por linha de comando
mascaras/               máscaras disponíveis
exemplos/               posts de exemplo
```

## Próximos passos

1. Personalizar a máscara (nome, @, logo e cor).
2. Hospedar o painel numa VPS ou serviço com Docker (precisa de CPU para o render) e trocar `dados/` pelo Supabase
   (Storage para mídias e vídeos, tabela de posts) — a troca fica concentrada em `servidor/fila.mjs`.
3. Legendas automáticas para vídeos com fala e trilha para fotos.
4. Publicação e agendamento via Instagram Graph API.
