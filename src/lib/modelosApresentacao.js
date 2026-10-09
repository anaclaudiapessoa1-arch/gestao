// Modelos de apresentação no estilo MinasLab. Cada slide tem um `layout` e
// campos de texto simples. Convenções dos campos de texto:
//   - uma linha por item; "# " no começo = subtítulo dentro da lista
//   - em cartões (layout "colunas"): "## Título" abre um cartão; as linhas
//     seguintes são o texto dele ("- " vira marcador)
//   - em fluxo e agenda: "Título | detalhe"
//   - em tabela: colunas separadas por "|", a primeira linha é o cabeçalho
// Marcadores trocados na hora de mostrar: {mes}, {mesAnterior}, {ano},
// {pesoEquipe}, {pesoLideranca}.

import { novoId } from "./format.js";

export const LAYOUTS = {
  capa: { nome: "Capa", campos: ["titulo", "subtitulo", "texto"] },
  agenda: { nome: "Agenda", campos: ["titulo", "itens"], ajuda: { itens: "Uma linha por tópico: Título | descrição" } },
  topicos: { nome: "Tópicos", campos: ["titulo", "texto", "destaque"], ajuda: { texto: "Uma linha por tópico. \"# \" no começo vira subtítulo." } },
  colunas: { nome: "Cartões", campos: ["titulo", "itens", "destaque"], ajuda: { itens: "\"## Título\" abre um cartão; as linhas abaixo são o texto. \"- \" vira marcador." } },
  numero: { nome: "Número em destaque", campos: ["titulo", "numero", "rotulo", "texto", "destaque"] },
  fluxo: { nome: "Fluxo / linha do tempo", campos: ["titulo", "itens", "destaque"], ajuda: { itens: "Uma etapa por linha: Etapa | detalhe. Termine com ! para marcar em vermelho." } },
  tabela: { nome: "Tabela", campos: ["titulo", "itens", "destaque"], ajuda: { itens: "Colunas separadas por |. A primeira linha é o cabeçalho." } },
  aviso: { nome: "Aviso (fundo escuro)", campos: ["titulo", "texto", "destaque"] },
  frase: { nome: "Frase de impacto", campos: ["titulo", "frase", "texto"] },
  indicadores: { nome: "Indicadores comerciais (CRM)", auto: true, campos: ["titulo", "amostras", "amostrasAnterior", "texto"], ajuda: { amostras: "Amostras analisadas no mês (do painel do laboratório)", texto: "Comentário da gestão sobre o mês" } },
  tendencia: { nome: "Tendência de 6 meses (CRM)", auto: true, campos: ["titulo", "texto"] },
  ranking: { nome: "Ranking do destaque (votação)", auto: true, campos: ["titulo", "texto"] },
  destaque: { nome: "Destaque do mês", auto: true, campos: ["titulo", "nome", "setor", "foto", "itens"], ajuda: { nome: "Em branco = 1º lugar do ranking", itens: "Uma linha por qualidade: Rótulo: texto" } },
  combinados: { nome: "Combinados da última reunião", auto: true, campos: ["titulo"] },
  compromissos: { nome: "Próximos passos (ata desta reunião)", auto: true, campos: ["titulo"] },
  encerramento: { nome: "Encerramento", campos: ["titulo", "subtitulo", "texto"] },
};

export const ROTULOS_CAMPOS = {
  titulo: "Título", subtitulo: "Subtítulo", texto: "Texto", itens: "Itens", destaque: "Caixa de destaque",
  numero: "Número grande", rotulo: "Legenda do número", frase: "Frase", nome: "Nome", setor: "Setor",
  foto: "Foto", amostras: "Amostras analisadas no mês", amostrasAnterior: "Amostras no mês anterior",
};

const S = (layout, campos = {}, notas = "") => ({ layout, ...campos, notas });

// ---------------------------------------------------------------- modelos
const MENSAL = () => [
  S("capa", { titulo: "Reunião mensal de resultados", subtitulo: "{mes}", texto: "MinasLab · Laboratório de Controle de Qualidade" }, "Comece no horário. Agradeça a presença e diga o objetivo: alinhar resultados, reconhecer quem se destacou e combinar o próximo mês."),
  S("agenda", { titulo: "Agenda do dia", itens: "Abertura | Calendário e combinados da última reunião\nReconhecimento | Ranking e destaque do mês\nProcessos | Organização, qualidade e avisos\nResultados | Indicadores comerciais de {mes}\nPróximos passos | Metas e compromissos" }, "Mostre a agenda e o tempo de cada parte. Peça que perguntas fiquem para o fim de cada bloco."),
  S("combinados", { titulo: "O que combinamos na última reunião" }, "Passe item por item: feito, não feito e por quê. O que não foi feito ganha nova data."),
  S("numero", { titulo: "Abertura & calendário", numero: "{ano}", rotulo: "Cultura de alinhamento", texto: "# Reunião geral\nToda primeira ou segunda segunda-feira do mês.\nReforçamos a importância da participação coletiva para o alinhamento das metas e a melhoria contínua dos processos internos." }),
  S("frase", { titulo: "Dinâmica", frase: "Minha peça no quebra-cabeça", texto: "Cada um conta, em uma frase, como o seu trabalho ajudou o resultado do mês." }, "Até 10 minutos. Comece você, para dar o exemplo."),
  S("colunas", { titulo: "Organização do ambiente", itens: "## Cantina\nLimpa e organizada após o uso.\n## Almoxarifado\nCada item no seu lugar, identificado.\n## Banheiros\nUso consciente e limpo.\n## Estações\nPosto de trabalho em ordem no fim do dia.", destaque: "Risco de segurança: proibido o uso de equipamentos laboratoriais no horário de almoço." }, "Dever de todos: a organização impacta diretamente a eficiência e a imagem profissional do laboratório."),
  S("topicos", { titulo: "Qualidade do laboratório", texto: "# Principal objetivo\nGarantir a excelência e a conformidade dos processos, atendendo à ISO/IEC 17025.\n# Responsabilidades-chave\nConformidade dos processos e registros com a ISO/IEC 17025\nApoio à equipe nas rotinas e demandas da qualidade\nControle de estoques de materiais, reagentes e consumíveis\nAcompanhamento de compras e reposição de insumos\nMelhoria contínua e eficiência operacional", destaque: "Fortalecer a cultura da qualidade: resultados confiáveis, processos organizados e suporte ao crescimento do laboratório." }),
  S("topicos", { titulo: "Qualidade documental", texto: "# Comunicação interna\nObjetividade e clareza no registro de informações\nSem rasuras: folhas de análise devem ser impecáveis\nPrazos: entrega imediata após a finalização da análise", destaque: "“Erros de comunicação são a maior causa de retrabalho e atrasos.”" }),
  S("numero", { titulo: "Política de atestados", numero: "24h", rotulo: "Prazo limite", texto: "Importante: atestado não entregue no prazo gera desconto em folha e não pode ser compensado no banco de horas.\nProgramação: horas ausentes sem justificativa legal devem ser agendadas antes no banco de horas." }, "Fale da regra, nunca de casos de pessoas."),
  S("fluxo", { titulo: "Compras programadas", itens: "Identificação | Análise de estoque por setor\nSolicitação | Envio do pedido pela planilha\nDia 19 | Prazo máximo do mês!\nRecebimento | Conferência e organização", destaque: "Objetivo: evitar pedidos emergenciais, que atrapalham o fluxo e geram desperdício." }),
  S("aviso", { titulo: "Horas extras", texto: "As horas extras só podem ser feitas com AUTORIZAÇÃO PRÉVIA da liderança.", destaque: "O descumprimento será tratado como irregularidade administrativa." }),
  S("indicadores", { titulo: "Indicadores comerciais · {mes}", amostras: "", amostrasAnterior: "", texto: "" }, "Abra com o valor aprovado e a meta. Compare com o mês anterior. Explique a queda ou a alta com um motivo concreto."),
  S("tendencia", { titulo: "Propostas e valor aprovado · últimos 6 meses", texto: "" }, "Estamos subindo ou caindo? O que mudou nos meses de queda?"),
  S("colunas", { titulo: "Modelo híbrido do destaque", itens: "## Avaliação da equipe · {pesoEquipe}%\nVotação anônima por link, notas de 0 a 10\n- Trabalho em equipe\n- Comunicação\n- Colaboração com colegas\n- Organização do ambiente\n- Postura profissional\n## Avaliação da liderança · {pesoLideranca}%\n10 critérios de 0 a 5, convertidos para 0 a 10\n- Prazos e metas · Qualidade técnica\n- Normas sanitárias · Organização\n- Comunicação · Proatividade\n- Assiduidade · Materiais\n- Ética · Colaboração", destaque: "Total = equipe × {pesoEquipe}% + liderança × {pesoLideranca}%, as duas de 0 a 10. Advertência ou falha grave tira da disputa do mês." }, "Explique o cálculo uma vez por trimestre ou quando entrar gente nova. Transparência aumenta a confiança no resultado."),
  S("ranking", { titulo: "Ranking do mês · {mes}", texto: "Sempre mostramos os 3 primeiros." }, "Anuncie do 3º para o 1º. Diga o que cada um fez de concreto."),
  S("destaque", { titulo: "Destaque do mês", nome: "", setor: "", foto: "", itens: "Laboratório: excelência nos processos\nDesempenho: prontidão e agilidade operacional\nPrecisão: assertividade em todas as demandas" }, "Reconhecimento específico: o fato, o número e o impacto para a equipe."),
  S("colunas", { titulo: "Metas gerais", itens: "## Prazos de análise\nCumprimento rigoroso dos prazos acordados. O tempo é o nosso principal ativo.\n## Qualidade\nPadrão de excelência técnica nas entregas. Erro zero como meta.\n## Produtividade\nOrganização física e comunicação eficiente para produzir mais com menos esforço." }),
  S("compromissos", { titulo: "Próximos passos" }, "Leia a ata: cada compromisso com dono e prazo. Ela abre a próxima reunião."),
  S("encerramento", { titulo: "Obrigado!", subtitulo: "MinasLab · Compromisso com a Qualidade", texto: "Organização, Comunicação e União." }),
];

const INTEGRACAO = () => [
  S("capa", { titulo: "Integração e Capacitação Técnica", subtitulo: "Manual de padronização MinasLab", texto: "Bem-vindo ao time! Este treinamento alinha suas atividades à norma ABNT NBR ISO/IEC 17025, garantindo qualidade, conformidade técnica e integridade em todos os nossos ensaios." }, "Módulo 1: boas-vindas e visão geral. Apresente-se e peça que a pessoa conte a experiência anterior."),
  S("colunas", { titulo: "Introdução à ISO/IEC 17025", itens: "## O que é a norma?\nÉ o padrão internacional que define os requisitos para a competência de laboratórios de ensaio e calibração.\nEla garante que o laboratório trabalhe de forma consistente, com resultados tecnicamente válidos e a confiança dos clientes.\n## Por que é essencial?\n- Validade técnica: métodos e instrumentos calibrados e validados\n- Reconhecimento global: resultados aceitos em auditorias nacionais e internacionais\n- Proteção legal: resguardo jurídico para o laboratório e para os clientes" }),
  S("colunas", { titulo: "Os 4 pilares da ISO 17025", itens: "## Imparcialidade\nNenhuma decisão técnica, amostragem ou resultado sofre influência comercial, financeira ou pessoal.\n## Rastreabilidade\nTodo resultado pode ser relacionado a padrões de referência certificados.\n## Competência técnica\nTreinamento rigoroso, calibração de instrumentos e validação de pessoal para executar os métodos.\n## Garantia da qualidade\nCartas de controle, análises em duplicata e participação em ensaios de proficiência." }),
  S("topicos", { titulo: "Nosso escopo acreditado (CRL 1943)", texto: "Somos um laboratório acreditado pela CGCRE (Inmetro) sob o número CRL 1943.\nA acreditação comprova nossa conformidade em análises ambientais de águas brutas, tratadas, subterrâneas e residuais, além de amostragem em campo.", destaque: "Importante: para ensaios fora do escopo de acreditação, consulte a tabela atualizada na pasta Comercial › Portarias e Escopo." }),
  S("colunas", { titulo: "Matrizes analíticas e portfólio", itens: "## Água\nBruta, tratada, consumo humano, salina, salobra, subterrânea e mineral (artesianos, cisternas, hemodiálise).\n## Efluentes e ETE\nIndustriais e domésticos em ETEs, fossas, tanques sépticos, lodos ativados e caixas separadoras.\n## Solo\nMetais, classificação de resíduos sólidos (NBR 10.004), investigação de contaminação e lodos.\n## Ar\nQualidade do ar interno e externo, emissões gasosas e controle de fluxo.\n## Alimentos e lácteos\nFísico-químico e microbiológico de leite, queijos, ricota, mel, ovos e rações.\n## Hospitais e saúde\nHemodiálise, dialisato, água purificada e injetável, swab de superfícies e manipuladores." }),
  S("fluxo", { titulo: "Fluxo de excelência operacional", itens: "Coleta | Campo certificado\nTransporte | Logística controlada\nRecebimento | Triagem e codificação\nAnálise | Laboratório\nValidação | Dupla checagem\nRelatório | Laudo rastreável", destaque: "Cada etapa é monitorada para garantir a integridade da amostra e a precisão do resultado final." }),
  S("tabela", { titulo: "Ensaios químicos (CRL 1943)", itens: "Classe de ensaio | Parâmetros principais acreditados | Método de referência\nFísico-química básica | Acidez, alcalinidade, condutividade, cor aparente e verdadeira, turbidez | SMWW 24ª ed. · colorimétricos e titulométricos\nDureza e cálculos | Dureza total, cálcica e magnésio; cálculo de cálcio e magnésio | SMWW 24ª ed. · 2340 C / EDTA\nSólidos e resíduos | Sólidos totais, dissolvidos, suspensos (fixos e voláteis), sedimentáveis | SMWW 24ª ed. · 2540 B/C/D/E/F\nMetais | Fe, Mn, Cu, Cr, Ni, Zn, K | POP-LAB-013 a 019 · colorimetria e espectrofotometria\nCargas orgânicas | DBO, DQO, óleos e graxas, carbono orgânico total | SMWW · POP-LAB-021 · 5520 D/F" }),
  S("colunas", { titulo: "Ecológicos, biológicos e amostragem", itens: "## Ensaios biológicos acreditados\n- Coliformes totais e termotolerantes (NMP e membrana)\n- Escherichia coli e enterococos\n- Bactérias heterotróficas (inoculação em profundidade)\n- Esporos de bactérias aeróbias e endotoxina bacteriana\n## Amostragem acreditada em campo\n- ETA, reservatórios, caixas d'água e bebedouros\n- Efluentes industriais e domésticos em ETEs, fossas e tanques\n- Poços de monitoramento com amostrador Bailer" }),
  S("colunas", { titulo: "Dependências entre ensaios", itens: "## Ensaios solicitados\nDBO, óleos minerais, nitrogênio orgânico, cromo trivalente, cloro combinado\n## Exigem também\nDQO; óleos totais + animais + vegetais; N total + amoniacal; cromo hexa + total; cloro livre + total\n## Sódio e cloretos\nO sódio só é liberado depois do resultado de cloretos.\n## Dureza de magnésio\nExige dureza cálcica e total para aplicar a fórmula.\n## Metais totais × solúveis\nConfirme sempre na legislação antes de ofertar: os limites são muito diferentes." }, "Comercial: ao montar a proposta, inclua os ensaios dos quais o pedido depende."),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "6 °C", rotulo: "Limite máximo para águas", texto: "# Regra geral de recebimento\nAmostras de água devem chegar a até 6 °C.\nAcima disso, abra uma Não Conformidade (NC) de temperatura na triagem, na hora.", destaque: "Exceção: alguns clientes são isentos de NC automática por temperatura. Consulte a lista atualizada com a Qualidade." }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "9 °C", rotulo: "Limite máximo para esponjas", texto: "# Regra geral de recebimento\nAmostras de esponjas devem chegar a até 9 °C.\nAcima disso, abra uma NC de temperatura na triagem, na hora." }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "Vide rótulo", rotulo: "Limite para alimentos", texto: "# Temperatura\nAlimentos devem chegar na temperatura indicada no rótulo.\nAcima do valor do rótulo: abra NC na triagem.\nRótulo sem temperatura: NC não é obrigatória (não há referência para comparar).\n# Condições de recepção\nEmbalagem íntegra, sem vazamento · identificação correta · volume suficiente para todos os ensaios", destaque: "Gera NC: temperatura acima do rótulo, embalagem violada, volume insuficiente, cor ou aparência incompatível com o produto." }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "N/A", rotulo: "Solo", texto: "Solo não tem exigência legal ou técnica de conservação térmica.\nNão registre NC por temperatura em solo.\nPode ser recebido em temperatura ambiente, sem sinais de degradação, vazamento ou contaminação externa.\n# Gera NC em solo\nOdor forte indicando contaminação não declarada · frasco ou saco violado ou aberto · volume insuficiente · misturado com água · identificação ausente ou incorreta" }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "N/A", rotulo: "Placas de microbiologia", texto: "Placas de monitoramento NÃO devem ser refrigeradas.\nEntrega no mesmo dia do monitoramento, em temperatura ambiente.\nPlacas geladas: NC automática.\n# Condições de recepção\nPlacas íntegras, sem rachaduras · identificação correta (ponto, data, horário) · sem condensação · sem contaminação externa" }),
  S("colunas", { titulo: "Recepção: frascos, gelo e placas", itens: "## Frascos adequados\nUse sempre frascos do laboratório. Frasco do cliente causa interferência química ou biológica e abre NC automática.\n## Gelo individualizado\nOriente o cliente: gelo ensacado individualmente. A água do degelo nunca pode tocar tampas e frascos.\n## Placas de microbiologia\nNUNCA refrigerar. Enviar em temperatura ambiente no mesmo dia do monitoramento.", destaque: "Textos padrão no laudo: “Amostra chegou em temperatura superior a 6 °C, o que pode ou não interferir nos resultados.” · “Amostra entregue em frasco do cliente, o que pode ou não interferir nos resultados.”" }),
  S("topicos", { titulo: "Suas responsabilidades no time", texto: "Conferência completa: temperatura, tipos de frasco, lacres e se o volume cobre todas as análises\nRegistro rápido de NC: registre em detalhe toda não conformidade da triagem\nFaturamento correto: cobranças casadas (swab + placa de PCA; hemocultura + placa de PCA)\nPostura ISO 17025: técnica, confidencial e imparcial em toda comunicação" }),
  S("topicos", { titulo: "Verificação de aprendizado", texto: "1. Até quantos graus uma amostra de água pode chegar sem abrir NC?\n2. O que fazer quando a placa de microbiologia chega gelada?\n3. Solo chegou em temperatura ambiente, sem sinais de degradação: abre NC?\n4. Cite os 4 pilares da ISO/IEC 17025.\n5. Qual ensaio precisa do resultado de cloretos antes de ser liberado?" }, "Respostas: 1) 6 °C · 2) NC automática · 3) Não · 4) Imparcialidade, rastreabilidade, competência técnica, garantia da qualidade · 5) Sódio. Registre as notas em Treinamentos › Registrar aplicação."),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: "A aplicação rigorosa dessas regras constrói nossa autoridade técnica e garante resultados incontestáveis.", texto: "MinasLab Análises Ambientais · Excelência, Precisão, Imparcialidade e Agilidade" }),
];

const TREINAMENTO = () => [
  S("capa", { titulo: "Nome do treinamento", subtitulo: "Treinamento MinasLab", texto: "Para quem: ____ · Duração: 30 min" }),
  S("numero", { titulo: "Por que este treinamento", numero: "00%", rotulo: "o número que queremos mudar", texto: "Explique de onde vem o número e o que acontece se ele não mudar." }, "Todo treinamento ataca um número que o sistema mostra. Meça de novo 30 dias depois."),
  S("topicos", { titulo: "Objetivo", texto: "Ao final, cada pessoa será capaz de:\n____\n____" }),
  S("colunas", { titulo: "O que você precisa saber", itens: "## Ponto 1\nExplicação curta\n## Ponto 2\nExplicação curta\n## Ponto 3\nExplicação curta" }),
  S("numero", { titulo: "Regra de ouro", numero: "1", rotulo: "regra que ninguém pode esquecer", texto: "Escreva a regra em uma frase." }),
  S("fluxo", { titulo: "Passo a passo", itens: "Passo 1 | detalhe\nPasso 2 | detalhe\nPasso 3 | detalhe" }),
  S("topicos", { titulo: "Na prática", texto: "Exercício com um caso real da casa:\n____" }, "Use um caso do mês. Exemplo genérico ensina menos."),
  S("topicos", { titulo: "Verificação de aprendizado", texto: "1. ____\n2. ____\n3. ____" }),
  S("compromissos", { titulo: "Compromissos" }),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: "Obrigado pela atenção!", texto: "MinasLab · Compromisso com a Qualidade" }),
];

const LIVRE = () => [
  S("capa", { titulo: "Título da apresentação", subtitulo: "{mes}", texto: "" }),
  S("topicos", { titulo: "Tópico", texto: "Primeiro ponto\nSegundo ponto" }),
  S("encerramento", { titulo: "Obrigado!", subtitulo: "MinasLab · Compromisso com a Qualidade", texto: "" }),
];

export const MODELOS = [
  { id: "mensal", categoria: "reuniao", nome: "Reunião mensal de resultados", desc: "A reunião geral do mês: calendário, avisos, indicadores do CRM, ranking e destaque. Você só completa o que mudou.", titulo: "Reunião mensal de resultados · {mes}", slides: MENSAL },
  { id: "integracao", categoria: "treinamento", nome: "Integração de novos colaboradores", desc: "ISO/IEC 17025, escopo CRL 1943, matrizes, recepção de amostras e responsabilidades. Com teste no final.", titulo: "Integração e Capacitação Técnica", slides: INTEGRACAO },
  { id: "treinamento", categoria: "treinamento", nome: "Novo treinamento", desc: "Estrutura pronta: o número que queremos mudar, objetivo, conteúdo, regra de ouro, prática e teste.", titulo: "Novo treinamento", slides: TREINAMENTO },
  { id: "livre", categoria: "ambos", nome: "Em branco", desc: "Capa, um slide e encerramento. Monte do seu jeito.", titulo: "Nova apresentação", slides: LIVRE },
];

export const modeloPorId = (id) => MODELOS.find((m) => m.id === id);

/** Slides novos (com id) de um modelo. */
export function slidesDoModelo(id) {
  return (modeloPorId(id)?.slides() || []).map((s) => ({ ...s, id: novoId("s") }));
}

export function slideEmBranco(layout) {
  const base = { capa: { titulo: "Título" }, encerramento: { titulo: "Obrigado!" } }[layout] || { titulo: LAYOUTS[layout]?.nome || "Slide" };
  return { id: novoId("s"), layout, notas: "", ...base };
}

// ---------------------------------------------------------------- texto
export const linhas = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

/** "## Título" abre bloco; linhas seguintes são o corpo. */
export function blocos(t) {
  const out = [];
  for (const l of linhas(t)) {
    if (l.startsWith("## ")) out.push({ titulo: l.slice(3).trim(), linhas: [] });
    else if (out.length) out.at(-1).linhas.push(l);
    else out.push({ titulo: "", linhas: [l] });
  }
  return out;
}

/** "Título | detalhe" por linha. */
export const pares = (t) => linhas(t).map((l) => { const [a, ...b] = l.split("|"); return { titulo: a.trim(), texto: b.join("|").trim() }; });

/** Troca os marcadores {mes}, {ano}… por valores. */
export function preencher(texto, valores) {
  return String(texto ?? "").replace(/\{(\w+)\}/g, (m, k) => (valores[k] != null ? String(valores[k]) : m));
}
