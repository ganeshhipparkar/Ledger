import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserCompanyGroupEntity } from '../../packages/entity/user.company.group.entity';
import { QuotationEntity } from 'src/quotation/entity/quotation.entity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn()
  userId!: number;

  @Column({ name: 'name', unique: true })
  name!: string;

  @Column({ nullable: true })
  firstName!: string;

  @Column({ nullable: true })
  middleName?: string;

  @Column({ nullable: true })
  surname?: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'date', nullable: true })
  dob!: Date;

  @Column({ nullable: true })
  otp!: number;

  @Column({ nullable: true })
  token!: string;

  @Column()
  phone!: string;

  @Column()
  status!: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  dialCode!: string;

  @Column({ nullable: true })
  country!: string;

  @Column({ nullable: true })
  state!: string;

  @Column({ nullable: true })
  city!: string;

  @Column({ nullable: true })
  alternatePhone!: string;

  @Column({ type: 'text', nullable: true })
  remarks!: string;

  @Column({ nullable: true })
  createdBy!: number;

  @Column({ nullable: true })
  updatedBy!: number;

  @Column({ type: 'varchar', nullable: true })
  userFile!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ nullable: true })
  updatedDate!: Date;

  @OneToMany(() => UserCompanyGroupEntity, (ucg) => ucg.user, { cascade: true })
  userCompanyGroups!: UserCompanyGroupEntity[];

  @OneToMany(() => QuotationEntity, (quotation) => quotation.salesPerson)
  quotationsAsSalesPerson?: QuotationEntity[];
}
