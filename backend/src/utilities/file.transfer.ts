import * as fs from 'fs';
import * as path from 'path';

export class FileTransfer {
  async fileTransfer(
    filename: string,
    id: number | string,
    module: string,
    options?: { subfolder?: string; deleteExisting?: boolean },
  ): Promise<true | Error> {
    const subfolderPath = options?.subfolder ? `/${options.subfolder}` : '';
    const targetDir = `./upload/${module}/${id}${subfolderPath}`;
    try {
      const source = path.join('./temp-upload', filename);
      const dest = path.join(targetDir, filename);

      if (options?.deleteExisting && fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        for (const file of files) {
          const filePath = path.join(targetDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fs.existsSync(source)) {
        try {
          await fs.promises.rename(source, dest);
        } catch {
          await fs.promises.copyFile(source, dest);
          await fs.promises.unlink(source);
        }
      }
      return true;
    } catch (error: any) {
      return error;
    }
  }

  async fileTransferPaymentTransaction(
    filename: string,
    id: number | string,
    options?: { subfolder?: string; deleteExisting?: boolean },
  ): Promise<true | Error> {
    return this.fileTransfer(filename, id, 'payment_transaction', options);
  }
}
