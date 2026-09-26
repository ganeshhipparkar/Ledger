import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityService } from '../service/activity.service';
import type { LogPayload } from '../service/activity.service';

@Injectable()
export class ActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  // Simple redaction of sensitive fields before persisting the log
  private sanitizeParameters(params: any): any {
    if (!params) return params;
    const sanitized = { ...params };
    const sensitiveKeys = [
      'password',
      'confirmpass',
      'newpass',
      'token',
      'otp',
      'passwordcheck',
    ];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  @OnEvent('activity.log')
  async handleActivityLogEvent(payload: LogPayload) {
    // Sanitize sensitive data before delegating to ActivityService
    const safePayload = {
      ...payload,
      parameters: this.sanitizeParameters(payload.parameters),
    };
    await this.activityService.log(safePayload);
  }
}
