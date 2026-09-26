import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNoteEntity } from './entity/credit.note.entity';
import { CreditNoteAttachmentsEntity } from './entity/credit.note.attachments.entity';
import { CreditNoteController } from './credit.note.controller';
import { CreditNoteService } from './service/credit.note.service';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { taxGroupEntity } from 'src/tax_group/entity/tax.group.entity';
import { InvoiceEntity } from 'src/invoice/entity/invoice.entity';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditNoteEntity,
      CreditNoteAttachmentsEntity,
      UserCompanyGroupEntity,
      GroupPermissionEntity,
      UserEntity,
      taxGroupEntity,
      InvoiceEntity,
    ]),
  ],
  controllers: [CreditNoteController],
  providers: [CreditNoteService, Filter, FileTransfer, CodeGeneratorService],
  exports: [TypeOrmModule, CreditNoteService],
})
export class CreditNoteModule {}
