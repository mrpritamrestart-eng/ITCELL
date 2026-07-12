import fs from "node:fs/promises";
import mongoose from "mongoose";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/route-auth";
import { connectDB } from "@/lib/mongodb";
import PermissionBatch from "@/models/PermissionBatch";
import OfficeSetting from "@/models/OfficeSetting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const BLACK = rgb(0, 0, 0);
type FontSet = { regular: PDFFont; bold: PDFFont; unicode: boolean };
type PermissionItem = { itemName: string; quantity: number; unit: string };
type PermissionDocument = { _id: mongoose.Types.ObjectId; displayName: string; sourceBranchName: string; sourceType: string; items: PermissionItem[] };

function pdfText(value: unknown, unicode: boolean) {
  const normalized = String(value ?? "").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/₹/g, "Rs. ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return unicode ? normalized : normalized.normalize("NFKD").replace(/[^\x20-\x7E\r\n]/g, "");
}
async function firstFont(paths: string[]) { for (const path of paths.filter(Boolean)) { try { return await fs.readFile(path); } catch { /* continue */ } } return null; }
async function loadFonts(pdf: PDFDocument): Promise<FontSet> {
  const regular = await firstFont([process.env.PDF_FONT_PATH || "", "C:\\Windows\\Fonts\\Nirmala.ttf", "C:\\Windows\\Fonts\\arial.ttf", "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]);
  if (!regular) return { regular: await pdf.embedFont(StandardFonts.TimesRoman), bold: await pdf.embedFont(StandardFonts.TimesRomanBold), unicode: false };
  pdf.registerFontkit(fontkit);
  const regularFont = await pdf.embedFont(regular, { subset: true });
  const boldBytes = await firstFont([process.env.PDF_FONT_BOLD_PATH || "", "C:\\Windows\\Fonts\\NirmalaB.ttf", "C:\\Windows\\Fonts\\arialbd.ttf", "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]);
  return { regular: regularFont, bold: boldBytes ? await pdf.embedFont(boldBytes, { subset: true }) : regularFont, unicode: true };
}
function formatMonth(month: string) { const [year, monthNumber] = month.split("-").map(Number); return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(Date.UTC(year, monthNumber - 1, 1))); }
function number(value: number) { const rounded = Math.round((Number(value) + Number.EPSILON) * 1000) / 1000; return Number.isInteger(rounded) ? String(rounded) : String(rounded); }
function center(page: ReturnType<PDFDocument["addPage"]>, value: string, y: number, font: PDFFont, size: number, unicode: boolean) { const safe = pdfText(value, unicode); page.drawText(safe, { x: Math.max((PAGE_WIDTH - font.widthOfTextAtSize(safe, size)) / 2, 24), y, font, size, color: BLACK }); }
function breakWord(word: string, font: PDFFont, size: number, width: number) { const result: string[] = []; let current = ""; for (const character of Array.from(word)) { const candidate = current + character; if (current && font.widthOfTextAtSize(candidate, size) > width) { result.push(current); current = character; } else current = candidate; } if (current) result.push(current); return result; }
function wrap(value: string, font: PDFFont, size: number, width: number, unicode: boolean) { const lines: string[] = []; let current = ""; for (const word of pdfText(value, unicode).split(/\s+/).filter(Boolean)) { const parts = font.widthOfTextAtSize(word, size) > width ? breakWord(word, font, size, width) : [word]; for (const part of parts) { const candidate = current ? `${current} ${part}` : part; if (!current || font.widthOfTextAtSize(candidate, size) <= width) current = candidate; else { lines.push(current); current = part; } } } if (current) lines.push(current); return lines; }
function drawWrapped(page: ReturnType<PDFDocument["addPage"]>, value: string, x: number, y: number, width: number, font: PDFFont, size: number, unicode: boolean, maxLines = 3, centered = false) { const lines = wrap(value, font, size, width, unicode).slice(0, maxLines); lines.forEach((line, index) => { const lineWidth = font.widthOfTextAtSize(line, size); page.drawText(line, { x: centered ? x + Math.max((width - lineWidth) / 2, 2) : x, y: y - index * (size + 2), font, size, color: BLACK }); }); }
function line(page: ReturnType<PDFDocument["addPage"]>, x1: number, y1: number, x2: number, y2: number, thickness = 0.6) { page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: BLACK }); }

function drawPermissionPage(pdf: PDFDocument, fonts: FontSet, input: { officeName: string; districtName: string; month: string; revision: number; document: PermissionDocument; items: PermissionItem[]; startIndex: number; pageIndex: number; pageCount: number; labels: string[] }) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  center(page, input.officeName, 805, fonts.bold, 13, fonts.unicode);
  center(page, input.districtName ? `District ${input.districtName}` : "", 786, fonts.regular, 10, fonts.unicode);
  center(page, "PERMISSION FOR STATIONERY ITEMS", 758, fonts.bold, 15, fonts.unicode);
  page.drawText(pdfText(`Month: ${formatMonth(input.month)}`, fonts.unicode), { x: 38, y: 730, font: fonts.bold, size: 9.5, color: BLACK });
  page.drawText(pdfText(`Revision: ${input.revision}`, fonts.unicode), { x: 458, y: 730, font: fonts.bold, size: 9.5, color: BLACK });
  page.drawText(pdfText(`Permission: ${input.document.displayName}`, fonts.unicode), { x: 38, y: 712, font: fonts.bold, size: 9.5, color: BLACK });
  page.drawText(pdfText(`Source Branch: ${input.document.sourceBranchName}`, fonts.unicode), { x: 38, y: 695, font: fonts.regular, size: 9, color: BLACK });
  page.drawText(pdfText(`Page ${input.pageIndex + 1} of ${input.pageCount}`, fonts.unicode), { x: 458, y: 695, font: fonts.regular, size: 8.5, color: BLACK });

  const x = 38; const top = 672; const rowHeight = 24; const headerHeight = 28; const widths = [42, 333, 74, 70];
  const tableHeight = headerHeight + input.items.length * rowHeight;
  page.drawRectangle({ x, y: top - tableHeight, width: widths.reduce((sum, value) => sum + value, 0), height: tableHeight, borderWidth: 0.8, borderColor: BLACK });
  let currentX = x; widths.slice(0, -1).forEach((width) => { currentX += width; line(page, currentX, top, currentX, top - tableHeight); });
  line(page, x, top - headerHeight, x + widths.reduce((sum, value) => sum + value, 0), top - headerHeight, 0.8);
  input.items.slice(0, -1).forEach((_, index) => line(page, x, top - headerHeight - rowHeight * (index + 1), x + widths.reduce((sum, value) => sum + value, 0), top - headerHeight - rowHeight * (index + 1)));
  const headers = ["Sr.", "Stationery Item", "Quantity", "Unit"];
  currentX = x; headers.forEach((header, index) => { drawWrapped(page, header, currentX + 3, top - 18, widths[index] - 6, fonts.bold, 8.5, fonts.unicode, 1, true); currentX += widths[index]; });
  input.items.forEach((item, index) => {
    const rowTop = top - headerHeight - rowHeight * index;
    const values = [String(input.startIndex + index + 1), item.itemName, number(item.quantity), item.unit];
    currentX = x;
    values.forEach((value, column) => { drawWrapped(page, value, currentX + 4, rowTop - 14, widths[column] - 8, column === 1 ? fonts.regular : fonts.bold, column === 1 ? 8 : 8.5, fonts.unicode, 2, column !== 1); currentX += widths[column]; });
  });

  if (input.pageIndex === input.pageCount - 1) {
    const statementY = Math.max(top - tableHeight - 34, 145);
    drawWrapped(page, "Permission is hereby accorded for procurement/issue of the stationery items listed above for official use, subject to applicable rules and availability of funds.", x, statementY, 519, fonts.regular, 9.2, fonts.unicode, 4);
    const signatureY = 76;
    input.labels.forEach((label, index) => { const positions = [55, 255, 445]; page.drawText(pdfText(label, fonts.unicode), { x: positions[index], y: signatureY, font: fonts.bold, size: 9.5, color: BLACK }); });
  }
  return page;
}

export async function GET(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get("month") || "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Valid month required hai");
    const ids = String(searchParams.get("documentIds") || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new Error("Invalid permission selected");
    const [batch, settings] = await Promise.all([PermissionBatch.findOne({ month }).lean(), OfficeSetting.findOne({ scope: "GLOBAL" }).lean()]);
    if (!batch || !batch.documents.length) throw new Error("Saved permission data nahi mila");
    if (!batch.finalizedAt) throw new Error("Permission batch draft/unlocked hai. Pehle finalize karein.");
    const documents = (batch.documents as unknown as PermissionDocument[]).filter((document) => !ids.length || ids.includes(String(document._id)));
    if (!documents.length) throw new Error("Selected permission documents nahi mile");
    const pdf = await PDFDocument.create();
    const fonts = await loadFonts(pdf);
    for (const document of documents) {
      const chunks: PermissionItem[][] = [];
      for (let index = 0; index < document.items.length; index += 24) chunks.push(document.items.slice(index, index + 24));
      chunks.forEach((items, pageIndex) => drawPermissionPage(pdf, fonts, {
        officeName: settings?.officeName || "Office Billing System",
        districtName: settings?.districtName || "",
        month,
        revision: Number(batch.revision || 1),
        document,
        items,
        startIndex: pageIndex * 24,
        pageIndex,
        pageCount: chunks.length,
        labels: [settings?.memberOneLabel || "Member", settings?.memberTwoLabel || "Member", settings?.presidentLabel || "President"],
      }));
    }
    pdf.setTitle(`Stationery Permissions ${month}`);
    pdf.setSubject(`${documents.length} finalized stationery permission document(s)`);
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Stationery-Permissions-${month}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Permission PDF generate nahi hui" }, { status: 400 });
  }
}
