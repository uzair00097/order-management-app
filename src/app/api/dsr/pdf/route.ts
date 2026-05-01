import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import { z } from "zod";
import { withRateLimit } from "@/lib/withRateLimit";

const DSRQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 10)),
});

async function getHandler(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

  const { role, id, name: distributorName } = session.user;
  if (role !== "DISTRIBUTOR" && role !== "ADMIN")
    return errorResponse("UNAUTHORIZED", "Not authorized", 403);

  const parsed = DSRQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "Invalid date parameter", 400);

  const { date } = parsed.data;
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const distFilter = role === "DISTRIBUTOR" ? { distributorId: id } : {};

  const orders = await prisma.order.findMany({
    where: { ...distFilter, createdAt: { gte: dayStart, lte: dayEnd }, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      salesman: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const enriched = orders.map((o) => ({
    ...o,
    total: o.items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0),
  }));

  const statusBreakdown: Record<string, number> = {};
  for (const o of enriched) statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;

  const activeOrders = enriched.filter((o) => o.status !== "DRAFT" && o.status !== "CANCELLED");
  const totalRevenue = activeOrders.reduce((s, o) => s + o.total, 0);

  const salesmanMap = new Map<string, { name: string; orderCount: number; revenue: number }>();
  for (const o of enriched) {
    const row = salesmanMap.get(o.salesmanId) ?? { name: o.salesman.name, orderCount: 0, revenue: 0 };
    row.orderCount++;
    if (o.status !== "DRAFT" && o.status !== "CANCELLED") row.revenue += o.total;
    salesmanMap.set(o.salesmanId, row);
  }

  const productMap = new Map<string, { name: string; quantitySold: number; revenue: number }>();
  for (const o of activeOrders) {
    for (const item of o.items) {
      const row = productMap.get(item.productId) ?? { name: item.product.name, quantitySold: 0, revenue: 0 };
      row.quantitySold += item.quantity;
      row.revenue += item.quantity * Number(item.unitPrice);
      productMap.set(item.productId, row);
    }
  }

  const bySalesman = Array.from(salesmanMap.values()).sort((a, b) => b.revenue - a.revenue);
  const byProduct = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);

  // ── Build PDF ────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const margin = 50;
  const pageW = PageSizes.A4[0];
  const pageH = PageSizes.A4[1];
  const contentW = pageW - margin * 2;
  const gray = rgb(0.45, 0.47, 0.52);
  const lightGray = rgb(0.88, 0.9, 0.92);
  const purple = rgb(0.38, 0.1, 0.56);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  let page = pdfDoc.addPage(PageSizes.A4);
  let y = pageH - margin;

  function ensureSpace(needed: number) {
    if (y < margin + needed) {
      page = pdfDoc.addPage(PageSizes.A4);
      y = pageH - margin;
    }
  }

  function divider(thickness = 0.5) {
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness, color: lightGray });
    y -= 16;
  }

  function sectionHeader(text: string) {
    ensureSpace(60);
    page.drawText(text, { x: margin, y, font: bold, size: 10, color: purple });
    y -= 14;
  }

  // Title bar
  page.drawRectangle({ x: 0, y: pageH - 58, width: pageW, height: 58, color: purple });
  const titleText = "DAILY SALES REPORT";
  const titleW = bold.widthOfTextAtSize(titleText, 18);
  page.drawText(titleText, { x: (pageW - titleW) / 2, y: pageH - 36, font: bold, size: 18, color: white });

  y = pageH - 58 - 14;
  const subText = `${distributorName}  ·  Date: ${date}`;
  const subW = regular.widthOfTextAtSize(subText, 9);
  page.drawText(subText, { x: (pageW - subW) / 2, y, font: regular, size: 9, color: gray });
  y -= 18;
  divider();

  // Summary row
  sectionHeader("SUMMARY");
  const quarters = [0, 1, 2, 3].map((i) => margin + (contentW / 4) * i);
  const statValues = [
    String(enriched.length),
    `Rs ${totalRevenue.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`,
    String(statusBreakdown["PENDING"] ?? 0),
    String(statusBreakdown["DELIVERED"] ?? 0),
  ];
  const statLabels = ["Total Orders", "Active Revenue", "Pending", "Delivered"];

  for (let i = 0; i < 4; i++)
    page.drawText(statValues[i], { x: quarters[i], y, font: bold, size: 13, color: black });
  y -= 14;
  for (let i = 0; i < 4; i++)
    page.drawText(statLabels[i], { x: quarters[i], y, font: regular, size: 8, color: gray });
  y -= 18;
  divider();

  // By Salesman
  if (bySalesman.length > 0) {
    sectionHeader("SALES BY SALESMAN");
    const sc = { name: margin, orders: margin + 240, revenue: margin + 340 };
    page.drawText("Salesman", { x: sc.name, y, font: bold, size: 9, color: gray });
    page.drawText("Orders", { x: sc.orders, y, font: bold, size: 9, color: gray });
    page.drawText("Revenue", { x: sc.revenue, y, font: bold, size: 9, color: gray });
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.3, color: lightGray });
    y -= 12;

    for (const row of bySalesman) {
      ensureSpace(16);
      const nm = row.name.length > 32 ? row.name.slice(0, 30) + "…" : row.name;
      page.drawText(nm, { x: sc.name, y, font: regular, size: 9, color: black });
      page.drawText(String(row.orderCount), { x: sc.orders, y, font: regular, size: 9, color: black });
      page.drawText(`Rs ${row.revenue.toFixed(0)}`, { x: sc.revenue, y, font: regular, size: 9, color: black });
      y -= 14;
    }
    y -= 4;
    divider();
  }

  // Top Products
  if (byProduct.length > 0) {
    sectionHeader("TOP PRODUCTS");
    const pc = { name: margin, qty: margin + 270, revenue: margin + 350 };
    page.drawText("Product", { x: pc.name, y, font: bold, size: 9, color: gray });
    page.drawText("Qty Sold", { x: pc.qty, y, font: bold, size: 9, color: gray });
    page.drawText("Revenue", { x: pc.revenue, y, font: bold, size: 9, color: gray });
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.3, color: lightGray });
    y -= 12;

    for (const row of byProduct) {
      ensureSpace(16);
      const nm = row.name.length > 36 ? row.name.slice(0, 34) + "…" : row.name;
      page.drawText(nm, { x: pc.name, y, font: regular, size: 9, color: black });
      page.drawText(String(row.quantitySold), { x: pc.qty, y, font: regular, size: 9, color: black });
      page.drawText(`Rs ${row.revenue.toFixed(0)}`, { x: pc.revenue, y, font: regular, size: 9, color: black });
      y -= 14;
    }
    y -= 4;
    divider();
  }

  // Order Details
  if (enriched.length > 0) {
    sectionHeader("ORDER DETAILS");

    for (const o of enriched) {
      ensureSpace(40);
      const timeStr = new Date(o.createdAt).toTimeString().slice(0, 5);
      const header = `${o.customer.name}  ·  ${o.salesman.name}  ·  ${timeStr}  ·  ${o.status}`;
      page.drawText(header.length > 80 ? header.slice(0, 78) + "…" : header, {
        x: margin, y, font: bold, size: 8.5, color: black,
      });
      y -= 12;

      for (const item of o.items) {
        ensureSpace(12);
        const itemName = `  ${item.product.name.length > 42 ? item.product.name.slice(0, 40) + "…" : item.product.name}`;
        page.drawText(itemName, { x: margin, y, font: regular, size: 8, color: gray });
        const amtStr = `${item.quantity} × Rs ${Number(item.unitPrice).toFixed(0)} = Rs ${(item.quantity * Number(item.unitPrice)).toFixed(0)}`;
        const aw = regular.widthOfTextAtSize(amtStr, 8);
        page.drawText(amtStr, { x: pageW - margin - aw, y, font: regular, size: 8, color: gray });
        y -= 11;
      }

      const totalStr = `Total: Rs ${o.total.toFixed(0)}`;
      const tow = bold.widthOfTextAtSize(totalStr, 8.5);
      page.drawText(totalStr, { x: pageW - margin - tow, y, font: bold, size: 8.5, color: black });
      y -= 8;
      page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 0.2, color: lightGray });
      y -= 10;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dsr-${date}.pdf"`,
      "Content-Length": String(pdfBytes.length),
    },
  });
}

export const GET = withRateLimit("DISTRIBUTOR", getHandler);
