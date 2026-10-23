// Uma máscara é a identidade visual fixa de um perfil/site.
// Os arquivos (logo, overlay) ficam em public/mascaras/<id>/ ou em URLs.
export type Mascara = {
  id: string;
  nome: string;
  // "citacao": mídia em tela cheia com círculo de aspas (padrão)
  // "manchete": mídia no topo que se funde num fundo sólido, título grande e faixa colorida lateral
  layout?: 'citacao' | 'manchete';
  perfil: {
    nome: string; // assinatura / marca em texto
    handle: string; // sem @
  };
  logo?: string; // citação: dentro do círculo; manchete: centralizado embaixo
  overlayPng?: string; // PNG 1080x1920 com transparência, por cima de tudo (opcional)
  pretoEBranco?: boolean; // mídia em P&B
  cores: {
    destaque: string; // trechos marcados com *asteriscos* e detalhes
    textoSobreDestaque?: string; // citação: aspas dentro do círculo
    etiquetaFundo?: string; // citação: caixa da etiqueta
    etiquetaTexto?: string;
    fundo?: string; // manchete: cor sólida onde a mídia se funde
    faixa?: string[]; // manchete: cores da faixa lateral, de cima para baixo
  };
};

export type Midia = {
  tipo: 'video' | 'foto';
  src: string; // caminho dentro de public/ ou URL http(s)
};

export type Noticia = {
  midia: Midia;
  lead: string; // texto principal; trechos entre *asteriscos* ficam na cor de destaque
  subtitulo?: string; // linha de apoio abaixo do texto principal (layout manchete)
  editoria?: string; // vira "#Editoria" na etiqueta se não houver etiqueta
  etiqueta?: string; // ex: "Urgente", "#Política"
  credito?: string; // ex: "Foto: divulgação"
  pretoEBranco?: boolean; // sobrescreve a máscara
  duracaoFoto?: number; // segundos, só para foto
  duracaoMaxima?: number; // segundos, corta vídeos longos
};

export type ReelProps = {
  noticia: Noticia;
  mascara: Mascara;
};
