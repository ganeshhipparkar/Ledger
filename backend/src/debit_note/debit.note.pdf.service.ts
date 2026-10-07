import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DebitNoteEntity } from './entity/debit.note.entity';

@Injectable()
export class DebitNotePdfService {
  constructor(
    @InjectRepository(DebitNoteEntity)
    private readonly debitNoteRepo: Repository<DebitNoteEntity>,
  ) {}

  async generateAndStoreDebitNotePdf(debitNoteId: number): Promise<string> {
    const debitNote = await this.debitNoteRepo.findOne({
      where: { id: debitNoteId },
      relations: [
        'company',
        'customer',
        'currency',
        'invoice',
        'invoice.invoiceItems',
        'invoice.invoiceItems.item',
        'taxGroup',
        'attachments',
      ],
    });

    if (!debitNote) throw new Error(`Credit Note ${debitNoteId} not found`);

    const html = this.buildDebitNoteHtml(debitNote);

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

      const targetDir = path.join('./upload', 'debit_note', String(debitNoteId), 'debit_note');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const filePath = path.join(targetDir, 'debit-note.pdf');
      fs.writeFileSync(filePath, pdfBuffer);

      const debitNotePdfPath = `/upload/debit_note/${debitNoteId}/debit_note/debit-note.pdf`;
      await this.debitNoteRepo.update({ id: debitNoteId }, { debitNotePdfPath });
      return debitNotePdfPath;
    } finally {
      await browser.close();
    }
  }

  private numberToWords(num: number): string {
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    if ((num = num.toString() as any).length > 9) return 'overflow';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
    str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
    str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
    str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
    str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) : '';
    return str.trim();
  }

  buildDebitNoteHtml(q: DebitNoteEntity): string {
    const fmt = (n: any, decimals = 2): string => {
      if (n == null) return '0.00';
      return Number(n).toFixed(decimals);
    };

    const sym = q.currency?.symbol || (q.currency as any)?.code || '';
    const symLabel = sym ? `(${sym})` : '';

    const grossAmount   = Number(q.totalAmount ?? 0);
    const taxableAmount = 0; 
    const taxAmount     = Number(q.taxAmount ?? 0);
    const whtAmount     = 0;
    const netAmount     = Number(q.finalAmount ?? 0);
    const amountInWords = this.numberToWords(Math.floor(netAmount));

    const company   = q.company;
    const customer  = q.customer;

    const companyAddr  = [company?.AddressLineOne, company?.city, company?.state, company?.country].filter(Boolean).join(', ');
    const customerAddr = [customer?.AddressLineOne, customer?.city, customer?.state, customer?.country].filter(Boolean).join(', ');
    const customerAttn = [customer?.ownerFirstName, customer?.ownerLastName].filter(Boolean).join(' ') || customer?.customerName || '—';

    const invoiceItems = q.invoice?.invoiceItems ?? [];
    let itemRows = '';

    // Check if it maps cleanly (e.g., full credit). If it's a partial credit, the totals won't match, so we fallback.
    const invoiceTotal = Number(q.invoice?.finalAmount ?? 0);
    const isCleanMap = Math.abs(netAmount - invoiceTotal) < 0.01;

    if (invoiceItems.length > 0 && isCleanMap) {
      const items = invoiceItems.map((item: any) => ({
        description: item.description || item.item?.itemName || (item.itemId ? `Item #${item.itemId}` : 'Service'),
        qty:         Number(item.quantity ?? 0),
        unitPrice:   Number(item.unitPrice ?? 0),
        taxGroup:    item.taxGroup ?? '—',
        taxAmount:   Number(item.taxAmount ?? 0),
        finalAmount: Number(item.finalAmount ?? 0),
      }));

      itemRows = items.map((item, idx) => `
        <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td>${item.description}</td>
          <td class="tr">${item.qty % 1 === 0 ? item.qty : item.qty.toFixed(4)}</td>
          <td class="tr">${fmt(item.unitPrice)}</td>
          <td class="tc">${item.taxGroup}</td>
          <td class="tr">${'—'}</td>
          <td class="tr">${fmt(item.finalAmount)}</td>
        </tr>`).join('');
    } else {
      itemRows = `
        <tr class="row-even">
          <td>${q.narration || 'Credit Note'}</td>
          <td class="tr">1</td>
          <td class="tr">${fmt(q.totalAmount)}</td>
          <td class="tc">${q.taxGroup?.taxName || '—'}</td>
          <td class="tr">${'—'}</td>
          <td class="tr">${fmt(q.finalAmount)}</td>
        </tr>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Credit Note ${q.debitNoteCode ?? ''}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#222;background:#fff}
.page{width:210mm;min-height:297mm;padding:12mm 14mm 8mm 14mm;display:flex;flex-direction:column}
.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #e8a000;padding-bottom:6px;margin-bottom:12px}
.company-name{font-size:18pt;font-weight:bold;color:#cc3300;letter-spacing:.5px}
.invoice-title-block{text-align:right}
.invoice-title{font-size:13pt;font-weight:bold;color:#cc3300;margin-bottom:2px;display:flex;align-items:center;justify-content:flex-end;gap:8px}
.meta-section{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.billing-address{flex:0 0 55%;display:flex;gap:16px}
.address-col{flex:1}
.billing-address .co-label{font-weight:bold;font-size:9pt;margin-bottom:3px;color:#222}
.billing-address .addr{color:#444;font-size:8.5pt;line-height:1.6}
.billing-address .attn{margin-top:4px;font-size:8.5pt;color:#333}
.info-box{border:1px solid #ddd;border-radius:3px;overflow:hidden;flex:0 0 42%;font-size:8pt;background:#f5f5f5;padding:8px}
.info-box table{width:100%;border-collapse:collapse}
.info-box td{padding:5px 8px;vertical-align:top}
.info-box .lc{color:#444;width:40%}
.info-box .vc{color:#222;font-weight:bold}
.items-section{margin-bottom:12px}
.items-table{width:100%;border-collapse:collapse;font-size:8pt}
.items-table thead tr{background:#fff;border-top:1px solid #ccc;border-bottom:1px solid #ccc}
.items-table thead th{padding:8px 6px;text-align:left;font-weight:bold;font-size:8pt}
.items-table thead th.tr{text-align:right}
.items-table thead th.tc{text-align:center}
.items-table tbody td{padding:8px 6px;vertical-align:top;}
.items-table .tr{text-align:right}
.items-table .tc{text-align:center}
.row-even{background:#fff}
.row-odd{background:#fff}
.bottom-section{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:auto;padding-bottom:20px;}
.left-column{flex:0 0 52%;font-size:8pt;padding-top:20px}
.remarks h4{font-weight:bold;font-size:8pt;margin-bottom:10px}
.remarks-content{white-space:pre-wrap;color:#444}
.totals{flex:0 0 44%;font-size:8.5pt;padding-top:20px}
.totals table{width:100%;border-collapse:collapse}
.totals td{padding:4px 4px;border-bottom:none}
.tot-label{color:#444;text-align:right;width:60%}
.tot-val{text-align:right;font-weight:500;white-space:nowrap}
.totals tr.receivable td{font-weight:bold;font-size:9pt;border-top:1px solid #333;border-bottom:1px solid #333;padding:8px 4px}
.amount-in-words{text-align:right;font-size:8pt;color:#333;margin-top:4px}
.thank-you-bar{border-top:2px solid #e8a000;text-align:center;padding:15px 0 5px 0;margin-bottom:5px;font-size:10pt;color:#333;background:#f9f9f9}
.footer{padding-top:8px;font-size:7.5pt;color:#555}
.footer .fn{font-weight:bold;font-size:8.5pt;color:#222;margin-bottom:2px}
</style>
</head>
<body>
<div class="page">

<div class="header">
  <div class="company-name">${company?.companyName ?? ''}</div>
  <div class="invoice-title-block">
    <div class="invoice-title">DEBIT NOTE</div>
  </div>
</div>

<div class="meta-section">
  <div class="billing-address">
    <div class="address-col">
      <div class="co-label">${company?.companyName ?? ''}</div>
      <div class="addr">${companyAddr || '—'}</div>
      <div class="attn"><strong>ATTN: </strong>${customerAttn}</div>
    </div>
  </div>
  <div class="info-box">
    <table>
      <tr><td class="lc">Credit Note#</td><td class="vc">${q.debitNoteCode ?? '—'}</td></tr>
      <tr><td class="lc">Invoice No</td><td class="vc">${q.invoice?.invoiceCode ?? '—'}</td></tr>
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
  <div class="left-column">
    ${q.narration ? `
    <div class="remarks">
      <h4>Remarks</h4>
      <div style="border-top: 1px solid #333; width: 100%; margin-bottom: 5px;"></div>
      <div class="remarks-content">${q.narration}</div>
    </div>
    ` : ''}
  </div>

  <div class="totals">
    <table>
      <tr><td class="tot-label">Gross Amount</td><td class="tot-val">${fmt(grossAmount)}</td></tr>
      <tr><td class="tot-label">Taxable Amount</td><td class="tot-val">${fmt(taxableAmount)}</td></tr>
      <tr><td class="tot-label">Tax Amount</td><td class="tot-val">${fmt(taxAmount)}</td></tr>
      <tr><td class="tot-label">WHT Amount</td><td class="tot-val">${fmt(whtAmount)}</td></tr>
      <tr class="receivable"><td class="tot-label">Net Amount</td><td class="tot-val">${sym} ${fmt(netAmount)}</td></tr>
    </table>
    <div class="amount-in-words">${amountInWords}</div>
  </div>
</div>

<div style="margin-top:auto">
  <div class="thank-you-bar">Thank you for your business.</div>
  <div class="footer">
    <div class="fn">${company?.companyName ?? ''}</div>
    <div>${companyAddr || ''}</div>
    ${company?.phone ? `<div>Tel: ${company.phone}</div>` : ''}
    ${company?.email ? `<div>Email: ${company.email}</div>` : ''}
  </div>
</div>

</div>
</body>
</html>`;
  }
}
