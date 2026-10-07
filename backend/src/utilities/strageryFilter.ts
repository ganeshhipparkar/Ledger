import { SelectQueryBuilder } from 'typeorm';
import { InvoiceEntity } from '../invoice/entity/invoice.entity';

export function applyInvoiceStrategy(
  qb: SelectQueryBuilder<InvoiceEntity>,
  strategyParam?: string
): SelectQueryBuilder<InvoiceEntity> {
  const variable = (strategyParam || process.env.INVOICE_PAYMENT_STRATEGY || 'FIFO').toUpperCase();
  const currentDate = new Date();

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  switch (variable) {
    case 'LIFO':
      qb.orderBy('invoice.addedDate', 'DESC');
      break;

    case 'CURRENT_MONTH': {
      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      const startOfNextMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1,
      );

      qb.andWhere('invoice.addedDate >= :startOfMonth', { startOfMonth: formatDate(startOfMonth) })
        .andWhere('invoice.addedDate < :startOfNextMonth', { startOfNextMonth: formatDate(startOfNextMonth) })
        .orderBy('invoice.addedDate', 'ASC');
      break;
    }

    case 'LAST_MONTH': {
      const startOfLastMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1,
      );
      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );

      qb.andWhere('invoice.addedDate >= :startOfLastMonth', { startOfLastMonth: formatDate(startOfLastMonth) })
        .andWhere('invoice.addedDate < :startOfMonth', { startOfMonth: formatDate(startOfMonth) })
        .orderBy('invoice.addedDate', 'ASC');
      break;
    }
    
    case 'QUARTER':
        const quarterBefore=new Date(
            currentDate.getFullYear(),
            currentDate.getMonth()-4,
            1
        )
        qb.andWhere('invoice.addedDate >= :quarterBefore',{quarterBefore:formatDate(quarterBefore)})
        .orderBy('invoice.addedDate','ASC')
        break;

    case 'CURRENT_YEAR':
        const currentYear=new Date(
          currentDate.getFullYear(),
          1,
          1
        )
        qb.andWhere('invoice.addedDate >= :currentYear',{currentYear:formatDate(currentYear)})
        .orderBy('invoice.addedDate', 'ASC')
        break;

    case 'LAST_YEAR':
      const lastYearStart=new Date(
        currentDate.getFullYear()-1,
        1,
        1
      )
      const lastYearEnd=new Date(
        currentDate.getFullYear(),
        1,
        1
      )
      qb.andWhere('invoice.addedDate >=:lastYearStart',{lastYearStart:formatDate(lastYearStart)})
      qb.andWhere('invoice.addedDate >:lastYearEnd',{lastYearEnd :formatDate(lastYearEnd)})
      .orderBy('invoice.addedDate','ASC')
      break;

    case 'BETWEEN_FIVE_TWENTY_FIVE':
        qb.andWhere('invoice.finalAmount-invoice.amountPaid>=5000')
        qb.andWhere('invoice.finalAmount-invoice.amountPaid<=25000')
        .orderBy('invoice.addedDate','ASC')
        break;

      

    case 'FIFO':
    default:
      qb.orderBy('invoice.invoiceDate', 'ASC');
      break;
  }
  
  return qb;
}