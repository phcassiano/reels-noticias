import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {RAIZ} from './caminhos.mjs';

const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
let pacote = null;

// O empacotamento do template leva alguns segundos; é feito uma vez e reaproveitado.
// Arquivos adicionados a public/ depois disso não entram: mídias novas vão por URL.
export const prepararPacote = () =>
  (pacote ??= bundle({entryPoint: path.join(RAIZ, 'src', 'index.ts')}).catch((erro) => {
    pacote = null;
    throw erro;
  }));

export const renderizar = async (inputProps, {saida, capa, aoProgredir}) => {
  const serveUrl = await prepararPacote();
  const composition = await selectComposition({
    serveUrl,
    id: 'ReelNoticia',
    inputProps,
    browserExecutable,
  });

  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    crf: 18,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    outputLocation: saida,
    browserExecutable,
    onProgress: ({progress}) => aoProgredir?.(progress),
  });

  await renderStill({
    serveUrl,
    composition,
    inputProps,
    output: capa,
    // depois de todas as entradas e antes da animação de saída
    frame: Math.max(0, Math.min(composition.durationInFrames - 20, Math.round(composition.fps * 3.5))),
    imageFormat: 'jpeg',
    jpegQuality: 92,
    browserExecutable,
  });

  return {duracao: composition.durationInFrames / composition.fps};
};
