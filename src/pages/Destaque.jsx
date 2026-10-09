// Destaque do Mês (para toda a MinasLab): votação anônima da equipe por link,
// avaliação da liderança e o ranking pelo modelo híbrido (equipe 40% +
// liderança 60%, as duas de 0 a 10). Também mostra como a equipe avalia a gestão.
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal, Abas, Paginacao, usePaginacao, iniciais } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { listarPesquisas, criarPesquisa, maisCodigos, mudarStatus, apagarPesquisa, linkVotacao } from "../services/pesquisa.js";
import { CRITERIOS_LIDERANCA, MOTIVOS_ELIMINATORIOS, PESOS_PADRAO, rankingDestaque, podio, mediaLideranca } from "../lib/destaque.js";
import { PERGUNTAS_EQUIPE, PERGUNTAS_GESTAO } from "../../supabase/functions/ml-comercial/pesquisa.mjs";
import { mesLongo, mesNome, dataCurta, numero } from "../lib/format.js";
import { getSessao } from "../lib/sessao.js";

const nota1 = (x) => (x == null ? "—" : Number(x).toFixed(1).replace(".", ","));

export function usePesquisas() {
  const { setCrmCache } = useBase();
  const p = useCRM("pesquisas", listarPesquisas);
  const trocar = (pesq) => setCrmCache((c) => {
    const lista = (c.pesquisas?.dados || []).filter((x) => x.id !== pesq.id);
    return { ...c, pesquisas: { dados: [pesq, ...lista].sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm))), em: Date.now() } };
  });
  const tirar = (id) => setCrmCache((c) => ({ ...c, pesquisas: { dados: (c.pesquisas?.dados || []).filter((x) => x.id !== id), em: Date.now() } }));
  return { ...p, lista: p.dados || [], trocar, tirar };
}

/** Pesos do modelo híbrido (registro "destaque" da coleção config). */
export function pesosDestaque(dados) {
  const c = dados.config.find((x) => x.id === "destaque");
  return { equipe: numero(c?.pesos?.equipe) ?? PESOS_PADRAO.equipe, lideranca: numero(c?.pesos?.lideranca) ?? PESOS_PADRAO.lideranca };
}

/** Ranking do mês com o que houver: votação encerrada do mês + avaliações da liderança. */
export function rankingDoMes({ dados, elenco, pesquisas, mes }) {
  const pesq = pesquisas.find((p) => p.mes === mes && p.status === "encerrada") || null;
  const pessoas = pesq?.avaliados?.length ? pesq.avaliados : elenco.map((p) => ({ id: p.id, nome: p.nome }));
  const avaliacoes = dados.destaque.filter((a) => a.mes === mes);
  return { pesq, ranking: rankingDestaque({ pessoas, equipe: pesq?.resultado, avaliacoes, pesos: pesosDestaque(dados) }) };
}

export default function Destaque() {
  const [aba, setAba] = useState("votacao");
  const { mes } = useBase();
  return (
    <>
      <Cabecalho sobre="Destaque do mês" titulo="Votação, avaliação e ranking" sub="Para toda a MinasLab. A equipe vota por link, sem login e sem nome; a liderança avalia aqui; o ranking fecha sozinho.">
        {aba !== "votacao" && <SeletorMes />}
      </Cabecalho>
      <Abas valor={aba} aoMudar={setAba} abas={[["votacao", "Votação da equipe"], ["lideranca", `Avaliação da liderança · ${mesNome(mes)}`], ["ranking", `Ranking · ${mesNome(mes)}`], ["gestao", "Como avaliam a gestão"]]} />
      {aba === "votacao" && <Votacoes />}
      {aba === "lideranca" && <Lideranca />}
      {aba === "ranking" && <Ranking />}
      {aba === "gestao" && <Gestao />}
    </>
  );
}

// ------------------------------------------------------------------ votações
function Votacoes() {
  const p = usePesquisas();
  const [nova, setNova] = useState(false);
  const [vendo, setVendo] = useState(null);
  const [codigos, setCodigos] = useState(null);
  const [erro, setErro] = useState("");
  const pag = usePaginacao(p.lista, 5);

  const acao = async (fn) => { setErro(""); try { await fn(); } catch (e) { setErro(e.message); } };

  return (
    <>
      <div className="aviso marca peq" style={{ lineHeight: 1.6 }}>
        <b>Como fica anônimo:</b> cada pessoa vota com um código sorteado (imprima as tirinhas, dobre e deixe cada um pegar a sua). O servidor só soma as notas: não guarda nome, login, horário nem a resposta de cada um, e nem você consegue ver qual código foi usado. Médias e comentários só aparecem depois de encerrar e para quem recebeu pelo menos o mínimo de votos.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <h2>Votações</h2>
        <button type="button" className="btn" onClick={() => setNova(true)}>Nova votação</button>
      </div>
      {p.erro && <div className="aviso ruim">{p.erro}</div>}
      {erro && <div className="aviso ruim">{erro}</div>}
      {p.carregando && <div className="vazio">Carregando…</div>}
      {!p.carregando && !p.erro && p.lista.length === 0 && <Card><p className="suave" style={{ margin: 0 }}>Nenhuma votação ainda. Crie a do mês: o sistema gera o link e os códigos para imprimir.</p></Card>}
      {pag.itens.map((v) => (
        <Card key={v.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <h3>{v.titulo}</h3>
              <div className="suave peq">{mesLongo(v.mes)} · criada em {dataCurta(v.criadaEm.slice(0, 10))} · {v.avaliados.length} avaliado(s){v.lideres.length ? ` · ${v.lideres.length} da liderança` : ""}</div>
            </div>
            <Chip tom={v.status === "aberta" ? "ok" : "neutro"}>{v.status === "aberta" ? "Aberta" : "Encerrada"}</Chip>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div><div className="kpi-rot">Votos</div><div className="kpi-val tnum" style={{ fontSize: 26 }}>{v.totalVotos} <span className="suave peq">de {v.codigos.length} códigos</span></div></div>
            <div style={{ flex: "1 1 220px", alignSelf: "center" }}><div className="barra"><div style={{ width: `${v.codigos.length ? (v.totalVotos / v.codigos.length) * 100 : 0}%`, background: "var(--marca)" }} /></div></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {v.status === "aberta" && <button type="button" className="btn claro mini" onClick={() => setCodigos(v)}>Link e códigos</button>}
            {v.status === "encerrada" && <button type="button" className="btn mini" onClick={() => setVendo(v)}>Ver resultado</button>}
            {v.status === "aberta"
              ? <button type="button" className="btn claro mini" onClick={() => window.confirm("Encerrar a votação? Depois de encerrada, os códigos que sobraram não votam mais e o resultado aparece.") && acao(async () => p.trocar(await mudarStatus(v.id, "encerrada")))}>Encerrar e ver resultado</button>
              : <button type="button" className="btn claro mini" onClick={() => acao(async () => p.trocar(await mudarStatus(v.id, "aberta")))}>Reabrir</button>}
            <button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar esta votação e o resultado?") && acao(async () => { await apagarPesquisa(v.id); p.tirar(v.id); })}>Apagar</button>
          </div>
        </Card>
      ))}
      <Paginacao pag={pag} rotulo="votações" />
      {nova && <NovaVotacao aoFechar={() => setNova(false)} aoCriar={(v) => { p.trocar(v); setNova(false); setCodigos(v); }} />}
      {codigos && <LinkCodigos v={p.lista.find((x) => x.id === codigos.id) || codigos} aoFechar={() => setCodigos(null)} aoMudar={p.trocar} />}
      {vendo && <Resultado v={vendo} aoFechar={() => setVendo(null)} />}
    </>
  );
}

function NovaVotacao({ aoFechar, aoCriar }) {
  const { elenco, mes } = useBase();
  const pessoas = [...elenco].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const eu = getSessao()?.nome || "";
  const ehEu = (p) => eu && p.nome.toLowerCase().startsWith(eu.toLowerCase().split(" ")[0]);
  const [titulo, setTitulo] = useState(`Destaque do Mês · ${mesLongo(mes)}`);
  const [avaliados, setAvaliados] = useState(() => new Set(pessoas.filter((p) => !ehEu(p)).map((p) => p.id)));
  const [lideres, setLideres] = useState(() => new Set(pessoas.filter(ehEu).map((p) => p.id)));
  const [extraLider, setExtraLider] = useState(pessoas.some(ehEu) ? "" : eu);
  const [nCod, setNCod] = useState(String(pessoas.length + 2));
  const [minimo, setMinimo] = useState("3");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const alternar = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };

  const criar = async () => {
    setErro("");
    const lid = [...pessoas.filter((p) => lideres.has(p.id)).map((p) => ({ id: p.id, nome: p.nome })), ...extraLider.split(",").map((x) => x.trim()).filter(Boolean).map((nome, i) => ({ id: `lider${i}`, nome }))];
    const av = pessoas.filter((p) => avaliados.has(p.id)).map((p) => ({ id: p.id, nome: p.nome }));
    if (!av.length && !lid.length) { setErro("Escolha quem será avaliado."); return; }
    setSalvando(true);
    try { aoCriar(await criarPesquisa({ titulo, mes, avaliados: av, lideres: lid, codigos: Number(nCod) || av.length, minimo: Number(minimo) || 3 })); } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  return (
    <Modal titulo="Nova votação" aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="campo"><label htmlFor="nv-tit">Título</label><input id="nv-tit" className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div className="suave peq">Mês de referência: <b>{mesLongo(mes)}</b> (mude no seletor de mês antes de criar).</div>
        <div>
          <div className="rotulo">Quem será avaliado pelos colegas ({avaliados.size})</div>
          {pessoas.length === 0 && <div className="aviso alerta peq">Não consegui ler os colaboradores ativos do RH.</div>}
          <div className="lista-marcar">
            {pessoas.map((p) => <label key={p.id}><input type="checkbox" checked={avaliados.has(p.id)} onChange={() => alternar(avaliados, setAvaliados, p.id)} /> {p.nome}</label>)}
          </div>
        </div>
        <div>
          <div className="rotulo">Liderança avaliada pela equipe</div>
          <div className="lista-marcar">
            {pessoas.map((p) => <label key={p.id}><input type="checkbox" checked={lideres.has(p.id)} onChange={() => alternar(lideres, setLideres, p.id)} /> {p.nome}</label>)}
          </div>
          <div className="campo" style={{ marginTop: 8 }}><label htmlFor="nv-lid">Outros nomes da liderança (separe por vírgula)</label><input id="nv-lid" className="entrada" value={extraLider} onChange={(e) => setExtraLider(e.target.value)} placeholder="Ex.: nome da gestora, nome da coordenadora" /></div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="campo"><label htmlFor="nv-cod">Quantos códigos</label><input id="nv-cod" type="number" min="1" max="200" className="entrada num" value={nCod} onChange={(e) => setNCod(e.target.value)} /><span className="suave peq">1 por pessoa que vota, e uma folga</span></div>
          <div className="campo"><label htmlFor="nv-min">Mínimo de votos para mostrar média</label><input id="nv-min" type="number" min="2" max="10" className="entrada num" value={minimo} onChange={(e) => setMinimo(e.target.value)} /></div>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" disabled={salvando} onClick={criar}>{salvando ? "Criando…" : "Criar e gerar códigos"}</button>
        </div>
      </div>
    </Modal>
  );
}

function LinkCodigos({ v, aoFechar, aoMudar }) {
  const link = linkVotacao(v.id);
  const [copiado, setCopiado] = useState("");
  const [erro, setErro] = useState("");
  const copiar = async (t, qual) => { try { await navigator.clipboard.writeText(t); setCopiado(qual); } catch { setCopiado(""); } };
  return (
    <Modal titulo="Link e códigos" aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="campo">
          <label htmlFor="lk">Link único para todos (mande no grupo da equipe)</label>
          <div style={{ display: "flex", gap: 8 }}><input id="lk" className="entrada" readOnly value={link} onFocus={(e) => e.target.select()} /><button type="button" className="btn claro" onClick={() => copiar(link, "link")}>{copiado === "link" ? "Copiado" : "Copiar"}</button></div>
          <span className="suave peq">Cada pessoa abre o link e digita o código que sorteou.</span>
        </div>
        <div className="aviso alerta peq"><b>Não mande o código pelo WhatsApp de cada pessoa:</b> aí você saberia quem tem qual código. Imprima, recorte e deixe cada um sortear o seu.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => window.print()}>Imprimir tirinhas ({v.codigos.length})</button>
          <button type="button" className="btn claro" onClick={async () => { setErro(""); try { aoMudar(await maisCodigos(v.id, 5)); } catch (e) { setErro(e.message); } }}>+ 5 códigos</button>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div className="suave peq">{v.totalVotos} de {v.codigos.length} códigos já usados (não dá para saber quais).</div>
        <div className="impressao">
          <div className="folha-codigos">
            {v.codigos.map((c) => (
              <div key={c} className="tirinha">
                <div className="tirinha-marca">Minas<b>Lab</b> · {v.titulo}</div>
                <div className="tirinha-cod">{c.slice(0, 4)} {c.slice(4)}</div>
                <div className="tirinha-link">{link}</div>
                <div className="tirinha-obs">Voto anônimo: não escreva seu nome. Cada código vale um voto.</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Resultado({ v, aoFechar }) {
  const r = v.resultado;
  const [aberto, setAberto] = useState(null);
  const ordem = [...(r?.equipe || [])].sort((a, b) => (b.media ?? -1) - (a.media ?? -1));
  const pag = usePaginacao(ordem, 8);
  return (
    <Modal titulo={`Resultado · ${v.titulo}`} aoFechar={aoFechar}>
      {!r ? <div className="vazio">Encerre a votação para ver o resultado.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="suave peq">{r.votos} voto(s). Médias de 0 a 10. Quem teve menos de {r.minimo} votos aparece só com a contagem, para não dar para adivinhar quem votou.</div>
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Pessoa</th><th>Votos</th>{PERGUNTAS_EQUIPE.map((q) => <th key={q.id} title={q.texto}>{q.texto.split(" ")[0]}</th>)}<th>Média</th></tr></thead>
              <tbody>
                {pag.itens.map((x) => (
                  <tr key={x.id}>
                    <td>{x.nome}{x.comentarios.length > 0 && <div><button type="button" className="btn-link peq" onClick={() => setAberto(aberto === x.id ? null : x.id)}>{x.comentarios.length} comentário(s)</button></div>}{aberto === x.id && <ul className="peq" style={{ margin: "6px 0 0", paddingLeft: 16 }}>{x.comentarios.map((c, i) => <li key={i}>{c}</li>)}</ul>}</td>
                    <td className="tnum">{x.n}</td>
                    {PERGUNTAS_EQUIPE.map((q, i) => <td key={q.id} className="tnum">{x.oculto ? "—" : nota1(x.medias[i])}</td>)}
                    <td className="tnum"><b>{x.oculto ? "poucos votos" : nota1(x.media)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao pag={pag} rotulo="pessoas" />
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ liderança
function Lideranca() {
  const { dados, elenco, mes } = useBase();
  const p = usePesquisas();
  const pesq = p.lista.find((x) => x.mes === mes);
  const pessoas = pesq?.avaliados?.length ? pesq.avaliados : [...elenco].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((x) => ({ id: x.id, nome: x.nome }));
  const eu = getSessao()?.usuario || "";
  const [ficha, setFicha] = useState(null);
  const pag = usePaginacao(pessoas, 10, mes);
  const avDe = (id) => dados.destaque.filter((a) => a.mes === mes && a.pessoaId === id);
  const feitas = pessoas.filter((x) => avDe(x.id).some((a) => a.avaliador === eu)).length;

  return (
    <>
      <div className="aviso marca peq">10 critérios de 0 a 5 (a mesma régua da planilha). No ranking a nota vira 0 a 10. Se mais de uma pessoa da liderança avaliar, vale a média. Faltas justificadas e atestados não entram na nota.</div>
      <Card semPad>
        <div className="card-cab"><h2>Avaliações de {mesNome(mes)}</h2><span className="suave peq">você avaliou {feitas} de {pessoas.length}</span></div>
        <div className="tabela-caixa">
          <table>
            <thead><tr><th>Pessoa</th><th>Sua avaliação</th><th>Média da liderança</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {pessoas.length === 0 && <tr><td colSpan={5} className="suave">Sem colaboradores do RH para avaliar.</td></tr>}
              {pag.itens.map((x) => {
                const avs = avDe(x.id);
                const minha = avs.find((a) => a.avaliador === eu);
                const ms = avs.map(mediaLideranca).filter((m) => m != null);
                const elim = avs.find((a) => a.eliminatorio);
                return (
                  <tr key={x.id}>
                    <td><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="avatar">{iniciais(x.nome)}</span>{x.nome}</div></td>
                    <td className="tnum">{minha ? nota1(mediaLideranca(minha)) : <Chip tom="alerta">pendente</Chip>}</td>
                    <td className="tnum">{ms.length ? `${nota1((ms.reduce((a, b) => a + b, 0) / ms.length) * 2)} de 10` : "—"}<div className="suave peq">{avs.length} avaliador(es)</div></td>
                    <td>{elim ? <Chip tom="ruim">Não concorre</Chip> : <Chip tom="ok">Concorre</Chip>}</td>
                    <td style={{ textAlign: "right" }}><button type="button" className="btn claro mini" onClick={() => setFicha({ pessoa: x, atual: minha })}>{minha ? "Rever" : "Avaliar"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Paginacao pag={pag} rotulo="pessoas" />
      </Card>
      {ficha && <FichaLideranca {...ficha} mes={mes} aoFechar={() => setFicha(null)} />}
    </>
  );
}

function FichaLideranca({ pessoa, atual, mes, aoFechar }) {
  const { gravar, remover } = useBase();
  const s = getSessao();
  const [notas, setNotas] = useState({ ...(atual?.notas || {}) });
  const [elim, setElim] = useState(atual?.eliminatorio || "");
  const [obs, setObs] = useState(atual?.obs || "");
  const [erro, setErro] = useState("");
  const faltam = CRITERIOS_LIDERANCA.filter((c) => notas[c.id] == null).length;
  const salvar = async () => {
    if (faltam) { setErro(`Faltam ${faltam} critério(s).`); return; }
    try {
      await gravar("destaque", { id: `${mes}_${pessoa.id}_${s.usuario}`, mes, pessoaId: pessoa.id, nome: pessoa.nome, avaliador: s.usuario, avaliadorNome: s.nome, notas, eliminatorio: elim, obs: obs.trim() });
      aoFechar();
    } catch (e) { setErro(e.message); }
  };
  const media = mediaLideranca({ notas });
  return (
    <Modal titulo={`${pessoa.nome} · ${mesNome(mes)}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {CRITERIOS_LIDERANCA.map((c) => (
          <div key={c.id} className="linha-criterio">
            <div><b style={{ fontWeight: 600 }}>{c.nome}</b><div className="suave peq">{c.desc}</div></div>
            <div className="escala escala-5" role="radiogroup" aria-label={c.nome}>
              {[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={notas[c.id] === n} className={`escala-n${notas[c.id] === n ? " ativa" : ""}${n <= 2 ? " baixa" : ""}`} onClick={() => setNotas({ ...notas, [c.id]: n })}>{n}</button>)}
            </div>
          </div>
        ))}
        <div className="campo">
          <label htmlFor="fl-el">Critério eliminatório</label>
          <select id="fl-el" className="entrada" value={elim} onChange={(e) => setElim(e.target.value)}>
            <option value="">Nenhum: concorre ao destaque</option>
            {MOTIVOS_ELIMINATORIOS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <span className="suave peq">Atestado médico entregue no prazo não é eliminatório.</span>
        </div>
        <div className="campo"><label htmlFor="fl-obs">Observação (só para a liderança)</label><textarea id="fl-obs" className="entrada" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <span className="suave peq">Média: {media == null ? "—" : `${nota1(media)} de 5 · ${nota1(media * 2)} de 10`}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {atual && <button type="button" className="btn perigo" onClick={() => window.confirm("Apagar sua avaliação?") && remover("destaque", atual.id).then(aoFechar)}>Apagar</button>}
            <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
            <button type="button" className="btn" onClick={salvar}>Salvar</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ ranking
function Ranking() {
  const base = useBase();
  const { dados, elenco, mes, gravar } = base;
  const p = usePesquisas();
  const { pesq, ranking } = rankingDoMes({ dados, elenco, pesquisas: p.lista, mes });
  const top = podio(ranking);
  const pesos = pesosDestaque(dados);
  const [pe, setPe] = useState(String(pesos.equipe));
  const pag = usePaginacao(ranking, 10, mes);
  const aberta = p.lista.find((x) => x.mes === mes && x.status === "aberta");
  const salvarPesos = () => { const e = Math.min(100, Math.max(0, Number(pe) || 0)); gravar("config", { id: "destaque", pesos: { equipe: e, lideranca: 100 - e } }); };

  return (
    <>
      {!pesq && <div className="aviso alerta">{aberta ? `A votação de ${mesNome(mes)} ainda está aberta (${aberta.totalVotos} votos). Encerre para o ranking usar as notas da equipe.` : `Sem votação encerrada em ${mesNome(mes)}. O ranking precisa das duas notas: equipe e liderança.`}</div>}
      <div className="podio">
        {[1, 0, 2].map((k) => top[k] ? (
          <div key={k} className={`podio-lugar l${k + 1}`}>
            <span className="avatar grande">{iniciais(top[k].nome)}</span>
            <b>{top[k].nome}</b>
            <span className="podio-nota tnum">{nota1(top[k].total)}</span>
            <span className="podio-degrau">{k + 1}º</span>
          </div>
        ) : <div key={k} className={`podio-lugar l${k + 1} vazio-lugar`}><span className="podio-degrau">{k + 1}º</span></div>)}
      </div>
      <Card semPad>
        <div className="card-cab" style={{ alignItems: "center" }}>
          <h2>Ranking de {mesNome(mes)}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} className="peq">
            Peso da equipe <input aria-label="Peso da equipe (%)" className="entrada num" style={{ width: 64, minHeight: 32 }} type="number" min="0" max="100" value={pe} onChange={(e) => setPe(e.target.value)} />% · liderança {100 - (Number(pe) || 0)}%
            {Number(pe) !== pesos.equipe && <button type="button" className="btn mini" onClick={salvarPesos}>Salvar pesos</button>}
          </div>
        </div>
        <div className="tabela-caixa">
          <table>
            <thead><tr><th>#</th><th>Pessoa</th><th>Equipe (0–10)</th><th>Liderança (0–10)</th><th>Total</th><th>Situação</th></tr></thead>
            <tbody>
              {pag.itens.map((x, i) => (
                <tr key={x.id}>
                  <td className="tnum suave">{x.apto && x.completo ? (pag.pagina - 1) * pag.porPagina + i + 1 : "—"}</td>
                  <td>{x.nome}</td>
                  <td className="tnum">{nota1(x.equipe)}<div className="suave peq">{x.votos} voto(s)</div></td>
                  <td className="tnum">{nota1(x.lideranca)}</td>
                  <td className="tnum"><b>{nota1(x.total)}</b></td>
                  <td>{!x.apto ? <Chip tom="ruim">{x.motivo}</Chip> : !x.completo ? <Chip tom="alerta">{x.equipe == null ? "Sem nota da equipe" : "Falta a liderança"}</Chip> : <Chip tom="ok">Concorre</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacao pag={pag} rotulo="pessoas" />
      </Card>
      <div className="suave peq">Total = equipe × {pesos.equipe}% + liderança × {pesos.lideranca}%, as duas de 0 a 10. O ranking entra sozinho na apresentação da Reunião mensal de resultados.</div>
    </>
  );
}

// ------------------------------------------------------------------ gestão
function Gestao() {
  const p = usePesquisas();
  const encerradas = p.lista.filter((x) => x.status === "encerrada" && x.lideres.length);
  const [id, setId] = useState("");
  const v = encerradas.find((x) => x.id === id) || encerradas[0];
  const r = v?.resultado;
  const pagS = usePaginacao(r?.sugestoes || [], 6, v?.id);
  if (!v) return <Card><p className="suave" style={{ margin: 0 }}>Quando uma votação com a liderança for encerrada, o resultado aparece aqui.</p></Card>;
  return (
    <>
      {encerradas.length > 1 && (
        <div className="pilulas">{encerradas.map((x) => <button key={x.id} type="button" className={`pilula${x.id === v.id ? " ativa" : ""}`} onClick={() => setId(x.id)}>{mesNome(x.mes)} {x.mes.slice(0, 4)}</button>)}</div>
      )}
      <div className="grade grade-2" style={{ alignItems: "start" }}>
        {r.gestao.map((g) => (
          <Card key={g.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><h3>{g.nome}</h3><span className="suave peq">{g.n} avaliação(ões)</span></div>
            {g.oculto ? <div className="vazio peq">Menos de {r.minimo} avaliações: a média fica escondida para proteger quem respondeu.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {PERGUNTAS_GESTAO.map((q, i) => (
                  <div key={q.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px 40px", gap: 10, alignItems: "center" }}>
                    <span className="peq" title={q.ajuda}>{q.texto}</span>
                    <div className="barra"><div style={{ width: `${g.medias[i] * 10}%`, background: g.medias[i] >= 8 ? "var(--ok)" : g.medias[i] >= 6 ? "#d97706" : "var(--ruim)" }} /></div>
                    <span className="tnum peq" style={{ textAlign: "right" }}>{nota1(g.medias[i])}</span>
                  </div>
                ))}
                <div style={{ marginTop: 4 }}><b>Média geral: {nota1(g.media)}</b></div>
              </div>
            )}
          </Card>
        ))}
      </div>
      <Card>
        <h3>O que a liderança deveria começar, continuar ou parar</h3>
        {pagS.n === 0 ? <div className="vazio peq">Nenhuma sugestão escrita{r.votos < r.minimo ? ` (ou menos de ${r.minimo} votos)` : ""}.</div> : (
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>{pagS.itens.map((s, i) => <li key={i} style={{ marginTop: 6 }}>{s}</li>)}</ul>
        )}
        <Paginacao pag={pagS} rotulo="sugestões" />
        <div className="aviso marca peq" style={{ marginTop: 12 }}>Leia como presente, não como ataque: agradeça na reunião, escolha 1 ponto para mudar e conte à equipe o que vai fazer. Isso faz as pessoas continuarem respondendo com sinceridade.</div>
      </Card>
    </>
  );
}
