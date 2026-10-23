import Anthropic from '@anthropic-ai/sdk';
import {betaZodOutputFormat} from '@anthropic-ai/sdk/helpers/beta/zod';
import {z} from 'zod';

const Sugestao = z.object({
  lead: z.string().describe('O lead original, idêntico, com 1 a 3 trechos-chave entre *asteriscos*'),
  editoria: z.string().describe('Editoria curta, ex: Política, Economia, Esporte'),
  etiqueta: z.string().describe('Etiqueta curta para o topo do vídeo, ex: #Política ou Urgente'),
  legenda: z.string().describe('Legenda do post no Instagram, sem hashtags'),
  hashtags: z.array(z.string()).describe('5 a 8 hashtags, cada uma começando com #'),
});

const SISTEMA = `Você é editor de redes sociais de um portal de notícias brasileiro e prepara Reels a partir do lead de uma notícia.

Regras:
- Nunca altere, resuma ou acrescente informação ao lead. Devolva exatamente o mesmo texto, apenas marcando entre *asteriscos* de 1 a 3 trechos curtos (1 a 4 palavras cada) que concentram a notícia; eles aparecem destacados em cor no vídeo.
- A etiqueta tem no máximo 18 caracteres. Use "Urgente" ou "Exclusivo" só quando o lead justificar; caso contrário use # mais a editoria.
- A legenda tem de 2 a 4 frases em português, tom jornalístico e direto, sem sensacionalismo, sem afirmar nada que não esteja no lead, e termina com uma pergunta ou chamada que convide a comentar.
- Hashtags em português, relevantes ao assunto, sem acentos.`;

const semMarcacao = (texto) => texto.replace(/\*/g, '').replace(/\s+/g, ' ').trim();

let cliente = null;

class IaNaoConfigurada extends Error {}

// Sem credencial, o SDK falha antes de enviar a requisição com um Error comum.
const chamar = async (parametros) => {
  try {
    return await cliente.beta.messages.parse(parametros);
  } catch (erro) {
    if (erro instanceof Anthropic.APIError) throw erro;
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
      throw new IaNaoConfigurada('IA não configurada: defina ANTHROPIC_API_KEY no servidor e reinicie o painel', {cause: erro});
    throw erro;
  }
};

export const sugerir = async ({lead, editoria}) => {
  cliente ??= new Anthropic();
  const resposta = await chamar({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    // se o modelo recusar por engano, a API tenta de novo com um modelo alternativo
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {effort: 'medium', format: betaZodOutputFormat(Sugestao)},
    system: SISTEMA,
    messages: [
      {
        role: 'user',
        content: `Lead:\n${lead}${editoria ? `\n\nEditoria informada: ${editoria}` : ''}`,
      },
    ],
  });

  if (resposta.stop_reason === 'refusal') throw new Error('A IA não quis processar este lead');
  const sugestao = resposta.parsed_output;
  if (!sugestao) throw new Error('A IA devolveu uma resposta em formato inesperado');

  // Garantia: o texto da notícia nunca muda, só ganha marcações.
  if (semMarcacao(sugestao.lead) !== semMarcacao(lead)) sugestao.lead = lead;
  sugestao.hashtags = sugestao.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`));
  return sugestao;
};

export const mensagemDeErroIa = (erro) => {
  if (erro instanceof Anthropic.AuthenticationError)
    return 'Chave da API do Claude inválida ou ausente (configure ANTHROPIC_API_KEY)';
  if (erro instanceof Anthropic.RateLimitError) return 'Limite de uso da IA atingido, tente em instantes';
  if (erro instanceof Anthropic.APIError) return `Erro da IA (${erro.status})`;
  return erro?.message ?? String(erro);
};
