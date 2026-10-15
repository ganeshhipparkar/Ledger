import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { CustomerCurrencyVaultEntity } from './entity/customer.currency.vault.entity';
import { VaultLedgerEntity } from './entity/vault.ledger.entity';
import { InvoiceEntity, InvoiceStatus } from 'src/invoice/entity/invoice.entity';
import { applyInvoiceStrategy } from 'src/utilities/strageryFilter';

@Injectable()
export class VaultService {
  constructor(
    @InjectRepository(CustomerCurrencyVaultEntity)
    private readonly vaultRepo: Repository<CustomerCurrencyVaultEntity>,
    @InjectRepository(VaultLedgerEntity)
    private readonly ledgerRepo: Repository<VaultLedgerEntity>,
  ) {}

  async credit(
    customerId: number,
    currencyId: number,
    companyId: number,
    paymentTransactionId: number,
    amount: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner ? queryRunner.manager : this.vaultRepo.manager;

    let vault = await manager.findOne(CustomerCurrencyVaultEntity, {
      where: { customerId, currencyId, companyId },
    });

    if (!vault) {
      const insertResult = await manager.insert(CustomerCurrencyVaultEntity, {
        customerId,
        currencyId,
        companyId,
        totalAmount: 0,
        status: 'Active',
        addedDate: new Date(),
        updatedDate: new Date(),
      });
      const vaultId = insertResult.raw?.insertId;
      vault = await manager.findOne(CustomerCurrencyVaultEntity, { where: { vaultId } });
    }

    if (!vault) {
      throw new Error('Failed to create or retrieve vault');
    }

    const beforeAmount = Number(vault.totalAmount);
    const afterAmount = beforeAmount + Number(amount);

    await manager.insert(VaultLedgerEntity, {
      vaultId: vault.vaultId,
      entryType: 'CREDIT',
      amount,
      remainingAmount: amount,
      beforeAmount,
      afterAmount,
      paymentTransactionId,
      addedDate: new Date(),
    });

    await manager.update(
      CustomerCurrencyVaultEntity,
      { vaultId: vault.vaultId },
      { totalAmount: afterAmount, updatedDate: new Date() }
    );
  }

  async deductAutomatic(
    invoiceId: number,
    customerId: number,
    currencyId: number,
    companyId: number,
    invoiceAmount: number,
    strategy: 'FIFO' | 'LIFO',
    queryRunner: QueryRunner,
  ): Promise<{ result: 'PAID' | 'PARTIAL' | 'UNPAID', amountPaid: number, remainingAmountDue: number }> {
    const manager = queryRunner.manager;
    let vault = await manager.findOne(CustomerCurrencyVaultEntity, {
      where: { customerId, currencyId, companyId },
    });

    if (!vault || Number(vault.totalAmount) <= 0) {
      return { result: 'UNPAID', amountPaid: 0, remainingAmountDue: invoiceAmount };
    }

    const order = strategy === 'LIFO' ? 'DESC' : 'ASC';

    const credits = await manager.createQueryBuilder(VaultLedgerEntity, 'ledger')
      .where('ledger.vaultId = :vaultId', { vaultId: vault.vaultId })
      .andWhere('ledger.entryType = :type', { type: 'CREDIT' })
      .andWhere('ledger.remainingAmount > 0')
      .andWhere('ledger.deletedAt IS NULL')
      .orderBy('ledger.addedDate', 'ASC')
      .getMany();

    let amountToPay = Number(invoiceAmount);
    let amountPaid = 0;

    for (const credit of credits) {
      if (amountToPay <= 0) break;
      const available = Number(credit.remainingAmount);
      const toDeduct = Math.min(amountToPay, available);

      const beforeAmount = Number(vault.totalAmount);
      const afterAmount = beforeAmount - toDeduct;

      await manager.insert(VaultLedgerEntity, {
        vaultId: vault.vaultId,
        entryType: 'DEBIT',
        amount: toDeduct,
        remainingAmount: undefined,
        beforeAmount,
        afterAmount,
        paymentTransactionId: credit.paymentTransactionId,
        invoiceId,
        addedDate: new Date(),
      });

      await manager.update(
        VaultLedgerEntity,
        { vaultLedgerId: credit.vaultLedgerId },
        { remainingAmount: available - toDeduct }
      );

      await manager.update(
        CustomerCurrencyVaultEntity,
        { vaultId: vault.vaultId },
        { totalAmount: afterAmount, updatedDate: new Date() }
      );

      vault.totalAmount = afterAmount;
      amountToPay -= toDeduct;
      amountPaid += toDeduct;
    }

    const remainingAmountDue = Number(invoiceAmount) - amountPaid;
    return {
      result: remainingAmountDue <= 0.0001 ? 'PAID' : (amountPaid > 0 ? 'PARTIAL' : 'UNPAID'),
      amountPaid,
      remainingAmountDue,
    };
  }

  async payOutstandingInvoices(
    customerId: number,
    currencyId: number,
    companyId: number,
    strategy: any,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner.manager;
    const order = strategy === 'LIFO' ? 'DESC' : 'ASC';

    const vault = await manager.findOne(CustomerCurrencyVaultEntity, {
      where: { customerId, currencyId, companyId },
    });

    if (!vault || Number(vault.totalAmount) <= 0) {
      return;
    }
    const qb = manager.createQueryBuilder(InvoiceEntity, 'invoice')
      .where('invoice.customerId = :customerId', { customerId })
      .andWhere('invoice.currencyId = :currencyId', { currencyId })
      .andWhere('invoice.companyId = :companyId', { companyId })
      .andWhere('invoice.status IN (:...statuses)', { statuses: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIALLY_PAID] });

    applyInvoiceStrategy(qb, strategy);

      const invoices = await qb.getMany();

    for (const invoice of invoices) {
      if (Number(vault.totalAmount) <= 0) {
        break;
      }

      const remainingToPay = Number(invoice.finalAmount) - Number(invoice.amountPaid || 0);
      if (remainingToPay <= 0) continue;

      const vaultResult = await this.deductAutomatic(
        invoice.invoiceId,
        customerId,
        currencyId,
        companyId,
        remainingToPay,
        strategy,
        queryRunner
      );

      if (vaultResult.result === 'PAID' || vaultResult.result === 'PARTIAL') {
        const finalStatus = vaultResult.result === 'PAID' ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
        const newAmountPaid = Number(invoice.amountPaid || 0) + vaultResult.amountPaid;

        await manager.update(InvoiceEntity, { invoiceId: invoice.invoiceId }, {
          status: finalStatus,
          amountPaid: newAmountPaid,
        });

        vault.totalAmount = Number(vault.totalAmount) - vaultResult.amountPaid;
      }
    }
  }

  async reverseCredit(
    paymentTransactionId: number,
    queryRunner: QueryRunner,
  ): Promise<{ customerId: number; currencyId: number; companyId: number }> {
    const manager = queryRunner.manager;

    const creditRow = await manager.createQueryBuilder(VaultLedgerEntity, 'ledger')
      .where('ledger.paymentTransactionId = :ptId', { ptId: paymentTransactionId })
      .andWhere('ledger.entryType = :type', { type: 'CREDIT' })
      .andWhere('ledger.deletedAt IS NULL')
      .getOne();
    
    if (!creditRow) {
      throw new Error(
        `No active CREDIT ledger row found for paymentTransactionId ${paymentTransactionId}. Already reversed?`,
      );
    }

    const debitRows = await manager.createQueryBuilder(VaultLedgerEntity, 'ledger')
      .where('ledger.paymentTransactionId = :ptId', { ptId: paymentTransactionId })
      .andWhere('ledger.entryType = :type', { type: 'DEBIT' })
      .andWhere('ledger.deletedAt IS NULL')
      .getMany();

    const invoiceReversal = new Map<number, number>();
    for (const debit of debitRows) {
      if (debit.invoiceId == null) continue;
      invoiceReversal.set(
        debit.invoiceId,
        (invoiceReversal.get(debit.invoiceId) ?? 0) + Number(debit.amount),
      );
    } 

    for (const [invoiceId, amountToReverse] of invoiceReversal.entries()) {
      const invoice = await manager.findOne(InvoiceEntity, { where: { invoiceId } });
      if (!invoice) continue;

      const newAmountPaid = Math.max(0, Number(invoice.amountPaid) - amountToReverse);

      let newStatus: InvoiceStatus;
      if (newAmountPaid <= 0) {
        newStatus = InvoiceStatus.UNPAID;
      } else {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      await manager.update(InvoiceEntity, { invoiceId }, {
        amountPaid: newAmountPaid,
        status: newStatus,
      });
    }

    if (debitRows.length > 0) {
      const debitIds = debitRows.map((d) => d.vaultLedgerId);
      await manager.createQueryBuilder()
        .update(VaultLedgerEntity)
        .set({ deletedAt: new Date() })
        .whereInIds(debitIds)
        .execute();
    }

    const vault = await manager.findOne(CustomerCurrencyVaultEntity, {
      where: { vaultId: creditRow.vaultId },
    });
    if (!vault) {
      throw new Error(`Vault not found for vaultId ${creditRow.vaultId}`);
    }

    const currentTotal = Number(vault.totalAmount);
    const deduction = Number(creditRow.remainingAmount ?? 0);

    if (deduction > currentTotal + 0.0001) {
      throw new Error(
        `Vault integrity error: deduction ${deduction} would exceed vault total ${currentTotal}. Reversal aborted.`,
      );
    }

    const newTotal = Math.max(0, currentTotal - deduction);

    await manager.update(
      CustomerCurrencyVaultEntity,
      { vaultId: vault.vaultId },
      { totalAmount: newTotal, updatedDate: new Date() },
    );

    await manager.update(
      VaultLedgerEntity,
      { vaultLedgerId: creditRow.vaultLedgerId },
      { deletedAt: new Date() },
    );

    return {
      customerId: vault.customerId,
      currencyId: vault.currencyId,
      companyId: vault.companyId,
    };
  }

  async getInvoicesForPayment(paymentTransactionId: number) {
    const rawData = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .leftJoin('ledger.invoice', 'invoice')
      .select('ledger.invoiceId', 'invoiceId')
      .addSelect('invoice.invoiceCode', 'invoiceCode')
      .addSelect('invoice.invoiceDate', 'invoiceDate')
      .addSelect('invoice.status', 'status')
      .addSelect('invoice.finalAmount', 'finalAmount')
      .addSelect('invoice.amountPaid', 'amountPaid')
      .addSelect('SUM(ledger.amount)', 'amountApplied')
      .addSelect('MAX(ledger.addedDate)', 'appliedDate')
      .where('ledger.paymentTransactionId = :paymentTransactionId', { paymentTransactionId })
      .andWhere("ledger.entryType = 'DEBIT'")
      .andWhere('ledger.deletedAt IS NULL')
      .andWhere('ledger.invoiceId IS NOT NULL')
      .groupBy('ledger.invoiceId')
      .addGroupBy('invoice.invoiceCode')
      .addGroupBy('invoice.invoiceDate')
      .addGroupBy('invoice.status')
      .addGroupBy('invoice.finalAmount')
      .addGroupBy('invoice.amountPaid')
      .getRawMany();

    let totalApplied = 0;
    const data = rawData.map(row => {
      const amountApplied = Number(row.amountApplied);
      totalApplied += amountApplied;
      return {
        invoiceId: row.invoiceId,
        invoiceCode: row.invoiceCode,
        invoiceDate: row.invoiceDate,
        status: row.status,
        finalAmount: Number(row.finalAmount),
        amountPaid: Number(row.amountPaid),
        amountApplied,
        appliedDate: row.appliedDate,
      };
    });

    return { data, totalApplied };
  }

  async getPaymentsForInvoice(invoiceId: number, params?: any) {
    const rawData = await this.ledgerRepo
      .createQueryBuilder('ledger')
      .leftJoin('ledger.paymentTransaction', 'payment')
      .select('ledger.paymentTransactionId', 'paymentTransactionId')
      .addSelect('payment.paymentCode', 'paymentCode')
      .addSelect('payment.paymentDate', 'paymentDate')
      .addSelect('payment.paymentMode', 'paymentMode')
      .addSelect('payment.status', 'status')
      .addSelect('payment.transactionAmount', 'transactionAmount')
      .addSelect('SUM(ledger.amount)', 'amountApplied')
      .addSelect('MAX(ledger.addedDate)', 'appliedDate')
      .where('ledger.invoiceId = :invoiceId', { invoiceId })
      .andWhere("ledger.entryType = 'DEBIT'")
      .andWhere('ledger.deletedAt IS NULL')
      .andWhere('ledger.paymentTransactionId IS NOT NULL')
      .groupBy('ledger.paymentTransactionId')
      .addGroupBy('payment.paymentCode')
      .addGroupBy('payment.paymentDate')
      .addGroupBy('payment.paymentMode')
      .addGroupBy('payment.status')
      .addGroupBy('payment.transactionAmount')
      .getRawMany();

    let totalApplied = 0;
    const allRows = rawData.map(row => {
      const amountApplied = Number(row.amountApplied);
      totalApplied += amountApplied;
      return {
        paymentTransactionId: row.paymentTransactionId,
        paymentCode: row.paymentCode,
        paymentDate: row.paymentDate,
        paymentMode: row.paymentMode,
        status: row.status,
        transactionAmount: Number(row.transactionAmount),
        amountApplied,
        appliedDate: row.appliedDate,
      };
    });

    allRows.sort((a, b) => (Number(b.paymentTransactionId) || 0) - (Number(a.paymentTransactionId) || 0));

    let filters = params?.filters;
    if (typeof filters === 'string') {
      try {
        filters = JSON.parse(filters);
      } catch {
        filters = [];
      }
    }

    let filteredRows = allRows;
    if (Array.isArray(filters) && filters.length > 0) {
      filteredRows = allRows.filter((row) => {
        for (const f of filters) {
          if (!f || !f.key || f.value === undefined || f.value === null || f.value === '') continue;
          let key = f.key;
          if (key === 'mode') key = 'paymentMode';
          const rowVal = String((row as any)[key] ?? '').toLowerCase();
          const filterVal = String(f.value).trim().toLowerCase();
          if (filterVal === '') continue;

          if (f.operator === 'eq' || f.operator === 'equal') {
            if (rowVal !== filterVal) return false;
          } else {
            if (!rowVal.includes(filterVal)) return false;
          }
        }
        return true;
      });
    }

    const total = filteredRows.length;
    let paginatedData = filteredRows;
    if (params?.page !== undefined || params?.limit !== undefined) {
      let page = Number(params?.page) || 1;
      let limit = Number(params?.limit) || 10;
      if (page < 1) page = 1;
      if (limit < 1) limit = 10;
      const startIndex = (page - 1) * limit;
      paginatedData = filteredRows.slice(startIndex, startIndex + limit);
    }

    return { data: paginatedData, total, totalApplied };
  }
}
