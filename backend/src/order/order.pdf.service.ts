import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { OrderEntity } from './entity/order.entity';
import { OrderItemEntity } from './entity/order.item.entity';
import { OrderDiscountEntity } from './entity/order.discount.entity';
import { OrderExtraChargeEntity } from './entity/order.extra.charge.entity';

@Injectable()
export class OrderPdfService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly itemRepo: Repository<OrderItemEntity>,
    @InjectRepository(OrderDiscountEntity)
    private readonly discountRepo: Repository<OrderDiscountEntity>,
    @InjectRepository(OrderExtraChargeEntity)
    private readonly extraChargeRepo: Repository<OrderExtraChargeEntity>,
  ) {}

  async generateAndStoreInvoicePdf(orderId: number): Promise<string> {
    const order = await this.orderRepo.findOne({
      where: { orderId },
      relations: [
        'customer',
        'currency',
        'company',
        'salesPerson',
        'sourceQuotation',
        'orderItems',
        'orderItems.item',
        'orderItems.discounts',
        'orderItems.extraCharges',
        'discounts',
        'extraCharges',
        'termsConditions',
      ],
    });

    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status !== 'PLACED') {
      throw new Error(
        `Invoice PDF can only be generated for PLACED orders (current: ${order.status})`,
      );
    }

    const html = this.buildInvoiceHtml(order);

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      const targetDir = path.join('./upload', 'order', String(orderId), 'invoice');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const filePath = path.join(targetDir, 'invoice.pdf');
      fs.writeFileSync(filePath, pdfBuffer);

      const invoicePdfPath = `/upload/order/${orderId}/invoice/invoice.pdf`;
      await this.orderRepo.update({ orderId }, { invoicePdfPath });
      return invoicePdfPath;
    } finally {
      await browser.close();
    }
  }

  buildInvoiceHtml(order: OrderEntity): string {
    const o = order;

    const fmt = (n: any, decimals = 2): string => {
      if (n == null) return '0.00';
      return Number(n).toFixed(decimals);
    };

    const fmtDate = (d: any): string => {
      if (!d) return '—';
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const sym = o.currency?.symbol || o.currencyCode || '';
    const symLabel = sym ? `(${sym})` : '';

    const grossAmount   = Number(o.totalAmount ?? 0);
    const taxableAmount = Number(o.taxableAmount ?? 0);
    const taxAmount     = Number(o.taxAmount ?? 0);
    const vatWithheldAmount = Number(o.vatWithheldAmount ?? 0);
    const discountTotal = o.discount != null
      ? Number(o.discount)
      : (o.discounts ?? []).reduce((s: number, d: any) => s + Number(d.discountPrice ?? 0), 0);
    const finalAmount   = Number(o.finalAmount ?? 0);
    const netAmount     = finalAmount + vatWithheldAmount;

    const company   = o.company;
    const customer  = o.customer;

    const companyAddr  = [company?.AddressLineOne, company?.city, company?.state, company?.country].filter(Boolean).join(', ');
    const customerAddr = [customer?.AddressLineOne, customer?.city, customer?.state, customer?.country].filter(Boolean).join(', ');
    const customerAttn = [customer?.ownerFirstName, customer?.ownerLastName].filter(Boolean).join(' ') || customer?.customerName || '—';

    const items = (o.orderItems ?? []).map((item: any) => ({
      description: item.description ?? item.item?.itemName ?? `Item #${item.itemId}`,
      qty:         Number(item.quantity ?? 0),
      unitPrice:   Number(item.unitPrice ?? 0),
      taxGroup:    item.taxGroup ?? '—',
      taxCalc:     item.taxCalculation ?? 'NA',
      taxAmount:   Number(item.taxAmount ?? 0),
      finalAmount: Number(item.finalAmount ?? 0),
    }));

    const itemRows = items.map((item, idx) => `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td>${item.description}</td>
        <td class="tr">${item.qty % 1 === 0 ? item.qty : item.qty.toFixed(4)}</td>
        <td class="tr">${fmt(item.unitPrice)}</td>
        <td class="tc">${item.taxGroup}</td>
        <td class="tr">${vatWithheldAmount > 0 ? fmt(-(vatWithheldAmount / (items.length || 1))) : '—'}</td>
        <td class="tr">${fmt(item.finalAmount)}</td>
      </tr>`).join('');

    const termsConditionsContent = o.termsConditionsText ? String(o.termsConditionsText) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${o.orderCode ?? ''}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#222;background:#fff}
.page{width:210mm;min-height:297mm;padding:12mm 14mm 8mm 14mm;display:flex;flex-direction:column}
.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #e8a000;padding-bottom:6px;margin-bottom:8px}
.company-name{font-size:18pt;font-weight:bold;color:#cc3300;letter-spacing:.5px; margin:0 auto;}
.meta-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.billing-address{flex:0 0 55%}
.billing-address .co-label{font-weight:bold;font-size:9.5pt}
.billing-address .addr{color:#444;font-size:8.5pt;line-height:1.5}
.billing-address .attn{margin-top:4px;font-size:8.5pt}

.info-container{display:flex;flex:0 0 42%;gap:8px;font-size:8pt}
.info-box{border:1px solid #ddd;border-radius:3px;overflow:hidden;flex:1}
.info-box table{width:100%;border-collapse:collapse}
.info-box td{padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top}
.info-box .lc{font-weight:bold;white-space:nowrap;color:#444}
.info-box .vc{color:#222}
.info-box tr:last-child td{border-bottom:none}

.items-section{margin-bottom:10px}
.items-table{width:100%;border-collapse:collapse;font-size:8pt}
.items-table thead tr{background:#444;color:#fff}
.items-table thead th{padding:5px 6px;text-align:left;font-weight:600;font-size:8pt}
.items-table thead th.tr{text-align:right}
.items-table thead th.tc{text-align:center}
.items-table tbody td{padding:4px 6px;vertical-align:top;border-bottom:1px solid #eee}
.items-table .tr{text-align:right}
.items-table .tc{text-align:center}
.row-even{background:#fff}
.row-odd{background:#f9f9f9}

.bottom-section{display:flex;justify-content:space-between;page-break-inside:avoid;margin-top:20px;gap:12px;}
.terms-column{width:52%;font-size:8pt;}
.terms-column h4{font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:6px;}
.terms-content{white-space:pre-wrap;color:#444;}
.totals-column{width:44%;font-size:8.5pt;border-top:2px solid #ccc}
.totals-column table{width:100%;border-collapse:collapse}
.totals-column td{padding:3px 4px;border-bottom:1px solid #eee}
.tot-label{color:#444;text-align:left}
.tot-val{text-align:right;font-weight:500;white-space:nowrap}
.totals-column tr.net-amount td{font-weight:bold;font-size:10pt;border-top:2px solid #888;border-bottom:none}
.totals-column tr:last-child td{border-bottom:none}

.thank-you-bar{border-top:2px solid #e8a000;border-bottom:2px solid #e8a000;text-align:center;padding:5px 0;margin:14px 0 10px;font-style:italic;font-size:9pt;color:#555}
.footer{margin-top:auto;padding-top:8px;border-top:1px solid #ddd;font-size:7.5pt;color:#555}
.footer .fn{font-weight:bold;font-size:8.5pt;color:#222}
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div class="company-name">${company?.companyName ?? ''}</div>
</div>

<div class="meta-section">
  <div class="billing-address">
    <div class="co-label">${company?.companyName ?? ''}</div>
    <div class="addr">${companyAddr || '—'}</div>
    ${company?.phone ? `<div class="addr">Tel: ${company.phone}</div>` : ''}
    ${company?.email ? `<div class="addr">Email: ${company.email}</div>` : ''}
    <div class="attn"><strong>ATTN: </strong>${customerAttn}</div>
  </div>
  <div class="info-container">
    <div class="info-box">
      <table>
        <tr><td class="lc">Order Date</td></tr>
        <tr><td class="vc">${fmtDate(o.orderDate)}</td></tr>
        <tr><td class="lc">Delivery Date</td></tr>
        <tr><td class="vc">${fmtDate(o.deliveryDate)}</td></tr>
      </table>
    </div>
    <div class="info-box">
      <table>
        <tr><td class="lc">Order#</td></tr>
        <tr><td class="vc">${o.orderCode ?? '—'}</td></tr>
        <tr><td class="lc">Quotation No</td></tr>
        <tr><td class="vc">${o.sourceQuotation?.quotationCode ?? '—'}</td></tr>
      </table>
    </div>
  </div>
</div>

<div class="items-section">
  <table class="items-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="tr">Quantity</th>
        <th class="tr">Unit Price</th>
        <th class="tc">Tax</th>
        <th class="tr">WHT</th>
        <th class="tr">Amount ${symLabel}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:12px">No items</td></tr>'}
    </tbody>
  </table>
</div>

<div class="bottom-section">
  <div class="terms-column">
    ${termsConditionsContent ? `
    <h4>Terms And Conditions</h4>
    <div class="terms-content">${termsConditionsContent}</div>
    ` : ''}
  </div>

  <div class="totals-column">
    <table>
      <tr><td class="tot-label">Gross Amount</td><td class="tot-val">${fmt(grossAmount)}</td></tr>
      <tr><td class="tot-label">Taxable Amount</td><td class="tot-val">${fmt(taxableAmount)}</td></tr>
      <tr><td class="tot-label">Tax Amount</td><td class="tot-val">${fmt(taxAmount)}</td></tr>
      <tr><td class="tot-label">WHT Amount</td><td class="tot-val">${fmt(-vatWithheldAmount)}</td></tr>
      <tr><td class="tot-label">Discount</td><td class="tot-val">${fmt(discountTotal)}</td></tr>
      <tr class="net-amount"><td class="tot-label">Net Amount</td><td class="tot-val">${sym} ${fmt(netAmount)}</td></tr>
    </table>
  </div>
</div>

<div class="thank-you-bar">Thank you for your business.</div>

<div class="footer">
  <div class="fn">${company?.companyName ?? ''}</div>
  <div>${companyAddr || ''}</div>
  ${company?.phone ? `<div>Tel: ${company.phone}</div>` : ''}
  ${company?.email ? `<div>Email: ${company.email}</div>` : ''}
</div>

</div>
</body>
</html>`;
  }
}
