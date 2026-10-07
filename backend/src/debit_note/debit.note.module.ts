import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebitNoteEntity } from './entity/debit.note.entity';
import { DebitNoteAttachmentsEntity } from './entity/debit.note.attachments.entity';
import { DebitNoteItemEntity } from './entity/debit.note.item.entity';
import { DebitNoteController } from './debit.note.controller';
import { DebitNoteService } from './service/debit.note.service';
import { DebitNoteListService } from './service/debit.note.list.service';
import { DebitNotePdfService } from './debit.note.pdf.service';
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
      DebitNoteEntity,
      DebitNoteAttachmentsEntity,
      DebitNoteItemEntity,
      UserCompanyGroupEntity,
      GroupPermissionEntity,
      UserEntity,
      taxGroupEntity,
      InvoiceEntity,
    ]),
  ],
  controllers: [DebitNoteController],
  providers: [DebitNoteService, DebitNoteListService, DebitNotePdfService, Filter, FileTransfer, CodeGeneratorService],
  exports: [TypeOrmModule, DebitNoteService, DebitNoteListService],
})
export class DebitNoteModule {}
