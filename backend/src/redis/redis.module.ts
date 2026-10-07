import { Global, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from 'src/packages/config/redis.config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const logger = new Logger('RedisModule');
        const client = new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
           lazyConnect: true,
          retryStrategy: (times) => { 
            return Math.min(times * 200, 10_000);
          },
        });

        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err: Error) =>
          logger.warn(`Redis error: ${err.message}`),
        );
 
        client.connect().catch(() => {});

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
