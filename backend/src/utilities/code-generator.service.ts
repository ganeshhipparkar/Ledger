import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';

@Injectable()
export class CodeGeneratorService {
  async generateCode(
    repository: Repository<any>,
    name: string,
    companyId: number,
    codeField: string,
    fallbackPrefix?: string,
  ) {
    const rawPrefix = name.trim().replace(/\s/g, '').substring(0, 8).toUpperCase();
    const prefix = rawPrefix.length > 0 ? rawPrefix : (fallbackPrefix ?? rawPrefix);
    let counter = 1;
    let code: string;
    do {
      code = `${prefix}${String(counter).padStart(3, '0')}`;
      const existing = await repository.findOne({
        where: { [codeField]: code, companyId: Number(companyId) },
      });
      if (!existing) break;
      counter++;
    } while (true);
    return code;
  }
}
