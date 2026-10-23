import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DADOS = path.resolve(process.env.PASTA_DADOS ?? path.join(RAIZ, 'dados'));
export const UPLOADS = path.join(DADOS, 'uploads');
export const SAIDAS = path.join(DADOS, 'saidas');
