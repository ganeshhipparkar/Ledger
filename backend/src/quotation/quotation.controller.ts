import { Controller } from "@nestjs/common";
import { QuotationService } from "./quotation.service";

@Controller('quotation')
export class QuotationContorller{
    constructor(private readonly quotationService:QuotationService){}
}