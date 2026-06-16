import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';

// Entities
import { Shop } from './database/entities/shop.entity';
import { RewriteJob } from './database/entities/rewrite-job.entity';
import { UsageLog } from './database/entities/usage-log.entity';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { CopywriterModule } from './modules/copywriter/copywriter.module';
import { ProductsModule } from './modules/products/products.module';
import { BillingModule } from './modules/billing/billing.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

// Health
import { HealthController } from './health.controller';

@Module({
  imports: [
    // ─── Config ───────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: '.env',
    }),

    // ─── Database ─────────────────────────────────────────────────────────────
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        dialect: 'mysql',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        models: [Shop, RewriteJob, UsageLog],
        autoLoadModels: true,
        sync: config.get('app.nodeEnv') === 'development' ? { alter: true } : false,
        logging: config.get('app.nodeEnv') === 'development' ? console.log : false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        define: {
          underscored: false,
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
        },
      }),
    }),

    // ─── Rate Limiting ─────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl') * 1000,
          limit: config.get<number>('throttle.limit'),
        },
      ],
    }),

    // ─── Shared (needed for HealthController) ─────────────────────────────────
    SequelizeModule.forFeature([Shop]),

    // ─── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    CopywriterModule,
    ProductsModule,
    BillingModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
