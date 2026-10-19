import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from 'src/company/entity/company.entity';
import { CustomerEntity } from 'src/customer/entity/customer.entity';
import { GroupPermissionEntity } from 'src/group/entity/capability.entity';
import { UserCompanyGroupEntity } from 'src/packages/entity/user.company.group.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { Filter } from 'src/utilities/filter';
import { FileTransfer } from 'src/utilities/file.transfer';
import { CodeGeneratorService } from 'src/utilities/code-generator.service';
import { OrderEntity } from 'src/order/entity/order.entity';
import { OrderItemEntity } from 'src/order/entity/order.item.entity';
import { ItemEntity } from 'src/item/entity/item.entity';
import { DeliveryNoteEntity } from './entity/delivery.note.entity';
import { DeliveryNoteItemEntity } from './entity/delivery.note.item.entity';
import { DeliveryNoteAttachmentEntity } from './entity/delivery.note.attachments.entity';
import { DeliveryNoteController } from './delivery.note.controller';
import { DeliveryNoteService } from './service/delivery.note.service';
import { DeliveryNoteListService } from './service/delivery.note.list.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryNoteEntity,
      DeliveryNoteItemEntity,
      DeliveryNoteAttachmentEntity,
      OrderEntity,
      OrderItemEntity,
      CustomerEntity,
      CompanyEntity,
      UserCompanyGroupEntity,
      UserEntity,
      GroupPermissionEntity,
      ItemEntity,
    ]),
  ],
  controllers: [DeliveryNoteController],
  providers: [
    DeliveryNoteService,
    DeliveryNoteListService,
    Filter,
    FileTransfer,
    CodeGeneratorService,
  ],
  exports: [TypeOrmModule, DeliveryNoteService, DeliveryNoteListService],
})
export class DeliveryNoteModule {}
