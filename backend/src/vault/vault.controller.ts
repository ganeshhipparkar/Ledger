import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard, RequirePermission } from 'src/utilities/permissions.guard';
import { VaultService } from './vault.service';
import { encryptResponse } from 'src/utilities/crypto';

@Controller('vault')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}


  @Get('payment-config')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission('invoiceView')
  async getPaymentConfig() {
    return {
      encrypted: encryptResponse({
        success: 1,
        mode: (process.env.INVOICE_PAYMENT_MODE || 'AUTOMATIC').toUpperCase(),
        strategy: (process.env.INVOICE_PAYMENT_STRATEGY || 'FIFO').toUpperCase(),
      }),
    };
  }
}
