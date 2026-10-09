import { useEffect } from "react";
import { clsx } from "../lib/clsx.js";

export function Card({ className, semPad, children, ...r }) {
  return <section className={clsx("card", semPad && "sem-pad", className)} {...r}>{children}</section>;
}

export function Chip({ tom = "neutro", children }) {
  return <span className={`chip ${tom}`}>{children}</span>;
}

export function Kpi({ rotulo, valor, sub, tomSub }) {
  return (
    <Card style={{ padding: 18 }}>
      <div className="kpi-rot">{rotulo}</div>
      <div className="kpi-val tnum">{valor}</div>
      {sub && <div className="kpi-sub" style={tomSub ? { color: `var(--${tomSub})` } : undefined}>{sub}</div>}
    </Card>
  );
}

export function Cabecalho({ sobre, titulo, sub, children }) {
  return (
    <header className="cabecalho">
      <div>
        {sobre && <div className="sobretitulo">{sobre}</div>}
        <h1 style={{ marginTop: 4 }}>{titulo}</h1>
        {sub && <div className="suave peq" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>}
    </header>
  );
}

export function Pontos({ lista }) {
  if (!lista?.length) return <div className="vazio">Nada fora do esperado.</div>;
  return (
    <div>
      {lista.map((p, i) => (
        <div className="ponto" key={i}>
          <span className={`bolinha ${p.tom}`} />
          <div>
            <div style={{ fontWeight: 600 }}>{p.titulo}</div>
            {p.texto && <div className="suave peq" style={{ marginTop: 2 }}>{p.texto}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Barras por mês: enviadas (barra clara) com a parte aprovada (escura).
 * O mês escolhido ganha a cor de destaque; a meta, se houver, vira linha tracejada.
 */
export function GraficoMeses({ serie, mesDestaque, meta, rotuloMes }) {
  const max = Math.max(1, meta || 0, ...serie.map((s) => s.enviadas));
  const altura = 140;
  return (
    <div>
      <div className="graf" role="img" aria-label="Propostas enviadas e aprovadas por mês">
        {meta ? <div className="graf-meta" style={{ bottom: (meta / max) * altura + 1 }} title={`Meta: ${meta}`} /> : null}
        {serie.map((s) => {
          const destaque = s.mes === mesDestaque;
          return (
            <div className="graf-col" key={s.mes} title={`${rotuloMes(s.mes)}: ${s.enviadas} enviadas, ${s.aprovadas} aprovadas`}>
              <span className="graf-val">{s.enviadas}</span>
              <div className="graf-barra" style={{ height: (s.enviadas / max) * altura, background: destaque ? "var(--marca-200)" : "#e3ecec" }}>
                <div style={{ width: "100%", height: s.enviadas ? `${(s.aprovadas / s.enviadas) * 100}%` : 0, background: destaque ? "var(--marca)" : "#8aa5a5" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="graf-rotulos">{serie.map((s) => <span key={s.mes}>{rotuloMes(s.mes)}</span>)}</div>
    </div>
  );
}

export function Modal({ titulo, aoFechar, children }) {
  useEffect(() => {
    const f = (e) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [aoFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p.at(-1)[0] : "")).toUpperCase();
}
