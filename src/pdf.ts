// @ts-ignore
import html2pdf from 'html2pdf.js';

// Tailwind v4 emits colors in the oklch() color space. The html2canvas engine
// bundled inside html2pdf.js cannot parse oklch(), so every PDF export silently
// failed. This module flattens oklch() to rgb() on a clone right before capture,
// using the browser's own color engine so the PDF matches what's on screen.

const _canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (_canvas) { _canvas.width = 1; _canvas.height = 1; }
const _ctx = _canvas ? _canvas.getContext('2d') : null;
const _colorCache = new Map<string, string>();

// Rasterize a single color token to rgb/rgba via a 1px canvas.
function rasterizeColor(token: string): string {
  const cached = _colorCache.get(token);
  if (cached) return cached;
  if (!_ctx) return token;
  _ctx.clearRect(0, 0, 1, 1);
  _ctx.fillStyle = '#000';
  _ctx.fillStyle = token; // browser accepts oklch() even though it echoes it back as a string
  _ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = _ctx.getImageData(0, 0, 1, 1).data;
  const out = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  _colorCache.set(token, out);
  return out;
}

// Replace every oklch(...) token inside a CSS value (handles gradients, shadows, etc.).
function flattenValue(value: string): string {
  if (!value || value.indexOf('oklch') === -1) return value;
  return value.replace(/oklch\([^)]+\)/g, (m) => rasterizeColor(m));
}

const COLOR_PROPS = [
  'color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor',
  'borderBottomColor', 'borderLeftColor', 'outlineColor', 'boxShadow', 'fill', 'stroke',
  'textDecorationColor', 'columnRuleColor', 'caretColor'
] as const;

// Walk the original (rendered) subtree and its clone in lockstep, copying flattened
// colors onto the clone as inline styles so html2canvas never sees an oklch() value.
function flattenTree(original: HTMLElement, clone: HTMLElement) {
  const origNodes = [original, ...Array.from(original.querySelectorAll<HTMLElement>('*'))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
  const len = Math.min(origNodes.length, cloneNodes.length);
  for (let i = 0; i < len; i++) {
    const computed = window.getComputedStyle(origNodes[i]);
    const cloneStyle = cloneNodes[i].style;
    for (const prop of COLOR_PROPS) {
      const raw = computed[prop as any] as string;
      if (raw && raw.indexOf('oklch') !== -1) {
        (cloneStyle as any)[prop] = flattenValue(raw);
      }
    }
  }
}

export interface PdfOptions {
  filename: string;
  orientation?: 'portrait' | 'landscape';
  // Stamped centered at the bottom of every page, with "Page X of Y" appended,
  // so loose printed sheets can be matched back to their packet and student.
  footerText?: string;
}

export async function exportElementToPdf(element: HTMLElement, { filename, orientation = 'portrait', footerText }: PdfOptions): Promise<void> {
  const marker = 'data-pdf-root';
  element.setAttribute(marker, '1');
  const opt = {
    margin: footerText ? [0.5, 0.5, 0.75, 0.5] as [number, number, number, number] : 0.5, // extra bottom room for the footer line
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    pagebreak: { mode: ['css', 'legacy'] },
    html2canvas: {
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc: Document) => {
        const cloneRoot = clonedDoc.querySelector<HTMLElement>(`[${marker}]`);
        if (cloneRoot) flattenTree(element, cloneRoot);
      }
    },
    jsPDF: { unit: 'in' as const, format: 'letter', orientation }
  };
  try {
    // The worker is a chainable thenable; its typings stop at Promise<void>.
    const worker = html2pdf().set(opt).from(element).toPdf() as any;
    await worker.get('pdf').then((pdf: any) => {
      if (!footerText) return;
      const pageCount = pdf.internal.getNumberOfPages();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(130);
        pdf.text(`${footerText}  —  Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 0.3, { align: 'center' });
      }
    }).save();
  } finally {
    element.removeAttribute(marker);
  }
}
