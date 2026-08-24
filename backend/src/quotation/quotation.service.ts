import { Injectable } from '@nestjs/common';
import { QuotationDto, QuotationListDto, QuotationUpdateDto } from './dto/quotation.dto';

@Injectable()
export class QuotationService {

  async quotationList(body: QuotationListDto, req: any) {
    return {};
  }

  async getQuotationDetails(id: number, req: any){
    return {};
  }

  async insertQuotation(
    body: QuotationDto,
    req: any,
    files: { attachments?: Express.Multer.File[]; termsConditionsFile?: Express.Multer.File[] },
  ){
    return {};
  }

  async updateQuotation(
    body: QuotationUpdateDto & { updatedBy?: number },
    req: any,
    files: { attachments?: Express.Multer.File[]; termsConditionsFile?: Express.Multer.File[] },
  ) {
    return {};
  }
}