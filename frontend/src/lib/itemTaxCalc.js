export const TAX_CALC_OPTIONS = ["N/A", "EXCLUSIVE", "INCLUSIVE"];

export function getItemLabel(it) {
    if (!it) return "";
    if (it.description) return it.description;
    const name =
        it.itemName ||
        it.item?.itemName ||
        it.item_itemName ||
        it.name ||
        it.item?.name ||
        "";
    const code =
        it.itemCode ||
        it.item?.itemCode ||
        it.item_itemCode ||
        it.code ||
        it.item?.code ||
        "";
    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;
    return it.itemLabel || "";
}

export function computeItem(item) {
    const qty = Math.max(0, parseFloat(item.quantity) || 0);
    const up = Math.max(0, parseFloat(item.unitPrice) || 0);
    const amount = qty * up;
    const discountTotal = (item.discounts || []).reduce((s, d) => s + Math.max(0, parseFloat(d.discountPrice ?? d.amount) || 0), 0);
    const extraChargeTotal = (item.extraCharges || []).reduce((s, ec) => s + Math.max(0, parseFloat(ec.extraChargesPrice ?? ec.extraChargePrice ?? ec.amount) || 0), 0);
    const rawTotalAmount = amount - discountTotal + extraChargeTotal;
    const totalAmount = isNaN(rawTotalAmount) ? 0 : Math.max(0, rawTotalAmount);
    const rate = parseFloat(item.taxRate) || 0;
    let taxableAmount = 0;
    let taxAmount = 0;
    let finalAmount = totalAmount;

    if (item.taxCalculation === "INCLUSIVE") {
        taxableAmount = rate > 0 ? totalAmount / (1 + rate / 100) : totalAmount;
        taxAmount = totalAmount - taxableAmount;
        finalAmount = totalAmount;
    } else if (item.taxCalculation === "EXCLUSIVE") {
        taxableAmount = totalAmount;
        taxAmount = (taxableAmount * rate) / 100;
        finalAmount = totalAmount + (isNaN(taxAmount) ? 0 : taxAmount);
    } else {
        taxableAmount = 0;
        taxAmount = 0;
        finalAmount = totalAmount;
    }
    const resolvedLabel = item.itemLabel || getItemLabel(item);
    return {
        ...item,
        itemLabel: resolvedLabel,
        amount: isNaN(amount) ? 0 : amount,
        discountTotal: isNaN(discountTotal) ? 0 : discountTotal,
        extraChargeTotal: isNaN(extraChargeTotal) ? 0 : extraChargeTotal,
        totalAmount,
        taxableAmount: isNaN(taxableAmount) ? 0 : taxableAmount,
        taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
        finalAmount: isNaN(finalAmount) ? 0 : finalAmount,
    };
}
