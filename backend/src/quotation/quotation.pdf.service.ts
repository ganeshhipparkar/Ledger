import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { QuotationEntity } from './entity/quotation.entity';
import { QuotationItemEntity } from './entity/quotation.item.entity';
import { QuotationDiscountEntity } from './entity/quotation.discount.entity';
import { QuotationExtraChargeEntity } from './entity/quotation.extra.charge.entity';

@Injectable()
export class QuotationPdfService {
  constructor(
    @InjectRepository(QuotationEntity)
    private readonly quotationRepo: Repository<QuotationEntity>,
    @InjectRepository(QuotationItemEntity)
    private readonly itemRepo: Repository<QuotationItemEntity>,
    @InjectRepository(QuotationDiscountEntity)
    private readonly discountRepo: Repository<QuotationDiscountEntity>,
    @InjectRepository(QuotationExtraChargeEntity)
    private readonly extraChargeRepo: Repository<QuotationExtraChargeEntity>,
  ) {}

  async generateAndStoreInvoicePdf(quotationId: number): Promise<string> {
    const quotation = await this.quotationRepo.findOne({
      where: { quotationId },
      relations: [
        'customer',
        'currency',
        'company',
        'bankBook',
        'bankBook.bank',
        'salesPerson',
        'quotationItems',
        'quotationItems.item',
        'quotationItems.discounts',
        'quotationItems.extraCharges',
        'discounts',
        'extraCharges',
        'termsConditions',
      ],
    });

    if (!quotation) throw new Error(`Quotation ${quotationId} not found`);
    if (quotation.status !== 'CONFIRMED') {
      throw new Error(
        `Invoice PDF can only be generated for CONFIRMED quotations (current: ${quotation.status})`,
      );
    }

    const html = this.buildInvoiceHtml(quotation);

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

      const targetDir = path.join('./upload', 'quotation', String(quotationId), 'invoice');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const filePath = path.join(targetDir, 'invoice.pdf');
      fs.writeFileSync(filePath, pdfBuffer);

      const invoicePdfPath = `/upload/quotation/${quotationId}/invoice/invoice.pdf`;
      await this.quotationRepo.update({ quotationId }, { invoicePdfPath });
      return invoicePdfPath;
    } finally {
      await browser.close();
    }
  }

  buildInvoiceHtml(quotation: QuotationEntity): string {
    const q = quotation;

    const fmt = (n: any, decimals = 2): string => {
      if (n == null) return '0.00';
      return Number(n).toFixed(decimals);
    };

    const fmtDate = (d: any): string => {
      if (!d) return '—';
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const sym = q.currency?.symbol || q.currencyCode || '';
    const symLabel = sym ? `(${sym})` : '';

    const grossAmount   = Number(q.totalAmount ?? 0);
    const taxableAmount = Number(q.taxableAmount ?? 0);
    const taxAmount     = Number(q.taxAmount ?? 0);
    const vatWithheldAmount = Number(q.vatWithheldAmount ?? 0);
    const discountTotal = q.discount != null
      ? Number(q.discount)
      : (q.discounts ?? []).reduce((s: number, d: any) => s + Number(d.discountPrice ?? 0), 0);
    const finalAmount   = Number(q.finalAmount ?? 0);
    const netAmount     = finalAmount + vatWithheldAmount;

    const company   = q.company;
    const customer  = q.customer;
    const bankBook  = q.bankBook;
    const bank      = (bankBook as any)?.bank;

    const companyAddr  = [company?.AddressLineOne, company?.city, company?.state, company?.country].filter(Boolean).join(', ');
    const customerAddr = [customer?.AddressLineOne, customer?.city, customer?.state, customer?.country].filter(Boolean).join(', ');
    const customerAttn = [customer?.ownerFirstName, customer?.ownerLastName].filter(Boolean).join(' ') || customer?.customerName || '—';

    const items = (q.quotationItems ?? []).map((item: any) => ({
      description: item.description || item.item?.itemName || (item.itemId ? `Item #${item.itemId}` : 'Service'),
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
        <td class="tr">${item.taxCalc !== 'NA' ? fmt(item.taxAmount) : '—'}</td>
        <td class="tr">${'—'}</td>
        <td class="tr">${fmt(item.finalAmount)}</td>
      </tr>`).join('');

    const termsConditionsContent = q.termsConditionsText ? String(q.termsConditionsText) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${q.quotationCode ?? ''}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#222;background:#fff}
.page{width:210mm;min-height:297mm;padding:12mm 14mm 8mm 14mm;display:flex;flex-direction:column}
.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #e8a000;padding-bottom:6px;margin-bottom:12px}
.company-name{font-size:18pt;font-weight:bold;color:#cc3300;letter-spacing:.5px}
.invoice-title-block{text-align:right}
.invoice-title{font-size:13pt;font-weight:bold;color:#cc3300;margin-bottom:2px;display:flex;align-items:center;justify-content:flex-end;gap:8px}
.status-badge{font-size:7pt;background:#eee;color:#333;padding:2px 6px;border-radius:4px;font-weight:bold;text-transform:uppercase;border:1px solid #ccc}
.invoice-subtitle{font-size:8pt;color:#555}
.meta-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.billing-address{flex:0 0 55%;display:flex;gap:16px}
.address-col{flex:1}
.billing-address .co-label{font-weight:bold;font-size:9pt;margin-bottom:3px;color:#222}
.billing-address .addr{color:#444;font-size:8.5pt;line-height:1.6}
.billing-address .attn{margin-top:4px;font-size:8.5pt;color:#333}
.info-box{border:1px solid #ddd;border-radius:3px;overflow:hidden;flex:0 0 42%;font-size:8pt}
.info-box table{width:100%;border-collapse:collapse}
.info-box td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top}
.info-box .lc{font-weight:bold;white-space:nowrap;color:#444;width:45%}
.info-box .vc{color:#222}
.info-box tr:last-child td{border-bottom:none}
.items-section{margin-bottom:12px}
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
.bottom-section{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:12px}
.left-column{flex:0 0 52%;font-size:8pt}
.bank-details{margin-bottom:12px}
.bank-details h4{font-weight:bold;font-size:9pt;margin-bottom:4px;border-bottom:1px solid #ccc;padding-bottom:3px}
.bank-details table{width:100%;border-collapse:collapse}
.bank-details td{padding:2px 0;vertical-align:top}
.bd-label{color:#555;width:58%;font-size:8pt}
.bd-val{color:#222;font-size:8pt}
.terms-column h4{font-weight:bold;font-size:9pt;margin-bottom:4px;border-bottom:1px solid #ccc;padding-bottom:3px}
.terms-content{white-space:pre-wrap;color:#444}
.totals{flex:0 0 44%;font-size:8.5pt;border-top:2px solid #ccc}
.totals table{width:100%;border-collapse:collapse}
.totals td{padding:3px 4px;border-bottom:1px solid #eee}
.tot-label{color:#444;text-align:left}
.tot-val{text-align:right;font-weight:500;white-space:nowrap}
.totals tr.receivable td{font-weight:bold;font-size:10pt;border-top:2px solid #888;border-bottom:none}
.totals tr:last-child td{border-bottom:none}
.thank-you-bar{margin-top:auto;border-top:2px solid #e8a000;border-bottom:2px solid #e8a000;text-align:center;padding:5px 0;margin-bottom:10px;font-style:italic;font-size:9pt;color:#555}
.footer{padding-top:8px;border-top:1px solid #ddd;font-size:7.5pt;color:#555}
.footer .fn{font-weight:bold;font-size:8.5pt;color:#222}
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div class="company-name">${company?.companyName ?? ''}</div>
  <div class="invoice-title-block">

  </div>
</div>

<div class="meta-section">
  <div class="billing-address">
    <div class="address-col">
      <div class="co-label">${company?.companyName ?? ''}</div>
      <div class="addr">${companyAddr || '—'}</div>
      ${company?.phone ? `<div class="addr">Tel: ${company.phone}</div>` : ''}
      ${company?.email ? `<div class="addr">Email: ${company.email}</div>` : ''}
    </div>
    <div class="address-col">
      <div class="co-label">Bill To: ${customer?.customerName ?? ''}</div>
      <div class="addr">${customerAddr || '—'}</div>
      <div class="attn"><strong>ATTN: </strong>${customerAttn}</div>
    </div>
  </div>
  <div class="info-box">
    <table>
      <tr><td class="lc">Quotation No.</td><td class="vc">${q.quotationCode ?? '—'}</td></tr>
      <tr><td class="lc">Issue Date</td><td class="vc">${fmtDate(q.issueDate)}</td></tr>
      <tr><td class="lc">Valid Until</td><td class="vc">${fmtDate(q.expiryDate)}</td></tr>
      <tr><td class="lc">Sales Person</td><td class="vc">${[q.salesPerson?.firstName].filter(Boolean).join(' ') || '—'}</td></tr>
    </table>
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
        <th class="tr">Tax Amount</th>
        <th class="tr">WHT</th>
        <th class="tr">Amount ${symLabel}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:12px">No items</td></tr>'}
    </tbody>
  </table>
</div>

<div class="bottom-section">
  <div class="left-column">
    <div class="bank-details">
      <h4>Bank Details</h4>
      <table>
        <tr><td class="bd-label">Beneficiary Name</td><td class="bd-val">${bankBook?.beneficiaryName ?? '—'}</td></tr>
        <tr><td class="bd-label">Beneficiary Bank Name</td><td class="bd-val">${bank?.bankName ?? '—'}</td></tr>
        <tr><td class="bd-label">Beneficiary Account No. ${symLabel}</td><td class="bd-val">${bankBook?.accountNumber ?? '—'}</td></tr>
        <tr><td class="bd-label">Bank Swift Code</td><td class="bd-val">${bank?.bankCode ?? '—'}</td></tr>
       
      </table>
    </div>

    ${termsConditionsContent ? `
    <div class="terms-column">
      <h4>Terms And Conditions</h4>
      <div class="terms-content">${termsConditionsContent}</div>
    </div>
    ` : ''}
  </div>

  <div class="totals">
    <table>
      <tr><td class="tot-label">Gross Amount</td><td class="tot-val">${fmt(grossAmount)}</td></tr>
      <tr><td class="tot-label">Taxable Amount</td><td class="tot-val">${fmt(taxableAmount)}</td></tr>
      <tr><td class="tot-label">Tax Amount</td><td class="tot-val">${fmt(taxAmount)}</td></tr>
      <tr><td class="tot-label">Net Amount</td><td class="tot-val">${fmt(netAmount)}</td></tr>
      <tr><td class="tot-label">WHT Amount</td><td class="tot-val">${fmt(-vatWithheldAmount)}</td></tr>
      <tr><td class="tot-label">VAT Withheld Amount</td><td class="tot-val">${q.vatWithheld === 'YES' ? fmt(vatWithheldAmount) : '0.00'}</td></tr>
      <tr><td class="tot-label">Discount</td><td class="tot-val">${fmt(discountTotal)}</td></tr>
      <tr class="receivable"><td class="tot-label">${sym} Receivable</td><td class="tot-val">${sym} ${fmt(finalAmount)}</td></tr>
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
