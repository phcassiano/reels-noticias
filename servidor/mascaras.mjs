import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {RAIZ} from './caminhos.mjs';

const PASTA = path.join(RAIZ, 'mascaras');
const ID_VALIDO = /^[a-z0-9][a-z0-9-]*$/;

export const carregarMascara = (id) => {
  if (!ID_VALIDO.test(id)) throw new Error(`Máscara inválida: ${id}`);
  return JSON.parse(readFileSync(path.join(PASTA, `${id}.json`), 'utf8'));
};

export const listarMascaras = () =>
  readdirSync(PASTA)
    .filter((f) => f.endsWith('.json'))
    .map((f) => carregarMascara(f.slice(0, -5)))
    // a padrão vem primeiro: é a escolhida quando nada é informado
    .sort((a, b) => ordem(a) - ordem(b) || a.nome.localeCompare(b.nome));

// Máscara com "padrao": true no JSON; sem nenhuma marcada, a de id "padrao".
const ordem = (m) => (m.padrao ? 0 : m.id === 'padrao' ? 1 : 2);

export const mascaraPadrao = () => listarMascaras()[0];
