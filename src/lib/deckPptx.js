// Baixa a apresentação em PowerPoint (.pptx). Cada slide vira uma imagem em
// alta resolução, igual ao que aparece na tela (cores, gráficos, fotos), e o
// roteiro de fala vai para as anotações do apresentador.
import PptxGenJS from "pptxgenjs";
import { toPng } from "html-to-image";

const nomeArquivo = (t) => `${String(t || "Apresentação").replace(/[\\/:*?"<>|]/g, "").trim() || "Apresentação"}.pptx`;

/**
 * slides: os slides visíveis; container: o elemento .impressao do editor
 * (tem um .dk-slide por slide, na mesma ordem).
 */
export async function baixarPptx({ titulo, slides, container, aoProgresso }) {
  container.classList.add("exportando");
  try {
    await document.fonts?.ready;
    await new Promise((r) => setTimeout(r, 150));
    const els = [...container.querySelectorAll(".slide-impresso .dk-slide")];
    if (els.length !== slides.length) throw new Error("Não consegui preparar os slides. Recarregue a página e tente de novo.");
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE"; // 16:9, 13,33 × 7,5 pol
    pptx.title = titulo || "Apresentação";
    pptx.company = "MinasLab";
    for (let i = 0; i < els.length; i++) {
      aoProgresso?.(i + 1, els.length);
      const png = await toPng(els[i], { pixelRatio: 2, cacheBust: true });
      const s = pptx.addSlide();
      s.addImage({ data: png, x: 0, y: 0, w: 13.333, h: 7.5 });
      if (slides[i].notas) s.addNotes(String(slides[i].notas));
    }
    await pptx.writeFile({ fileName: nomeArquivo(titulo) });
  } finally {
    container.classList.remove("exportando");
  }
}
