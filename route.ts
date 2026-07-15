import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/route-auth";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { connectDB } from "@/lib/mongodb";
import QuotationCalculation from "@/models/QuotationCalculation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/*
|--------------------------------------------------------------------------
| PDF-safe text
|--------------------------------------------------------------------------
| New-line characters ko preserve kiya gaya hai, taaki:
|
| 1040/-
| ACCEPTED
|
| alag-alag lines me print ho.
*/
function safePdfText(value: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/₹/g, "Rs. ")
    .replace(/[^\x20-\x7E\r\n]/g, "");
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(
        Math.round((value + Number.EPSILON) * 100) / 100
      );
}

function formatMoney(value: number) {
  return `${formatNumber(value)}/-`;
}

function sanitizeFilename(value: string) {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "Comparative-Quotation";
}

/*
|--------------------------------------------------------------------------
| Text wrapping
|--------------------------------------------------------------------------
*/
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
) {
  const words = safePdfText(text)
    .split(/\s+/)
    .filter(Boolean);

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(candidate, fontSize) <=
      maxWidth
    ) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    lines.push(word);
    currentLine = "";
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function drawWrappedText(options: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  fontSize: number;
  lineHeight?: number;
  maxLines?: number;
}) {
  const {
    page,
    text,
    x,
    y,
    maxWidth,
    font,
    fontSize,
    lineHeight = fontSize * 1.25,
    maxLines,
  } = options;

  const lines = wrapText(
    text,
    font,
    fontSize,
    maxWidth
  );

  const visibleLines = maxLines
    ? lines.slice(0, maxLines)
    : lines;

  visibleLines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  });

  return y - visibleLines.length * lineHeight;
}

/*
|--------------------------------------------------------------------------
| Table-cell text
|--------------------------------------------------------------------------
*/
function drawCellText(options: {
  page: PDFPage;
  text: string;
  x: number;
  topY: number;
  width: number;
  font: PDFFont;
  fontSize: number;
  padding?: number;
  boldFont?: PDFFont;
  boldSecondLine?: boolean;
  lineHeight?: number;
}) {
  const {
    page,
    text,
    x,
    topY,
    width,
    font,
    fontSize,
    padding = 6,
    boldFont,
    boldSecondLine = false,
    lineHeight = fontSize * 1.28,
  } = options;

  /*
   * New-line preserve rahegi.
   * Amount aur ACCEPTED/REJECTED alag paragraph/line honge.
   */
  const paragraphs = safePdfText(text).split(/\r?\n/);

  let currentY = topY - padding - fontSize;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const selectedFont =
      boldSecondLine &&
      paragraphIndex > 0 &&
      boldFont
        ? boldFont
        : font;

    const wrappedLines = wrapText(
      paragraph,
      selectedFont,
      fontSize,
      width - padding * 2
    );

    wrappedLines.forEach((line) => {
      page.drawText(line, {
        x: x + padding,
        y: currentY,
        size: fontSize,
        font: selectedFont,
        color: rgb(0, 0, 0),
      });

      currentY -= lineHeight;
    });
  });

  return currentY;
}

/*
|--------------------------------------------------------------------------
| Table grid
|--------------------------------------------------------------------------
*/
function drawTableGrid(options: {
  page: PDFPage;
  x: number;
  tableTop: number;
  tableBottom: number;
  columnWidths: number[];
  horizontalLines: number[];
}) {
  const {
    page,
    x,
    tableTop,
    tableBottom,
    columnWidths,
    horizontalLines,
  } = options;

  const totalWidth = columnWidths.reduce(
    (sum, width) => sum + width,
    0
  );

  const verticalLines = [x];

  columnWidths.forEach((width) => {
    const previous =
      verticalLines[verticalLines.length - 1];

    verticalLines.push(previous + width);
  });

  verticalLines.forEach((verticalX) => {
    page.drawLine({
      start: {
        x: verticalX,
        y: tableTop,
      },
      end: {
        x: verticalX,
        y: tableBottom,
      },
      thickness: 0.7,
      color: rgb(0, 0, 0),
    });
  });

  horizontalLines.forEach((horizontalY) => {
    page.drawLine({
      start: {
        x,
        y: horizontalY,
      },
      end: {
        x: x + totalWidth,
        y: horizontalY,
      },
      thickness: 0.7,
      color: rgb(0, 0, 0),
    });
  });
}

/*
|--------------------------------------------------------------------------
| PAGE 1: Comparative Quotation
|--------------------------------------------------------------------------
*/
function drawComparativePage(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  firms: Array<{
    firmName: string;
    totalAmount: number;
  }>,
  acceptedFirmIndex: number,
  itemText: string
) {
  const title = "Comparative Quotation";
  const titleSize = 15;

  const titleWidth = bold.widthOfTextAtSize(
    title,
    titleSize
  );

  page.drawText(title, {
    x: (A4_WIDTH - titleWidth) / 2,
    y: 775,
    size: titleSize,
    font: bold,
    color: rgb(0, 0, 0),
  });

  /*
   * Table ko pehle se narrow aur centre me kiya gaya hai.
   *
   * Total width:
   * 36 + 145 + 175 + 120 = 476
   */
  const columnWidths = [36, 145, 175, 120];

  const totalWidth = columnWidths.reduce(
    (sum, width) => sum + width,
    0
  );

  const x = (A4_WIDTH - totalWidth) / 2;

  const tableTop = 742;
  const headerHeight = 23;
  const rowHeight = 103;

  const tableBottom =
    tableTop -
    headerHeight -
    rowHeight * 3;

  const horizontalLines = [
    tableTop,
    tableTop - headerHeight,
    tableTop - headerHeight - rowHeight,
    tableTop - headerHeight - rowHeight * 2,
    tableBottom,
  ];

  drawTableGrid({
    page,
    x,
    tableTop,
    tableBottom,
    columnWidths,
    horizontalLines,
  });

  /*
   * Header row
   */
  const headers = [
    "SNO",
    "Name of Firms",
    "Name of Items",
    "Amount",
  ];

  let headerX = x;

  headers.forEach((header, index) => {
    page.drawText(header, {
      x: headerX + 6,
      y: tableTop - 16,
      size: 10.5,
      font: bold,
      color: rgb(0, 0, 0),
    });

    headerX += columnWidths[index];
  });

  /*
   * Maximum 3 firm rows
   */
  const visibleFirms = firms.slice(0, 3);

  visibleFirms.forEach((firm, index) => {
    const rowTop =
      tableTop -
      headerHeight -
      rowHeight * index;

    const status =
      index === acceptedFirmIndex
        ? "ACCEPTED"
        : "REJECTED";

    /*
     * SNO
     */
    drawCellText({
      page,
      text: String(index + 1),
      x,
      topY: rowTop,
      width: columnWidths[0],
      font: bold,
      fontSize: 10.5,
      padding: 6,
    });

    /*
     * Firm name
     */
    drawCellText({
      page,
      text: firm.firmName,
      x: x + columnWidths[0],
      topY: rowTop,
      width: columnWidths[1],
      font: regular,
      fontSize: 10,
      padding: 6,
      lineHeight: 11.5,
    });

    /*
     * Item names and quantities
     */
    drawCellText({
      page,
      text: itemText,
      x:
        x +
        columnWidths[0] +
        columnWidths[1],
      topY: rowTop,
      width: columnWidths[2],
      font: regular,
      fontSize: 10,
      padding: 6,
      lineHeight: 11.5,
    });

    /*
     * Amount first line
     * ACCEPTED/REJECTED second line
     */
    drawCellText({
      page,
      text:
        `${formatMoney(
          Number(firm.totalAmount)
        )}\n${status}`,
      x:
        x +
        columnWidths[0] +
        columnWidths[1] +
        columnWidths[2],
      topY: rowTop,
      width: columnWidths[3],
      font: bold,
      boldFont: bold,
      boldSecondLine: true,
      fontSize: 10.5,
      padding: 6,
      lineHeight: 13,
    });
  });
}

/*
|--------------------------------------------------------------------------
| PAGE 2: Committee Survey Report
|--------------------------------------------------------------------------
*/
function drawSurveyPage(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  itemText: string
) {
  /*
   * Survey title
   */
  const title =
    "Proceeding of committee Survey Report Received from the Distt Bhiwani.";

  /*
   * Table width:
   * 36 + 118 + 122 + 122 + 67 = 465
   */
  const columnWidths = [
    36,
    118,
    122,
    122,
    67,
  ];

  const totalWidth = columnWidths.reduce(
    (sum, width) => sum + width,
    0
  );

  const x = (A4_WIDTH - totalWidth) / 2;

  page.drawText(title, {
    x: x + 4,
    y: 777,
    size: 11.5,
    font: regular,
    color: rgb(0, 0, 0),
  });

  const tableTop = 753;
  const headerHeight = 50;
  const rowHeight = 190;

  const tableBottom =
    tableTop -
    headerHeight -
    rowHeight;

  drawTableGrid({
    page,
    x,
    tableTop,
    tableBottom,
    columnWidths,
    horizontalLines: [
      tableTop,
      tableTop - headerHeight,
      tableBottom,
    ],
  });

  /*
   * Header row
   */
  const headers = [
    "SNo\n.",
    "Quantity of Indent\nReceived",
    "Quantity No of\nReceived",
    "Quantity No of Pass",
    "Quantity\nNo of\nReject",
  ];

  let headerX = x;

  headers.forEach((header, index) => {
    drawCellText({
      page,
      text: header,
      x: headerX,
      topY: tableTop,
      width: columnWidths[index],
      font: regular,
      fontSize: 10.5,
      padding: 5,
      lineHeight: 11.5,
    });

    headerX += columnWidths[index];
  });

  /*
   * Data row
   */
  const dataRowTop =
    tableTop - headerHeight;

  drawCellText({
    page,
    text: "1.",
    x,
    topY: dataRowTop,
    width: columnWidths[0],
    font: regular,
    fontSize: 10.5,
    padding: 6,
  });

  let currentX =
    x + columnWidths[0];

  /*
   * Item list ko Indent, Received aur Pass columns me repeat karna
   */
  for (
    let columnIndex = 1;
    columnIndex <= 3;
    columnIndex += 1
  ) {
    drawCellText({
      page,
      text: itemText,
      x: currentX,
      topY: dataRowTop,
      width: columnWidths[columnIndex],
      font: regular,
      fontSize: 9,
      padding: 5,
      lineHeight: 10.3,
    });

    currentX +=
      columnWidths[columnIndex];
  }

  /*
   * Reject column
   */
  drawCellText({
    page,
    text: "NIL",
    x: currentX,
    topY: dataRowTop,
    width: columnWidths[4],
    font: bold,
    fontSize: 11.5,
    padding: 6,
  });

  /*
   * Committee paragraph
   */
  const paragraph =
    `The article ${itemText} Complete mentioned in column no 3 ` +
    "has inspected by the surety committee in respect of And found quite in order " +
    "hence the committee have been passed these as for use of after being brought " +
    "to the stock register which entry has been make at the page no history sheet.";

  const paragraphBottom = drawWrappedText({
    page,
    text: paragraph,
    x: x + 4,
    y: tableBottom - 27,
    maxWidth: totalWidth - 8,
    font: bold,
    fontSize: 9.5,
    lineHeight: 11.5,
  });

  /*
   * Signatures ko paragraph ke paas rakha gaya hai.
   * Pehle President bahut neeche fixed y=210 par aa raha tha.
   */
  const presidentY = Math.min(
    320,
    Math.max(
      245,
      paragraphBottom - 95
    )
  );

  const signatureX =
    x + totalWidth - 80;

  page.drawText("President", {
    x: signatureX,
    y: presidentY,
    size: 10.5,
    font: bold,
    color: rgb(0, 0, 0),
  });

  page.drawText("Member", {
    x: signatureX,
    y: presidentY - 60,
    size: 10.5,
    font: bold,
    color: rgb(0, 0, 0),
  });

  page.drawText("Member", {
    x: signatureX,
    y: presidentY - 120,
    size: 10.5,
    font: bold,
    color: rgb(0, 0, 0),
  });
}

/*
|--------------------------------------------------------------------------
| PDF API
|--------------------------------------------------------------------------
*/
export async function GET(request: Request) {
  const auth = await requireRouteAuth();
  if (auth.response) return auth.response;

  try {
    await connectDB();

    const { searchParams } = new URL(
      request.url
    );

    const id = String(
      searchParams.get("id") || ""
    );

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid quotation selected",
        },
        {
          status: 400,
        }
      );
    }

    const calculation =
      await QuotationCalculation.findById(
        id
      ).lean();

    if (!calculation) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Quotation calculation nahi mili",
        },
        {
          status: 404,
        }
      );
    }

    if ((calculation as { status?: string }).status === "VOID") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Cancelled calculation ki PDF generate nahi ho sakti",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Example:
     * A4 Paper Ream (4), Damper (1), Carbon Paper (1)
     */
    const itemText = calculation.items
      .map(
        (item: {
          itemName: string;
          quantity: number;
        }) =>
          `${item.itemName} (${formatNumber(
            Number(item.quantity)
          )})`
      )
      .join(", ");

    const pdfDocument =
      await PDFDocument.create();

    const regular =
      await pdfDocument.embedFont(
        StandardFonts.TimesRoman
      );

    const bold =
      await pdfDocument.embedFont(
        StandardFonts.TimesRomanBold
      );

    /*
     * Page 1
     */
    const comparativePage =
      pdfDocument.addPage([
        A4_WIDTH,
        A4_HEIGHT,
      ]);

    drawComparativePage(
      comparativePage,
      regular,
      bold,
      calculation.firms.map(
        (firm: {
          firmName: string;
          totalAmount: number;
        }) => ({
          firmName: firm.firmName,
          totalAmount: Number(
            firm.totalAmount
          ),
        })
      ),
      Number(
        calculation.acceptedFirmIndex
      ),
      itemText
    );

    /*
     * Page 2
     */
    const surveyPage =
      pdfDocument.addPage([
        A4_WIDTH,
        A4_HEIGHT,
      ]);

    drawSurveyPage(
      surveyPage,
      regular,
      bold,
      itemText
    );

    /*
     * PDF metadata
     */
    pdfDocument.setTitle(
      `Comparative Quotation - ${calculation.invoiceNo}`
    );

    pdfDocument.setSubject(
      "Comparative Quotation and Committee Survey Report"
    );

    pdfDocument.setCreator(
      "Office Billing Automation System"
    );

    const bytes =
      await pdfDocument.save();

    const filename =
      `${sanitizeFilename(
        calculation.invoiceNo
      )}.pdf`;

    return new Response(
      Buffer.from(bytes),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Comparative PDF error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "PDF generate nahi ho payi",
      },
      {
        status: 500,
      }
    );
  }
}
