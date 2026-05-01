import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import { withRateLimit } from "@/lib/withRateLimit";

async function getHandler(_req: NextRequest, { params }: { params: Record<string, string> }) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { id: userId, role } = session.user;

  const order = await prisma.order.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      items: { include: { product: true } },
      customer: true,
      salesman: { select: { name: true } },
    },
  });

  if (!order) return errorResponse("NOT_FOUND", "Order not found", 404);

  if (role === "SALESMAN" && order.salesmanId !== userId) {
    return errorResponse("UNAUTHORIZED", "Access denied", 403);
  }
  if (role === "DISTRIBUTOR" && order.distributorId !== userId) {
    return errorResponse("UNAUTHORIZED", "Access denied", 403);
  }

  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const margin = 50;
  const gray = rgb(0.42, 0.45, 0.5);
  const lightGray = rgb(0.9, 0.91, 0.92);
  const black = rgb(0, 0, 0);

  let y = height - margin;

  // Title
  const title = "INVOICE";
  const titleWidth = helveticaBold.widthOfTextAtSize(title, 22);
  page.drawText(title, { x: (width - titleWidth) / 2, y, font: helveticaBold, size: 22, color: black });
  y -= 24;

  // Sub-header
  const sub1 = `Order ID: ${order.id}`;
  const sub2 = `Date: ${order.createdAt.toISOString().split("T")[0]}`;
  const sub3 = `Status: ${order.status}`;
  for (const line of [sub1, sub2, sub3]) {
    const w = helvetica.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: (width - w) / 2, y, font: helvetica, size: 9, color: gray });
    y -= 13;
  }
  y -= 6;

  // Divider
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lightGray });
  y -= 16;

  // Bill To
  page.drawText("Bill To:", { x: margin, y, font: helveticaBold, size: 11, color: black });
  y -= 15;
  for (const line of [order.customer.name, order.customer.address, order.customer.phone ?? ""].filter(Boolean)) {
    page.drawText(line, { x: margin, y, font: helvetica, size: 10, color: black });
    y -= 14;
  }
  y -= 4;

  // Salesman
  page.drawText("Salesman:", { x: margin, y, font: helveticaBold, size: 11, color: black });
  y -= 15;
  page.drawText(order.salesman.name, { x: margin, y, font: helvetica, size: 10, color: black });
  y -= 14;

  // GPS
  if (order.lat && order.lng) {
    y -= 4;
    const gpsLine = `Order location: ${Number(order.lat).toFixed(6)}, ${Number(order.lng).toFixed(6)}`;
    page.drawText(gpsLine, { x: margin, y, font: helvetica, size: 9, color: gray });
    y -= 14;
  }

  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: lightGray });
  y -= 16;

  // Table header
  const col = { product: margin, qty: margin + 280, unitPrice: margin + 350, amount: margin + 440 };
  page.drawText("Product", { x: col.product, y, font: helveticaBold, size: 10, color: black });
  page.drawText("Qty", { x: col.qty, y, font: helveticaBold, size: 10, color: black });
  page.drawText("Unit Price", { x: col.unitPrice, y, font: helveticaBold, size: 10, color: black });
  page.drawText("Amount", { x: col.amount, y, font: helveticaBold, size: 10, color: black });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
  y -= 14;

  let total = 0;
  for (const item of order.items) {
    const amount = item.quantity * Number(item.unitPrice);
    total += amount;
    const name = item.product.name.length > 35 ? item.product.name.slice(0, 33) + "…" : item.product.name;
    page.drawText(name, { x: col.product, y, font: helvetica, size: 10, color: black });
    page.drawText(String(item.quantity), { x: col.qty, y, font: helvetica, size: 10, color: black });
    page.drawText(`PKR ${Number(item.unitPrice).toFixed(2)}`, { x: col.unitPrice, y, font: helvetica, size: 10, color: black });
    page.drawText(`PKR ${amount.toFixed(2)}`, { x: col.amount, y, font: helvetica, size: 10, color: black });
    y -= 16;
  }

  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: gray });
  y -= 18;

  // Total
  const totalLabel = `Total: PKR ${total.toFixed(2)}`;
  const totalWidth = helveticaBold.widthOfTextAtSize(totalLabel, 12);
  page.drawText(totalLabel, { x: width - margin - totalWidth, y, font: helveticaBold, size: 12, color: black });
  y -= 20;

  // Notes
  if (order.notes) {
    y -= 6;
    page.drawText("Notes:", { x: margin, y, font: helveticaBold, size: 10, color: black });
    y -= 14;
    page.drawText(order.notes, { x: margin, y, font: helvetica, size: 10, color: black });
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${order.id.slice(0, 8)}.pdf"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}

export const GET = withRateLimit("SALESMAN", getHandler);
