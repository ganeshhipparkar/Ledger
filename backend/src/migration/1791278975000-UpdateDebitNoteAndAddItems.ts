import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDebitNoteAndAddItems1791278975000 implements MigrationInterface {
    name = 'UpdateDebitNoteAndAddItems1791278975000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        try {
            await queryRunner.query(`ALTER TABLE \`debit_note\` CHANGE \`customerCharges\` \`customerCharges\` enum ('INVOICE_CHARGES', 'GLOBAL_CUSTOMER_CHARGES', 'DEMO_TEST_CHARGES') NULL`);
        } catch (e) {
            console.log("Migration warning: debit_note alter failed or already applied", e.message);
        }

        await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`debit_note_items\` (\`debitNoteItemId\` int NOT NULL AUTO_INCREMENT, \`debitNoteId\` int NOT NULL, \`invoiceItemId\` int NULL, \`itemId\` int NULL, \`description\` varchar(255) NULL, \`lineType\` enum ('INVOICE_ITEM', 'SERVICE') NOT NULL DEFAULT 'INVOICE_ITEM', \`itemGL\` varchar(255) NULL, \`quantity\` decimal(18,4) NOT NULL, \`unitPrice\` decimal(18,4) NOT NULL, \`totalAmount\` decimal(18,4) NOT NULL, \`taxCalculation\` enum ('Inclusive', 'Exclusive', 'NA') NOT NULL DEFAULT 'NA', \`taxGroup\` varchar(255) NULL, \`taxAmount\` decimal(18,4) NOT NULL DEFAULT '0.0000', \`taxableAmount\` decimal(18,4) NOT NULL DEFAULT '0.0000', \`finalAmount\` decimal(18,4) NOT NULL DEFAULT '0.0000', \`addedBy\` int NULL, \`addedDate\` datetime NULL, \`updatedBy\` int NULL, \`updatedDate\` datetime NULL, PRIMARY KEY (\`debitNoteItemId\`)) ENGINE=InnoDB`);
        
        try {
            await queryRunner.query(`ALTER TABLE \`debit_note_items\` ADD CONSTRAINT \`FK_debit_note_items_debitNoteId\` FOREIGN KEY (\`debitNoteId\`) REFERENCES \`debit_note\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        } catch (e) {
            console.log("Migration warning: FK_debit_note_items_debitNoteId failed or already applied", e.message);
        }
        
        try {
            await queryRunner.query(`ALTER TABLE \`debit_note_items\` ADD CONSTRAINT \`FK_debit_note_items_itemId\` FOREIGN KEY (\`itemId\`) REFERENCES \`item\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`);
        } catch (e) {
            console.log("Migration warning: FK_debit_note_items_itemId failed or already applied", e.message);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`debit_note_items\` DROP FOREIGN KEY \`FK_debit_note_items_itemId\``);
        await queryRunner.query(`ALTER TABLE \`debit_note_items\` DROP FOREIGN KEY \`FK_debit_note_items_debitNoteId\``);
        await queryRunner.query(`DROP TABLE \`debit_note_items\``);
        await queryRunner.query(`ALTER TABLE \`debit_note\` CHANGE \`customerCharges\` \`customerCharges\` enum ('INVOICE_CHARGES', 'GLOBAL_CUSTOMER_CHARGES', 'DEMO_TEST_CHARGES') NOT NULL`);
    }
}
