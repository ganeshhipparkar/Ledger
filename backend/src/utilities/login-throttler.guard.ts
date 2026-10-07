import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip;
    const identifier = req.body?.email || req.body?.impersonatorEmail || 'anonymous';
    
    return `${identifier}`;
  }
}       

//-${identifier}