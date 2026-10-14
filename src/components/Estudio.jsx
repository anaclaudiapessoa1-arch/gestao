// Estúdio de apresentações: começa de um modelo MinasLab, edita slide a
// slide (texto simples), apresenta em tela cheia e imprime/salva em PDF.
// Gravação automática na coleção rh_comercial_apresentacoes.
import { useEffect, useMemo, useRef, useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Modal, Paginacao, usePaginacao } from "./ui.jsx";
import { SlideML, Apresentador, ImpressaoDeck, nomeLayout } from "./Deck.jsx";
import { MODELOS, LAYOUTS, ROTULOS_CAMPOS, modeloPorId, slidesDoModelo, slideEmBranco, preencher } from "../lib/modelosApresentacao.js";
import { usePesquisas, rankingDoMes, pesosDestaque } from "../pages/Destaque.jsx";
import { podio } from "../lib/destaque.js";
import { reduzirFoto } from "../lib/foto.js";
import { totaisMes, serie } from "../lib/calculos.js";
import { mesLongo, mesNome, somarMeses, dataCurta, novoId, hojeBR } from "../lib/format.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Dados que os slides automáticos usam: marcadores, CRM, ranking e atas. */
function useContexto(deck) {
  const base = useBase();
  const { resumo, config, dados, elenco } = base;
  const precisaRanking = deck.slides.some((s) => s.layout === "ranking" || (s.layout === "destaque" && !s.nome));
  const pesq = usePesquisas();
  return useMemo(() => {
    const ref = deck.ref || base.mes;
    const ant = somarMeses(ref, -1);
    const pesos = pesosDestaque(dados);
    const valores = { mes: mesLongo(ref), mesAnterior: mesLongo(ant), ano: ref.slice(0, 4), pesoEquipe: pesos.equipe, pesoLideranca: pesos.lideranca };
    const indicadores = resumo ? { t: totaisMes(resumo, ref), ant: totaisMes(resumo, ant), rotulo: cap(mesNome(ref)), rotuloAnt: cap(mesNome(ant)), meta: Number(config.metaValorMensal) || 0 } : null;
    const ser = resumo ? serie(resumo, "equipe", ref, 6) : null;
    const top = precisaRanking ? podio(rankingDoMes({ dados, elenco, pesquisas: pesq.lista, mes: ref }).ranking) : [];
    const anterior = dados.apresentacoes
      .filter((d) => d.modelo === deck.modelo && d.id !== deck.id && String(d.ref) < String(ref))
      .sort((a, b) => String(b.ref).localeCompare(String(a.ref)))[0];
    const fotos = Object.fromEntries((dados.fotos || []).filter((f) => f.foto).map((f) => [f.id, f.foto]));
    return { mes: ref, valores, indicadores, serie: ser, podio: top, fotos, anterior: anterior?.ata || [], ata: deck.ata || [] };
  }, [deck, resumo, config, dados, elenco, pesq.lista, precisaRanking, base.mes]);
}

// ------------------------------------------------------------------ lista
export function Estudio({ categoria }) {
  const { dados, remover } = useBase();
  const [aberto, setAberto] = useState(null);
  const [novo, setNovo] = useState(null);
  const modelos = MODELOS.filter((m) => m.categoria === categoria || m.categoria === "ambos");
  const decks = dados.apresentacoes.filter((d) => d.categoria === categoria).sort((a, b) => String(b.atualizadoEm || b.criadoEm).localeCompare(String(a.atualizadoEm || a.criadoEm)));
  const pag = usePaginacao(decks, 6);
  const deck = decks.find((d) => d.id === aberto);
  if (deck) return <Editor deck={deck} aoVoltar={() => setAberto(null)} />;

  return (
    <>
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {modelos.map((m) => {
          const amostra = { ...m.slides()[0], id: "x" };
          return (
            <Card key={m.id} className="modelo-cartao" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SlideML s={amostra} ctx={{ valores: { mes: "Mês e ano", ano: "2026" } }} />
              <div><b>{m.nome}</b><div className="suave peq" style={{ marginTop: 2 }}>{m.desc}</div></div>
              <button type="button" className="btn mini" style={{ marginTop: "auto", alignSelf: "flex-start" }} onClick={() => setNovo(m)}>Usar este modelo</button>
            </Card>
          );
        })}
      </div>

      <Card semPad>
        <div className="card-cab"><h2>Suas apresentações</h2><span className="suave peq">{decks.length}</span></div>
        {decks.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma ainda. Escolha um modelo acima.</div> : (
          <div className="decks">
            {pag.itens.map((d) => (
              <div key={d.id} className="deck-item">
                <button type="button" className="deck-capa" onClick={() => setAberto(d.id)} aria-label={`Abrir ${d.titulo}`}>
                  <SlideML s={d.slides.find((s) => !s.oculto) || d.slides[0]} ctx={{ valores: { mes: mesLongo(d.ref), ano: d.ref.slice(0, 4) } }} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <b className="deck-tit">{d.titulo}</b>
                  <div className="suave peq">{modeloPorId(d.modelo)?.nome || "Apresentação"} · {mesLongo(d.ref)} · {d.slides.filter((s) => !s.oculto).length} slides</div>
                  <div className="suave peq">Editada em {dataCurta(String(d.atualizadoEm || d.criadoEm).slice(0, 10))}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="btn mini" onClick={() => setAberto(d.id)}>Abrir</button>
                  <button type="button" className="btn claro mini" onClick={() => setNovo({ ...modeloPorId(d.modelo), copiaDe: d })}>Duplicar</button>
                  <button type="button" className="btn perigo mini" onClick={() => window.confirm(`Apagar “${d.titulo}”?`) && remover("apresentacoes", d.id)}>Apagar</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Paginacao pag={pag} rotulo="apresentações" />
      </Card>
      {novo && <NovaApresentacao modelo={novo} categoria={categoria} aoFechar={() => setNovo(null)} aoCriar={(id) => { setNovo(null); setAberto(id); }} />}
    </>
  );
}

function NovaApresentacao({ modelo, categoria, aoFechar, aoCriar }) {
  const { dados, gravar, mes } = useBase();
  const ultima = modelo.copiaDe || dados.apresentacoes.filter((d) => d.modelo === modelo.id).sort((a, b) => String(b.ref).localeCompare(String(a.ref)))[0];
  const [ref, setRef] = useState(modelo.copiaDe ? mes : mes);
  const [titulo, setTitulo] = useState(modelo.copiaDe ? `${modelo.copiaDe.titulo} (cópia)` : preencher(modelo.titulo, { mes: mesLongo(mes) }));
  const [copiar, setCopiar] = useState(!!ultima);
  const [erro, setErro] = useState("");
  const criar = async () => {
    try {
      const slides = copiar && ultima
        ? ultima.slides.map((s) => ({ ...s, id: novoId("s"), ...(s.layout === "indicadores" ? { amostras: "", amostrasAnterior: s.amostras || "", texto: "" } : {}), ...(s.layout === "destaque" ? { nome: "", foto: "", setor: "" } : {}) }))
        : slidesDoModelo(modelo.id);
      const d = await gravar("apresentacoes", { modelo: modelo.id, categoria: modelo.categoria === "ambos" ? categoria : modelo.categoria, titulo: titulo.trim() || modelo.nome, ref, slides, ata: [], atualizadoEm: new Date().toISOString() });
      aoCriar(d.id);
    } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo={modelo.copiaDe ? "Duplicar apresentação" : `Nova: ${modelo.nome}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="na-tit">Título</label><input id="na-tit" className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div className="campo"><label htmlFor="na-ref">Mês de referência</label><input id="na-ref" type="month" className="entrada" style={{ maxWidth: 200 }} value={ref} onChange={(e) => { setRef(e.target.value); if (!modelo.copiaDe) setTitulo(preencher(modelo.titulo, { mes: mesLongo(e.target.value) })); }} /><span className="suave peq">Os números do CRM, o ranking e os textos com o mês seguem este mês.</span></div>
        {ultima && (
          <label className="peq" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" checked={copiar} onChange={(e) => setCopiar(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Aproveitar os textos de <b>{ultima.titulo}</b> (avisos, processos, metas). Números, ranking e destaque são atualizados para o novo mês; a ata começa vazia.</span>
          </label>
        )}
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={criar}>Criar</button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ editor
function Editor({ deck: inicial, aoVoltar }) {
  const { gravar } = useBase();
  const [deck, setDeck] = useState(inicial);
  const [sel, setSel] = useState(0);
  const [modo, setModo] = useState("editar");
  const [estado, setEstado] = useState("salvo");
  const [iAp, setIAp] = useState(0);
  const primeira = useRef(true);
  const ctx = useContexto(deck);
  const visiveis = deck.slides.filter((s) => !s.oculto);
  const s = deck.slides[Math.min(sel, deck.slides.length - 1)];

  // Gravação automática 1,2 s depois da última mudança. As gravações vão em
  // fila (uma resposta antiga nunca passa por cima de uma mais nova) e o que
  // estiver pendente é gravado na hora ao sair do editor.
  const fila = useRef(Promise.resolve());
  const pendente = useRef(null);
  const salvarAgora = () => {
    const d = pendente.current;
    if (!d) return fila.current;
    pendente.current = null;
    setEstado("salvando");
    fila.current = fila.current
      .then(() => gravar("apresentacoes", { ...d, atualizadoEm: new Date().toISOString() }))
      .then(() => { if (!pendente.current) setEstado("salvo"); })
      .catch(() => setEstado("erro"));
    return fila.current;
  };
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    pendente.current = deck;
    setEstado("pendente");
    const t = setTimeout(salvarAgora, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  useEffect(() => () => { salvarAgora(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const voltar = () => { salvarAgora(); aoVoltar(); };

  const mudarSlide = (campos) => setDeck((d) => ({ ...d, slides: d.slides.map((x, k) => (k === sel ? { ...x, ...campos } : x)) }));
  const trocarSlides = (sl, novoSel) => { setDeck({ ...deck, slides: sl }); setSel(novoSel); };
  const mover = (dir) => {
    const j = sel + dir;
    if (j < 0 || j >= deck.slides.length) return;
    const sl = [...deck.slides];
    [sl[sel], sl[j]] = [sl[j], sl[sel]];
    trocarSlides(sl, j);
  };
  const duplicar = () => { const sl = [...deck.slides]; sl.splice(sel + 1, 0, { ...sl[sel], id: novoId("s") }); trocarSlides(sl, sel + 1); };
  const apagar = () => { if (deck.slides.length > 1 && window.confirm("Apagar este slide?")) trocarSlides(deck.slides.filter((_, k) => k !== sel), Math.max(0, sel - 1)); };
  const inserir = (layout) => { const sl = [...deck.slides]; sl.splice(sel + 1, 0, slideEmBranco(layout)); trocarSlides(sl, sel + 1); };
  const apresentar = () => {
    setModo("apresentar");
    const k = visiveis.findIndex((x) => x.id === s?.id);
    setIAp(Math.max(0, k));
    setTimeout(() => document.querySelector(".dk-palco")?.requestFullscreen?.().catch(() => {}), 50);
  };

  return (
    <div className="estudio">
      <div className="estudio-barra">
        <button type="button" className="btn claro mini" onClick={voltar}>‹ Apresentações</button>
        <input className="entrada estudio-titulo" aria-label="Título da apresentação" value={deck.titulo} onChange={(e) => setDeck({ ...deck, titulo: e.target.value })} />
        <input type="month" className="entrada" style={{ width: 160 }} aria-label="Mês de referência" value={deck.ref} onChange={(e) => e.target.value && setDeck({ ...deck, ref: e.target.value })} />
        <span className={`peq estado-${estado}`}>{{ salvo: "✓ Salvo", pendente: "Alterações…", salvando: "Salvando…", erro: "Não salvou. Confira a conexão." }[estado]}</span>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <div className="pilulas" role="tablist">
            <button type="button" role="tab" aria-selected={modo === "editar"} className={`pilula${modo === "editar" ? " ativa" : ""}`} onClick={() => setModo("editar")}>Editar</button>
            <button type="button" role="tab" aria-selected={modo === "apresentar"} className={`pilula${modo === "apresentar" ? " ativa" : ""}`} onClick={() => setModo("apresentar")}>Ver como apresentação</button>
          </div>
          <button type="button" className="btn claro" onClick={() => window.print()}>PDF / imprimir</button>
          <button type="button" className="btn" onClick={apresentar}>Apresentar</button>
        </div>
      </div>

      {modo === "apresentar" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Apresentador slides={visiveis} ctx={ctx} i={iAp} setI={setIAp} />
          <div className="miniaturas-linha">
            {visiveis.map((x, k) => <button key={x.id} type="button" className={`mini-slide${k === iAp ? " ativa" : ""}`} onClick={() => setIAp(k)} aria-label={`Slide ${k + 1}`}><SlideML s={x} ctx={ctx} /></button>)}
          </div>
        </div>
      ) : (
        <div className="estudio-corpo">
          <div className="estudio-lista" aria-label="Slides">
            {deck.slides.map((x, k) => (
              <button key={x.id} type="button" className={`mini-slide${k === sel ? " ativa" : ""}${x.oculto ? " oculto" : ""}`} onClick={() => setSel(k)} aria-label={`Slide ${k + 1}: ${nomeLayout(x.layout)}`}>
                <span className="mini-num">{k + 1}</span>
                <SlideML s={x} ctx={ctx} />
              </button>
            ))}
            <NovoSlide aoEscolher={inserir} />
          </div>

          <div className="estudio-palco">
            {s && <SlideML s={s} ctx={ctx} n={visiveis.indexOf(s) + 1 || null} total={visiveis.length} />}
            <div className="estudio-acoes">
              <button type="button" className="btn claro mini" onClick={() => mover(-1)} disabled={sel === 0}>↑ Subir</button>
              <button type="button" className="btn claro mini" onClick={() => mover(1)} disabled={sel >= deck.slides.length - 1}>↓ Descer</button>
              <button type="button" className="btn claro mini" onClick={duplicar}>Duplicar</button>
              <button type="button" className="btn claro mini" onClick={() => mudarSlide({ oculto: !s.oculto })}>{s?.oculto ? "Mostrar na apresentação" : "Esconder na apresentação"}</button>
              <button type="button" className="btn perigo mini" onClick={apagar} disabled={deck.slides.length <= 1}>Apagar</button>
            </div>
            {s?.oculto && <div className="aviso alerta peq">Este slide está escondido: não aparece ao apresentar nem no PDF.</div>}
          </div>

          {s && <Campos s={s} aoMudar={mudarSlide} />}
        </div>
      )}

      {(deck.categoria === "reuniao" || deck.slides.some((x) => x.layout === "compromissos")) && <AtaDeck deck={deck} aoMudar={(ata) => setDeck((d) => ({ ...d, ata }))} />}
      <ImpressaoDeck slides={visiveis} ctx={ctx} />
    </div>
  );
}

function NovoSlide({ aoEscolher }) {
  const [v, setV] = useState("");
  return (
    <select className="entrada peq" aria-label="Adicionar slide" value={v} onChange={(e) => { if (e.target.value) { aoEscolher(e.target.value); setV(""); } }}>
      <option value="">+ Adicionar slide…</option>
      {Object.entries(LAYOUTS).map(([id, l]) => <option key={id} value={id}>{l.nome}</option>)}
    </select>
  );
}

function Campos({ s, aoMudar }) {
  const l = LAYOUTS[s.layout] || LAYOUTS.topicos;
  const longos = ["texto", "itens"];
  return (
    <div className="estudio-campos">
      <div className="campo">
        <label htmlFor="c-layout">Tipo de slide</label>
        <select id="c-layout" className="entrada" value={s.layout} onChange={(e) => aoMudar({ layout: e.target.value })}>
          {Object.entries(LAYOUTS).map(([id, x]) => <option key={id} value={id}>{x.nome}</option>)}
        </select>
        {l.auto && <span className="suave peq">Preenchido sozinho com os dados do sistema.</span>}
      </div>
      {l.campos.map((c) => (
        <div className="campo" key={c}>
          <label htmlFor={`c-${c}`}>{ROTULOS_CAMPOS[c] || c}</label>
          {c === "foto" ? <Foto valor={s.foto} aoMudar={(foto) => aoMudar({ foto })} />
            : longos.includes(c) ? <textarea id={`c-${c}`} className="entrada mono" rows={c === "itens" || s.layout === "topicos" || s.layout === "numero" ? 8 : 3} value={s[c] || ""} onChange={(e) => aoMudar({ [c]: e.target.value })} />
            : <input id={`c-${c}`} className="entrada" value={s[c] || ""} onChange={(e) => aoMudar({ [c]: e.target.value })} />}
          {l.ajuda?.[c] && <span className="suave peq">{l.ajuda[c]}</span>}
        </div>
      ))}
      <div className="campo">
        <label htmlFor="c-notas">Roteiro de fala (só você vê)</label>
        <textarea id="c-notas" className="entrada" rows={3} value={s.notas || ""} onChange={(e) => aoMudar({ notas: e.target.value })} />
      </div>
      <div className="suave peq">Marcadores: {"{mes}"}, {"{mesAnterior}"}, {"{ano}"} viram o mês da apresentação.</div>
    </div>
  );
}

/** Foto reduzida no próprio navegador (até 360 px, JPEG) para caber no registro. */
function Foto({ valor, aoMudar }) {
  const [erro, setErro] = useState("");
  const escolher = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    reduzirFoto(f).then((url) => { aoMudar(url); setErro(""); }).catch((ex) => setErro(ex.message));
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {valor && <img src={valor} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />}
      <input type="file" accept="image/*" onChange={escolher} aria-label="Foto" className="peq" />
      {valor && <button type="button" className="btn claro mini" onClick={() => aoMudar("")}>Tirar foto</button>}
      {erro && <span className="peq" style={{ color: "var(--ruim)" }}>{erro}</span>}
      <span className="suave peq" style={{ width: "100%" }}>Use foto só com autorização da pessoa.</span>
    </div>
  );
}

function AtaDeck({ deck, aoMudar }) {
  const ata = deck.ata || [];
  const [f, setF] = useState({ tipo: "compromisso", texto: "", dono: "", prazo: "" });
  const add = () => { if (!f.texto.trim()) return; aoMudar([...ata, { id: novoId("i"), ...f, texto: f.texto.trim(), feito: false, em: hojeBR() }]); setF({ ...f, texto: "", dono: "", prazo: "" }); };
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><h2>Ata da reunião</h2><span className="suave peq">{ata.length} item(ns) · entra no slide “Próximos passos” e abre a próxima reunião</span></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "flex-end" }}>
        <div className="campo"><label htmlFor="ad-tipo">Tipo</label><select id="ad-tipo" className="entrada" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="compromisso">Compromisso</option><option value="decisao">Decisão</option></select></div>
        <div className="campo" style={{ flex: "2 1 260px" }}><label htmlFor="ad-txt">O quê</label><input id="ad-txt" className="entrada" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} /></div>
        <div className="campo" style={{ flex: "1 1 140px" }}><label htmlFor="ad-dono">Quem</label><input id="ad-dono" className="entrada" value={f.dono} onChange={(e) => setF({ ...f, dono: e.target.value })} /></div>
        <div className="campo"><label htmlFor="ad-prazo">Até</label><input id="ad-prazo" type="date" className="entrada" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></div>
        <button type="button" className="btn" onClick={add}>Adicionar</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {ata.map((i) => (
          <div key={i.id} className="ponto" style={{ alignItems: "center" }}>
            <input type="checkbox" aria-label="Feito" checked={!!i.feito} style={{ width: 18, height: 18 }} onChange={() => aoMudar(ata.map((x) => (x.id === i.id ? { ...x, feito: !x.feito } : x)))} />
            <Chip tom={i.tipo === "decisao" ? "marca" : "neutro"}>{i.tipo === "decisao" ? "Decisão" : "Compromisso"}</Chip>
            <div style={{ flex: 1, textDecoration: i.feito ? "line-through" : "none" }}>{i.texto}<span className="suave peq">{i.dono ? ` · ${i.dono}` : ""}{i.prazo ? ` · até ${dataCurta(i.prazo)}` : ""}</span></div>
            <button type="button" className="btn perigo mini" onClick={() => aoMudar(ata.filter((x) => x.id !== i.id))}>Tirar</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
