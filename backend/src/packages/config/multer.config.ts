import { BadRequestException } from '@nestjs/common';
import { DiffieHellman } from 'crypto';
import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerConfig = {
  storage: diskStorage({
    destination: `./temp-upload`,
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  }),
};

const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif'];

export const attachmentMulterConfig = {
  storage: multerConfig.storage,
  fileFilter: (req, file, callback) => {
    const ext = extname(file.originalname).toLowerCase();
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      callback(null, true);
    } else {
      callback(new BadRequestException('Only PDF and image files (JPG, PNG, WEBP, GIF) are allowed.'), false);
    }
  },
};
