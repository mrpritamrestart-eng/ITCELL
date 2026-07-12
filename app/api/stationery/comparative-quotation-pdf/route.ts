import fs from "node:fs/promises";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { requireRouteAuth } from "@/lib/route-auth";
import { connectDB } from "@/lib/mongodb";
import QuotationCalculation from "@/models/QuotationCalculation";
import OfficeSetting from "@/models/OfficeSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.25, 0.25, 0.25);

type FontSet = { regular: PDFFont; bold: PDFFont; unicode: boolean };
type CalculationItem = { itemName: string; quantity: number; unit: string };
type FirmRow = { firmName: string; totalAmount: number };
type LeanCalculation = {
  invoiceNo: string;
  month: string;
  status?: string;
  acceptedFirmIndex: number;
  acceptedReason?: string;
  items: Array<{ itemName: string; quantity: number; unit: string }>;
  firms: Array<{ firmName: string; totalAmount: number }>;
};
type Settings = {
  officeName: string;
  districtName: string;
  surveyTitle: string;
  committeeParagraph: string;
  presidentLabel: string;
  memberOneLabel: string;
  memberTwoLabel: string;
  stockRegisterPage: string;
};

function sanitizeFilename(value: string) {
  return String(value || "Comparative-Quotation")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "Comparative-Quotation";
}

function pdfText(value: unknown, unicode: boolean) {
  const text = String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return unicode ? text : text.normalize("NFKD").replace(/[^\x20-\x7E\r\n]/g, "");
}

function formatNumber(value: number) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatMoney(value: number) {
  return `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function formatMonth(month: string) {
  const [year, monthNo] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(Date.UTC(year, monthNo - 1, 1)));
}

async function firstReadable(paths: string[]) {
  for (const path of paths.filter(Boolean)) {
    try { return await fs.readFile(path); } catch { /* try next */ }
  }
  return null;
}

async function loadFonts(pdf: PDFDocument): Promise<FontSet> {
  const regularPaths = [
    process.env.PDF_FONT_PATH || "",
    "C:\\Windows\\Fonts\\Nirmala.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ];
  const boldPaths = [
    process.env.PDF_FONT_BOLD_PATH || "",
    "C:\\Windows\\Fonts\\NirmalaB.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ];

  const regularBytes = await firstReadable(regularPaths);
  if (!regularBytes) {
    return {
      regular: await pdf.embedFont(StandardFonts.TimesRoman),
      bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
      unicode: false,
    };
  }

  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const boldBytes = await firstReadable(boldPaths);
  const bold = boldBytes ? await pdf.embedFont(boldBytes, { subset: true }) : regular;
  return { regular, bold, unicode: true };
}

function breakLongWord(word: string, font: PDFFont, size: number, width: number) {
  const pieces: string[] = [];
  let current = "";
  for (const character of Array.from(word)) {
    const candidate = current + character;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      pieces.push(current);
      current = character;
    } else current = candidate;
  }
  if (current) pieces.push(current);
  return pieces;
}

function wrapText(raw: string, font: PDFFont, size: number, width: number, unicode: boolean) {
  const paragraphs = pdfText(raw, unicode).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      const candidates = font.widthOfTextAtSize(word, size) > width ? breakLongWord(word, font, size, width) : [word];
      for (const part of candidates) {
        const next = current ? `${current} ${part}` : part;
        if (!current || font.widthOfTextAtSize(next, size) <= width) current = next;
        else { lines.push(current); current = part; }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawLines(page: PDFPage, lines: string[], options: { x: number; y: number; font: PDFFont; size: number; lineHeight: number; maxLines?: number; color?: ReturnType<typeof rgb> }) {
  const visible = options.maxLines ? lines.slice(0, options.maxLines) : lines;
  visible.forEach((line, index) => page.drawText(line, { x: options.x, y: options.y - index * options.lineHeight, font: options.font, size: options.size, color: options.color || BLACK }));
  return options.y - visible.length * options.lineHeight;
}

function drawWrapped(page: PDFPage, raw: string, options: { x: number; y: number; width: number; font: PDFFont; size: number; unicode: boolean; lineHeight?: number; maxLines?: number }) {
  return drawLines(page, wrapText(raw, options.font, options.size, options.width, options.unicode), { x: options.x, y: options.y, font: options.font, size: options.size, lineHeight: options.lineHeight || options.size * 1.25, maxLines: options.maxLines });
}

function centerText(page: PDFPage, text: string, y: number, font: PDFFont, size: number, unicode: boolean) {
  const safe = pdfText(text, unicode);
  page.drawText(safe, { x: Math.max((A4_WIDTH - font.widthOfTextAtSize(safe, size)) / 2, 20), y, font, size, color: BLACK });
}

function drawRectGrid(page: PDFPage, x: number, top: number, widths: number[], height: number, headerHeight: number, rowHeights: number[]) {
  const totalWidth = widths.reduce((sum, value) => sum + value, 0);
  const bottom = top - height;
  page.drawRectangle({ x, y: bottom, width: totalWidth, height, borderWidth: 0.8, borderColor: BLACK });
  let currentX = x;
  for (const width of widths.slice(0, -1)) {
    currentX += width;
    page.drawLine({ start: { x: currentX, y: top }, end: { x: currentX, y: bottom }, thickness: 0.7, color: BLACK });
  }
  let y = top - headerHeight;
  page.drawLine({ start: { x, y }, end: { x: x + totalWidth, y }, thickness: 0.7, color: BLACK });
  rowHeights.slice(0, -1).forEach((rowHeight) => {
    y -= rowHeight;
    page.drawLine({ start: { x, y }, end: { x: x + totalWidth, y }, thickness: 0.6, color: BLACK });
  });
  return bottom;
}

function drawCell(page: PDFPage, text: string, x: number, top: number, width: number, height: number, font: PDFFont, size: number, unicode: boolean, options?: { bold?: PDFFont; center?: boolean; maxLines?: number }) {
  const lines = wrapText(text, font, size, width - 10, unicode);
  const visible = options?.maxLines ? lines.slice(0, options.maxLines) : lines;
  const lineHeight = size * 1.22;
  let y = top - 7 - size;
  for (const line of visible) {
    const selectedFont = options?.bold || font;
    const lineWidth = selectedFont.widthOfTextAtSize(line, size);
    page.drawText(line, { x: options?.center ? x + Math.max((width - lineWidth) / 2, 5) : x + 5, y, size, font: selectedFont, color: BLACK });
    y -= lineHeight;
    if (y < top - height + 5) break;
  }
}

function drawComparativePage(pdf: PDFDocument, fonts: FontSet, calculation: { invoiceNo: string; month: string; firms: FirmRow[]; acceptedFirmIndex: number; acceptedReason?: string; items: CalculationItem[] }, settings: Settings) {
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  centerText(page, settings.officeName, 800, fonts.bold, 13, fonts.unicode);
  centerText(page, "COMPARATIVE QUOTATION", 777, fonts.bold, 15, fonts.unicode);
  page.drawText(pdfText(`Invoice/Reference: ${calculation.invoiceNo}`, fonts.unicode), { x: 38, y: 748, size: 9.5, font: fonts.bold, color: BLACK });
  page.drawText(pdfText(`Month: ${formatMonth(calculation.month)}`, fonts.unicode), { x: 390, y: 748, size: 9.5, font: fonts.bold, color: BLACK });

  const x = 38;
  const top = 726;
  const widths = [36, 150, 220, 113];
  const headerHeight = 30;
  const rowHeights = [70, 70, 70];
  drawRectGrid(page, x, top, widths, headerHeight + rowHeights.reduce((a, b) => a + b, 0), headerHeight, rowHeights);
  const headers = ["S. No.", "Name of Firm", "Name of Items", "Amount / Status"];
  let cx = x;
  headers.forEach((header, index) => { drawCell(page, header, cx, top, widths[index], headerHeight, fonts.bold, 9, fonts.unicode, { center: true, bold: fonts.bold }); cx += widths[index]; });

  const scheduleText = calculation.items.length <= 10
    ? calculation.items.map((item) => `${item.itemName} (${formatNumber(item.quantity)} ${item.unit})`).join(", ")
    : `As per attached Schedule A (${calculation.items.length} item${calculation.items.length === 1 ? "" : "s"})`;

  calculation.firms.slice(0, 3).forEach((firm, index) => {
    const rowTop = top - headerHeight - rowHeights.slice(0, index).reduce((a, b) => a + b, 0);
    drawCell(page, String(index + 1), x, rowTop, widths[0], rowHeights[index], fonts.regular, 9.5, fonts.unicode, { center: true });
    drawCell(page, firm.firmName, x + widths[0], rowTop, widths[1], rowHeights[index], fonts.regular, 9, fonts.unicode, { maxLines: 5 });
    drawCell(page, scheduleText, x + widths[0] + widths[1], rowTop, widths[2], rowHeights[index], fonts.regular, 8.5, fonts.unicode, { maxLines: 6 });
    const status = index === calculation.acceptedFirmIndex ? "ACCEPTED" : "REJECTED";
    drawCell(page, `${formatMoney(firm.totalAmount)}\n${status}`, x + widths[0] + widths[1] + widths[2], rowTop, widths[3], rowHeights[index], fonts.bold, 9.5, fonts.unicode, { center: true, bold: fonts.bold });
  });

  const bottom = top - headerHeight - rowHeights.reduce((a, b) => a + b, 0);
  drawWrapped(page, `Accepted quotation reason: ${calculation.acceptedReason || "Approved by the competent committee."}`, { x, y: bottom - 28, width: widths.reduce((a, b) => a + b, 0), font: fonts.regular, size: 9, unicode: fonts.unicode, lineHeight: 12 });
  page.drawText(pdfText("Prepared/Checked by", fonts.unicode), { x: 55, y: 150, font: fonts.bold, size: 9.5, color: BLACK });
  page.drawText(pdfText(settings.presidentLabel || "President", fonts.unicode), { x: 430, y: 150, font: fonts.bold, size: 9.5, color: BLACK });
}

function drawSchedulePages(pdf: PDFDocument, fonts: FontSet, items: CalculationItem[], invoiceNo: string) {
  const rowsPerPage = 22;
  for (let start = 0; start < items.length; start += rowsPerPage) {
    const pageItems = items.slice(start, start + rowsPerPage);
    const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    centerText(page, "SCHEDULE A - STATIONERY ITEMS", 795, fonts.bold, 14, fonts.unicode);
    page.drawText(pdfText(`Invoice/Reference: ${invoiceNo}`, fonts.unicode), { x: 40, y: 770, font: fonts.bold, size: 9.5, color: BLACK });
    page.drawText(pdfText(`Page ${Math.floor(start / rowsPerPage) + 1} of ${Math.ceil(items.length / rowsPerPage)}`, fonts.unicode), { x: 440, y: 770, font: fonts.regular, size: 9, color: GRAY });
    const x = 40; const top = 748; const widths = [40, 300, 80, 110]; const headerHeight = 28; const rowHeight = 28;
    drawRectGrid(page, x, top, widths, headerHeight + rowHeight * pageItems.length, headerHeight, pageItems.map(() => rowHeight));
    ["S. No.", "Item Name", "Quantity", "Unit"].reduce((currentX, header, index) => { drawCell(page, header, currentX, top, widths[index], headerHeight, fonts.bold, 9, fonts.unicode, { center: index !== 1, bold: fonts.bold }); return currentX + widths[index]; }, x);
    pageItems.forEach((item, index) => {
      const rowTop = top - headerHeight - rowHeight * index;
      const values = [String(start + index + 1), item.itemName, formatNumber(item.quantity), item.unit];
      let currentX = x;
      values.forEach((value, col) => { drawCell(page, value, currentX, rowTop, widths[col], rowHeight, col === 1 ? fonts.regular : fonts.bold, 8.8, fonts.unicode, { center: col !== 1, maxLines: 2 }); currentX += widths[col]; });
    });
  }
}

function drawSurveyPage(pdf: PDFDocument, fonts: FontSet, calculation: { invoiceNo: string; items: CalculationItem[] }, settings: Settings) {
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  centerText(page, settings.officeName, 805, fonts.bold, 13, fonts.unicode);
  centerText(page, settings.surveyTitle || "COMMITTEE SURVEY REPORT", 783, fonts.bold, 13, fonts.unicode);
  centerText(page, `District: ${settings.districtName || ""}`, 763, fonts.regular, 9.5, fonts.unicode);
  page.drawText(pdfText(`Invoice/Reference: ${calculation.invoiceNo}`, fonts.unicode), { x: 30, y: 737, font: fonts.bold, size: 9.5, color: BLACK });

  const x = 25; const top = 716; const widths = [35, 140, 140, 140, 90]; const headerHeight = 58; const rowHeight = 100;
  drawRectGrid(page, x, top, widths, headerHeight + rowHeight, headerHeight, [rowHeight]);
  const headers = ["S. No.", "Quantity of Indent Received", "Quantity Received", "Quantity Passed", "Quantity Rejected"];
  let hx = x;
  headers.forEach((header, index) => { drawCell(page, header, hx, top, widths[index], headerHeight, fonts.bold, 8.2, fonts.unicode, { center: true, bold: fonts.bold, maxLines: 4 }); hx += widths[index]; });
  const rowTop = top - headerHeight;
  const itemReference = calculation.items.length <= 7
    ? calculation.items.map((item) => `${item.itemName} (${formatNumber(item.quantity)} ${item.unit})`).join(", ")
    : `As per Schedule A (${calculation.items.length} items)`;
  const values = ["1", itemReference, itemReference, itemReference, "NIL"];
  let vx = x;
  values.forEach((value, index) => { drawCell(page, value, vx, rowTop, widths[index], rowHeight, index === 4 ? fonts.bold : fonts.regular, index === 4 ? 10 : 8, fonts.unicode, { center: index === 0 || index === 4, maxLines: 8 }); vx += widths[index]; });

  const tableBottom = top - headerHeight - rowHeight;
  let paragraph = settings.committeeParagraph;
  if (settings.stockRegisterPage) paragraph += ` Stock Register Page No.: ${settings.stockRegisterPage}.`;
  const paragraphBottom = drawWrapped(page, paragraph, { x: 35, y: tableBottom - 35, width: 525, font: fonts.regular, size: 9.5, unicode: fonts.unicode, lineHeight: 13 });
  page.drawText(pdfText(settings.memberOneLabel || "Member", fonts.unicode), { x: 55, y: Math.min(paragraphBottom - 80, 240), font: fonts.bold, size: 10, color: BLACK });
  page.drawText(pdfText(settings.memberTwoLabel || "Member", fonts.unicode), { x: 255, y: Math.min(paragraphBottom - 80, 240), font: fonts.bold, size: 10, color: BLACK });
  page.drawText(pdfText(settings.presidentLabel || "President", fonts.unicode), { x: 455, y: Math.min(paragraphBottom - 80, 240), font: fonts.bold, size: 10, color: BLACK });
}

export async function GET(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const id = String(new URL(request.url).searchParams.get("id") || "");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, message: "Invalid quotation selected" }, { status: 400 });

    const [calculation, storedSettings] = await Promise.all([
      QuotationCalculation.findById(id).lean() as unknown as Promise<LeanCalculation | null>,
      OfficeSetting.findOne({ scope: "GLOBAL" }).lean(),
    ]);
    if (!calculation) return NextResponse.json({ success: false, message: "Quotation calculation nahi mili" }, { status: 404 });
    if (calculation.status === "VOID") return NextResponse.json({ success: false, message: "Cancelled calculation ki PDF generate nahi ho sakti" }, { status: 400 });

    const settings: Settings = {
      officeName: storedSettings?.officeName || "Office Billing System",
      districtName: storedSettings?.districtName || "Bhiwani",
      surveyTitle: storedSettings?.surveyTitle || "Proceedings of the Committee Survey Report",
      committeeParagraph: storedSettings?.committeeParagraph || "The articles were inspected by the committee and found in order for official use.",
      presidentLabel: storedSettings?.presidentLabel || "President",
      memberOneLabel: storedSettings?.memberOneLabel || "Member",
      memberTwoLabel: storedSettings?.memberTwoLabel || "Member",
      stockRegisterPage: storedSettings?.stockRegisterPage || "",
    };

    const pdf = await PDFDocument.create();
    const fonts = await loadFonts(pdf);
    const items = calculation.items.map((item) => ({ itemName: String(item.itemName), quantity: Number(item.quantity), unit: String(item.unit) }));
    const firms = calculation.firms.map((firm) => ({ firmName: String(firm.firmName), totalAmount: Number(firm.totalAmount) }));

    drawComparativePage(pdf, fonts, {
      invoiceNo: calculation.invoiceNo,
      month: calculation.month,
      firms,
      acceptedFirmIndex: calculation.acceptedFirmIndex,
      acceptedReason: calculation.acceptedReason,
      items,
    }, settings);
    if (items.length > 10) drawSchedulePages(pdf, fonts, items, calculation.invoiceNo);
    drawSurveyPage(pdf, fonts, { invoiceNo: calculation.invoiceNo, items }, settings);

    pdf.setTitle(`Comparative Quotation - ${calculation.invoiceNo}`);
    pdf.setSubject("Comparative Quotation, Item Schedule and Committee Survey Report");
    pdf.setCreator("Office Billing Automation System");
    pdf.setCreationDate(new Date());
    const bytes = await pdf.save();
    const filename = `${sanitizeFilename(calculation.invoiceNo)}-comparative.pdf`;
    return new Response(Buffer.from(bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Comparative PDF error:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "PDF generate nahi ho payi" }, { status: 500 });
  }
}
