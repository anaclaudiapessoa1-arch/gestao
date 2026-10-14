// Slides no estilo das apresentações da MinasLab (faixa verde-água no topo,
// título em caixa alta, logo no rodapé, cartões claros e escuros). Tudo é
// medido em cqw (largura do slide), então a mesma peça serve de miniatura,
// de slide no editor, de tela cheia e de página impressa.
import { useEffect, useRef, useState } from "react";
import { LAYOUTS, linhas, blocos, pares, preencher } from "../lib/modelosApresentacao.js";
import { brl, pct, mesCurto, dataCurta } from "../lib/format.js";
import { iniciais } from "./ui.jsx";

export function Logo({ claro }) {
  return (
    <div className={`dk-logo${claro ? " claro" : ""}`}>
      <span className="dk-logo-nome">Minas<b>Lab</b></span>
      <span className="dk-logo-sub">Laboratório de Controle de Qualidade</span>
    </div>
  );
}

const T = (txt, ctx) => preencher(txt, ctx.valores);

function Lista({ texto, ctx }) {
  const ls = linhas(T(texto, ctx));
  if (!ls.length) return null;
  const grupos = [];
  for (const l of ls) {
    if (l.startsWith("# ")) grupos.push({ sub: l.slice(2), itens: [] });
    else { if (!grupos.length) grupos.push({ sub: "", itens: [] }); grupos.at(-1).itens.push(l.replace(/^[-•]\s*/, "")); }
  }
  return (
    <div className="dk-lista">
      {grupos.map((g, i) => (
        <div key={i}>
          {g.sub && <div className="dk-sub">{g.sub}</div>}
          {g.itens.length > 0 && <ul>{g.itens.map((x, k) => <li key={k}>{x}</li>)}</ul>}
        </div>
      ))}
    </div>
  );
}

function Destaque({ texto, ctx, escuro }) {
  const t = T(texto, ctx).trim();
  if (!t) return null;
  return <div className={`dk-callout${escuro ? " escuro" : ""}`}>{t}</div>;
}

function Moldura({ s, ctx, n, total, children, classe = "" }) {
  return (
    <div className={`dk-slide ${classe}`}>
      <div className="dk-faixa" />
      {s.titulo && <div className="dk-tit">{T(s.titulo, ctx)}</div>}
      <div className="dk-corpo">{children}</div>
      <div className="dk-rodape"><span /><Logo /><span className="dk-num">{n ? `${n}/${total}` : ""}</span></div>
    </div>
  );
}

// ------------------------------------------------------------- layouts
const RENDER = {
  capa: ({ s, ctx }) => (
    <div className="dk-slide dk-escuro dk-capa">
      <Logo claro />
      <div className="dk-capa-tit">{T(s.titulo, ctx)}</div>
      {s.subtitulo && <div className="dk-capa-sub">{T(s.subtitulo, ctx)}</div>}
      {s.texto && <div className="dk-capa-txt">{T(s.texto, ctx)}</div>}
    </div>
  ),
  encerramento: ({ s, ctx }) => (
    <div className="dk-slide dk-escuro dk-capa">
      <div className="dk-capa-tit grande">{T(s.titulo, ctx)}</div>
      {s.subtitulo && <div className="dk-capa-sub">{T(s.subtitulo, ctx)}</div>}
      {s.texto && <div className="dk-capa-txt">{T(s.texto, ctx)}</div>}
      <div style={{ marginTop: "3cqw" }}><Logo claro /></div>
    </div>
  ),
  agenda: (p) => {
    const its = pares(T(p.s.itens, p.ctx));
    return (
      <Moldura {...p}>
        <div className="dk-agenda" style={{ gridTemplateColumns: `repeat(${Math.min(its.length, 5) || 1}, 1fr)` }}>
          {its.map((x, i) => <div key={i} className="dk-cartao centro"><span className="dk-bola">{i + 1}</span><b>{x.titulo}</b><span>{x.texto}</span></div>)}
        </div>
      </Moldura>
    );
  },
  topicos: (p) => (
    <Moldura {...p}>
      <div className="dk-col"><Lista texto={p.s.texto} ctx={p.ctx} /><Destaque texto={p.s.destaque} ctx={p.ctx} /></div>
    </Moldura>
  ),
  colunas: (p) => {
    const bs = blocos(T(p.s.itens, p.ctx));
    const cols = bs.length <= 3 ? bs.length : bs.length === 4 ? 4 : 3;
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <div className="dk-grade" style={{ gridTemplateColumns: `repeat(${cols || 1}, 1fr)` }}>
            {bs.map((b, i) => (
              <div key={i} className={`dk-cartao${bs.length === 2 && i === 1 ? " escuro" : ""}`}>
                {b.titulo && <b className="dk-cartao-tit">{b.titulo}</b>}
                {b.linhas.some((l) => l.startsWith("- "))
                  ? <>{b.linhas.filter((l) => !l.startsWith("- ")).map((l, k) => <span key={k}>{l}</span>)}<ul>{b.linhas.filter((l) => l.startsWith("- ")).map((l, k) => <li key={k}>{l.slice(2)}</li>)}</ul></>
                  : b.linhas.map((l, k) => <span key={k}>{l}</span>)}
              </div>
            ))}
          </div>
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  numero: (p) => (
    <Moldura {...p}>
      <div className="dk-numero">
        <div className="dk-numero-esq"><div className="dk-grande">{T(p.s.numero, p.ctx)}</div>{p.s.rotulo && <div className="dk-rot">{T(p.s.rotulo, p.ctx)}</div>}</div>
        <div className="dk-col"><Lista texto={p.s.texto} ctx={p.ctx} /><Destaque texto={p.s.destaque} ctx={p.ctx} escuro /></div>
      </div>
    </Moldura>
  ),
  fluxo: (p) => {
    const its = pares(T(p.s.itens, p.ctx));
    return (
      <Moldura {...p}>
        <div className="dk-col" style={{ justifyContent: "center" }}>
          <div className="dk-fluxo" style={{ gridTemplateColumns: `repeat(${its.length || 1}, 1fr)` }}>
            {its.map((x, i) => {
              const alerta = x.titulo.endsWith("!") || x.texto.endsWith("!");
              return <div key={i} className={`dk-etapa${alerta ? " alerta" : ""}`}><span className="dk-ponto" /><b>{x.titulo.replace(/!$/, "")}</b><span>{x.texto.replace(/!$/, "")}</span></div>;
            })}
          </div>
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  tabela: (p) => {
    const ls = linhas(T(p.s.itens, p.ctx)).map((l) => l.split("|").map((c) => c.trim()));
    const [cab = [], ...corpo] = ls;
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <table className="dk-tabela"><thead><tr>{cab.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{corpo.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody></table>
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  aviso: ({ s, ctx }) => (
    <div className="dk-slide dk-escuro dk-aviso">
      <div className="dk-aviso-tit">{T(s.titulo, ctx)}</div>
      <div className="dk-aviso-caixa">
        <div>{T(s.texto, ctx)}</div>
        {s.destaque && <div className="dk-aviso-menor">{T(s.destaque, ctx)}</div>}
      </div>
      <Logo claro />
    </div>
  ),
  frase: (p) => (
    <Moldura {...p}>
      <div className="dk-frase">
        <div className="dk-icone" aria-hidden="true">⚗</div>
        <div className="dk-frase-txt">{T(p.s.frase, p.ctx)}</div>
        {p.s.texto && <div className="dk-frase-sub">{T(p.s.texto, p.ctx)}</div>}
      </div>
    </Moldura>
  ),
  indicadores: (p) => {
    const ind = p.ctx.indicadores;
    if (!ind) return <Moldura {...p}><Aguardando texto="Lendo os números do CRM…" /></Moldura>;
    const linha = (rot, t, amostras, escuro) => (
      <div className="dk-ind-linha">
        <div className="dk-ind-mes">{rot}</div>
        <Tile v={t.enviadas} r="Propostas enviadas" escuro={escuro} />
        <Tile v={t.aprovadas} r="Aprovadas (das enviadas)" />
        <Tile v={t.recusadas} r="Recusadas" escuro={escuro} vermelho />
        <Tile v={brl(t.valorAprovado, true)} r="Aceito no mês (R$)" valor />
        {amostras !== "" && amostras != null && <Tile v={amostras} r="Amostras analisadas" escuro={escuro} />}
      </div>
    );
    const conv = ind.t.taxa;
    const delta = ind.ant.valorAprovado ? ((ind.t.valorAprovado - ind.ant.valorAprovado) / ind.ant.valorAprovado) * 100 : null;
    return (
      <Moldura {...p}>
        <div className="dk-col">
          {linha(ind.rotulo, ind.t, p.s.amostras, true)}
          {linha(ind.rotuloAnt, ind.ant, p.s.amostrasAnterior, true)}
          <div className="dk-ind-rodape">
            <div className="dk-ind-barra"><span>Aprovação</span><div><div style={{ width: `${Math.min(100, conv || 0)}%` }}>{pct(conv)}</div></div></div>
            {ind.meta ? <div className="dk-ind-barra"><span>Meta {brl(ind.meta, true)}</span><div><div style={{ width: `${Math.min(100, (ind.t.valorAprovado / ind.meta) * 100)}%`, background: ind.t.valorAprovado >= ind.meta ? "var(--ok)" : undefined }}>{pct((ind.t.valorAprovado / ind.meta) * 100)}</div></div></div> : null}
            {delta != null && <div className={`dk-delta ${delta >= 0 ? "sobe" : "desce"}`}>{delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))} no valor aprovado frente a {ind.rotuloAnt.toLowerCase()}</div>}
          </div>
          {p.s.texto && <div className="dk-citacao">“{T(p.s.texto, p.ctx)}”</div>}
        </div>
      </Moldura>
    );
  },
  tendencia: (p) => {
    const ser = p.ctx.serie;
    if (!ser) return <Moldura {...p}><Aguardando texto="Lendo os números do CRM…" /></Moldura>;
    const max = Math.max(1, ...ser.map((x) => x.enviadas));
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <div className="dk-barras">
            {ser.map((x) => (
              <div key={x.mes} className={`dk-barra-col${x.mes === p.ctx.mes ? " atual" : ""}`}>
                <span className="dk-barra-val">{brl(x.valorAprovado, true)}</span>
                <div className="dk-barra" style={{ height: `${(x.enviadas / max) * 100}%` }}><div style={{ height: x.enviadas ? `${(x.aprovadas / x.enviadas) * 100}%` : 0 }} /><em>{x.enviadas}</em></div>
                <span className="dk-barra-mes">{mesCurto(x.mes)}</span>
              </div>
            ))}
          </div>
          <div className="dk-legenda"><span><i className="claro" /> propostas enviadas</span><span><i /> aprovadas</span><span>valor aprovado no topo</span></div>
          {p.s.texto && <Destaque texto={p.s.texto} ctx={p.ctx} />}
        </div>
      </Moldura>
    );
  },
  ranking: (p) => {
    const top = p.ctx.podio;
    return (
      <Moldura {...p}>
        <div className="dk-col" style={{ alignItems: "center", justifyContent: "center" }}>
          {p.s.texto && <div className="dk-etiqueta">{T(p.s.texto, p.ctx)}</div>}
          {top?.length ? (
            <div className="dk-ranking">
              <b className="dk-ranking-tit">Os 3 melhores</b>
              {top.map((x, i) => (
                <div key={x.id} className="dk-ranking-l"><span className="dk-ranking-pos">{i + 1}º</span><span className="dk-ranking-nome">{x.nome}</span><span className="dk-ranking-nota">{String(x.total).replace(".", ",")}</span><span className="dk-ranking-det">equipe {String(x.equipe).replace(".", ",")} · liderança {String(x.lideranca).replace(".", ",")}</span></div>
              ))}
            </div>
          ) : <Aguardando texto="O ranking aparece quando a votação do mês for encerrada e a liderança avaliar (menu Destaque do mês)." />}
        </div>
      </Moldura>
    );
  },
  destaque: (p) => {
    const nome = p.s.nome?.trim() || p.ctx.podio?.[0]?.nome || "";
    const its = linhas(T(p.s.itens, p.ctx));
    const icones = ["★", "⚡", "◎", "✓", "♦"];
    return (
      <Moldura {...p} classe="dk-tit-centro">
        <div className="dk-destaque">
          <div className="dk-foto">{p.s.foto ? <img src={p.s.foto} alt="" /> : <span>{nome ? iniciais(nome) : "?"}</span>}</div>
          <div className="dk-col" style={{ justifyContent: "center", gap: "1.2cqw" }}>
            {p.s.setor && <span className="dk-etiqueta verde">{T(p.s.setor, p.ctx)}</span>}
            <div className="dk-destaque-nome">{nome || "Defina o nome ou encerre a votação"}</div>
            <div className="dk-destaque-mes">{p.ctx.valores.mes}</div>
            <div className="dk-destaque-itens">{its.map((x, i) => { const [a, ...b] = x.split(":"); return <div key={i}><span className="dk-ic">{icones[i % icones.length]}</span>{b.length ? <><b>{a}:</b>{b.join(":")}</> : x}</div>; })}</div>
          </div>
        </div>
      </Moldura>
    );
  },
  combinados: (p) => {
    const its = p.ctx.anterior || [];
    return (
      <Moldura {...p}>
        {its.length ? (
          <div className="dk-ata">{its.map((x) => <div key={x.id} className={x.feito ? "feito" : ""}><span className="dk-check">{x.feito ? "✓" : "○"}</span><span>{x.texto}</span><em>{[x.dono, x.prazo && `até ${dataCurta(x.prazo)}`].filter(Boolean).join(" · ")}</em></div>)}</div>
        ) : <Aguardando texto="Primeira reunião registrada: o que for combinado hoje abre a próxima." />}
      </Moldura>
    );
  },
  compromissos: (p) => {
    const its = p.ctx.ata || [];
    return (
      <Moldura {...p}>
        {its.length ? (
          <div className="dk-ata">{its.map((x) => <div key={x.id}><span className="dk-check">{x.tipo === "decisao" ? "◆" : "→"}</span><span>{x.texto}</span><em>{[x.dono, x.prazo && `até ${dataCurta(x.prazo)}`].filter(Boolean).join(" · ")}</em></div>)}</div>
        ) : <div className="dk-ata vazia">{[1, 2, 3].map((i) => <div key={i}><span className="dk-check">→</span><span>______________________________</span><em>quem · até quando</em></div>)}</div>}
      </Moldura>
    );
  },
};

function Tile({ v, r, escuro, vermelho, valor }) {
  return <div className={`dk-tile${escuro ? " escuro" : ""}${valor ? " valor" : ""}`}><b style={vermelho && v ? { color: "#f87171" } : undefined}>{v ?? "—"}</b><span>{r}</span></div>;
}

function Aguardando({ texto }) {
  return <div className="dk-aguardando">{texto}</div>;
}

/** Um slide. `ctx` traz os valores dos marcadores e os dados automáticos. */
export function SlideML({ s, ctx, n, total }) {
  const R = RENDER[s.layout] || RENDER.topicos;
  return <div className="dk"><R s={s} ctx={ctx} n={n} total={total} /></div>;
}

/** Visualizador: slide grande, setas, tela cheia e impressão (um slide por página). */
export function Apresentador({ slides, ctx, i, setI, notas = true }) {
  const palco = useRef(null);
  const [cheia, setCheia] = useState(false);
  const vis = slides;
  const atual = vis[Math.min(i, vis.length - 1)];
  useEffect(() => {
    const f = () => setCheia(document.fullscreenElement === palco.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  useEffect(() => {
    const f = (e) => {
      if (!document.fullscreenElement) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(x + 1, vis.length - 1)); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [vis.length, setI]);
  if (!atual) return <div className="vazio">Nenhum slide visível.</div>;
  return (
    <>
      <div ref={palco} className={`dk-palco${cheia ? " cheia" : ""}`} onClick={(e) => { if (cheia && !e.target.closest("button")) setI((x) => Math.min(x + 1, vis.length - 1)); }}>
        <SlideML s={atual} ctx={ctx} n={i + 1} total={vis.length} />
        <div className="palco-nav">
          <button type="button" aria-label="Slide anterior" onClick={() => setI((x) => Math.max(x - 1, 0))} disabled={i === 0}>‹</button>
          <button type="button" aria-label="Próximo slide" onClick={() => setI((x) => Math.min(x + 1, vis.length - 1))} disabled={i >= vis.length - 1}>›</button>
          {!cheia && <button type="button" aria-label="Tela cheia" title="Apresentar em tela cheia" onClick={() => palco.current?.requestFullscreen?.().catch(() => {})}>⛶</button>}
        </div>
      </div>
      {notas && atual.notas && <div className="aviso marca peq"><b>Roteiro de fala:</b> {atual.notas}</div>}
    </>
  );
}

/** Cópia para impressão/PDF: todos os slides, um por página (só aparece ao imprimir). */
export function ImpressaoDeck({ slides, ctx }) {
  return (
    <div className="impressao" aria-hidden="true">
      {slides.map((s, k) => <div key={s.id || k} className="slide-impresso dk-impresso"><SlideML s={s} ctx={ctx} n={k + 1} total={slides.length} /></div>)}
    </div>
  );
}

export const nomeLayout = (l) => LAYOUTS[l]?.nome || l;
