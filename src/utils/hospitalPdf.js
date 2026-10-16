import { jsPDF } from 'jspdf';

const COLORS = {
  navy: [11, 49, 88],
  blue: [23, 102, 156],
  teal: [0, 155, 154],
  ink: [31, 41, 51],
  muted: [92, 108, 122],
  line: [218, 228, 236],
  pale: [243, 249, 252],
};

const safeText = (value) => String(value ?? '').trim() || 'No registrado';

export function createHospitalPdf({ title, subtitle, patient, sections, generatedBy, watermarkDataUrl }) {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const drawWatermark = () => {
    if (!watermarkDataUrl) return;
    const markWidth = 98;
    const markHeight = 106;
    const x = (pageWidth - markWidth) / 2;
    const markY = 88;
    const transparency = pdf.GState({ opacity: 0.06 });
    pdf.setGState(transparency);
    pdf.addImage(watermarkDataUrl, 'PNG', x, markY, markWidth, markHeight, undefined, 'FAST');
    pdf.setGState(pdf.GState({ opacity: 1 }));
  };

  const drawHeader = () => {
    pdf.setFillColor(...COLORS.navy);
    pdf.rect(0, 0, pageWidth, 46, 'F');
    pdf.setFillColor(...COLORS.teal);
    pdf.rect(0, 44, pageWidth, 2, 'F');

    const textX = margin;
    const textWidth = pageWidth - margin - textX;
    pdf.setTextColor(224, 239, 248);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('HOSPITAL FRANCISCO DE ASÍS', textX, 12);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(15);
    const titleLines = pdf.splitTextToSize(title, textWidth);
    pdf.text(titleLines.slice(0, 2), textX, 23);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(224, 239, 248);
    pdf.text(subtitle, textX, titleLines.length > 1 ? 37 : 33, { maxWidth: textWidth });
    drawWatermark();
    y = 52;
  };

  const drawPatientBand = () => {
    pdf.setFillColor(...COLORS.pale);
    pdf.roundedRect(margin, y, contentWidth, 25, 2, 2, 'F');
    pdf.setFillColor(...COLORS.teal);
    pdf.roundedRect(margin, y, 1.5, 25, 0.7, 0.7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...COLORS.blue);
    pdf.text('PACIENTE', margin + 6, y + 6);
    pdf.setFontSize(11);
    pdf.setTextColor(...COLORS.navy);
    pdf.text(safeText(patient?.name), margin + 6, y + 13, { maxWidth: contentWidth * 0.62 });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(`ID ${safeText(patient?.document)}`, pageWidth - margin - 5, y + 13, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`${safeText(patient?.email)}   ·   ${safeText(patient?.phone)}`, margin + 6, y + 20, { maxWidth: contentWidth - 12 });
    y += 32;
  };

  const drawFooter = () => {
    const pages = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(...COLORS.line);
      pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(`Generado por ${safeText(generatedBy)}  ·  ${new Date().toLocaleString('es-CO')}`, margin, pageHeight - 9, { maxWidth: contentWidth - 25 });
      pdf.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
    }
  };

  const ensureSpace = (height) => {
    if (y + height <= pageHeight - 22) return;
    pdf.addPage();
    drawHeader();
    drawPatientBand();
  };

  drawHeader();
  drawPatientBand();

  sections.forEach((section) => {
    ensureSpace(14);
    pdf.setFillColor(...COLORS.teal);
    pdf.roundedRect(margin, y, 2, 7, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...COLORS.navy);
    pdf.text(section.title, margin + 6, y + 5.2, { maxWidth: contentWidth - 8 });
    pdf.setDrawColor(...COLORS.line);
    pdf.line(margin + 6, y + 9, pageWidth - margin, y + 9);
    y += 13;

    const rows = section.rows || [];
    rows.forEach(({ label, value }) => {
      const valueLines = pdf.splitTextToSize(safeText(value), contentWidth - 53);
      const rowHeight = Math.max(7, valueLines.length * 4.2 + 2);
      ensureSpace(rowHeight + 1);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.muted);
      pdf.text(String(label).toUpperCase(), margin + 4, y + 3.7, { maxWidth: 42 });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.ink);
      pdf.text(valueLines, margin + 49, y + 3.7, { maxWidth: contentWidth - 53 });
      pdf.setDrawColor(...COLORS.line);
      pdf.line(margin + 4, y + rowHeight, pageWidth - margin - 4, y + rowHeight);
      y += rowHeight;
    });

    (section.items || []).forEach((item) => {
      const itemLines = pdf.splitTextToSize(safeText(item), contentWidth - 13);
      const rowHeight = Math.max(7, itemLines.length * 4.2 + 2);
      ensureSpace(rowHeight + 1);
      pdf.setFillColor(...COLORS.teal);
      pdf.circle(margin + 5, y + 2.2, 1, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.ink);
      pdf.text(itemLines, margin + 10, y + 3.7, { maxWidth: contentWidth - 13 });
      pdf.setDrawColor(...COLORS.line);
      pdf.line(margin + 4, y + rowHeight, pageWidth - margin - 4, y + rowHeight);
      y += rowHeight;
    });
    if (!rows.length && !(section.items || []).length) {
      ensureSpace(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.muted);
      pdf.text('No hay registros para este apartado.', margin + 4, y + 3.5);
      y += 9;
    }
    y += 6;
  });

  drawFooter();
  return pdf;
}

async function loadHospitalMark() {
  try {
    const response = await fetch('/hospital-francisco-de-asis-marca.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadHospitalPdf(options, filename) {
  const watermarkDataUrl = await loadHospitalMark();
  const pdf = createHospitalPdf({ ...options, watermarkDataUrl });
  pdf.save(filename);
}

export function pdfFilename(value) {
  const slug = String(value || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'documento'}.pdf`;
}
