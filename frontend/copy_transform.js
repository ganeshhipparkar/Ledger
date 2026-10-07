const fs = require('fs');
let content = fs.readFileSync('/var/www/html/project/frontend/src/components/debitNote/AddDebitNote.jsx', 'utf8');

// Replace component name
content = content.replace(/AddCreditNote/g, 'AddDebitNote');

// Change titles/labels
content = content.replace(/"Credit Note"/g, '"Debit Note"');
content = content.replace(/>Credit Note</g, '>Debit Note<');
content = content.replace(/>Credit Notes</g, '>Debit Notes<');
content = content.replace(/"Credit notes"/g, '"Debit notes"');
content = content.replace(/"Create Credit Note\?"/g, '"Create Debit Note?"');

// Endpoint/module changes
content = content.replace(/endpoint: "credit-note-add"/g, 'endpoint: "debit-note-add"');
content = content.replace(/module: "credit-note"/g, 'module: "debit-note"');
content = content.replace(/"\/credit-note-list"/g, '"/debit-note-list"');
content = content.replace(/"creditNoteAdd"/g, '"debitNoteAdd"');

// Navigation helper changes
content = content.replace(/useCreditNoteNavigation/g, 'useDebitNoteNavigation');

// Form Schema
content = content.replace(/CreditNoteInvoiceFormSchema/g, 'DebitNoteInvoiceFormSchema');

// In handleSave, append noteMode to payload
content = content.replace(/payload\.append\("invoiceId", formData\.invoiceId\);/, 'payload.append("invoiceId", formData.invoiceId);\n            payload.append("noteMode", "INVOICE");');

fs.writeFileSync('/var/www/html/project/frontend/src/components/debitNote/AddDebitNote.jsx', content);
