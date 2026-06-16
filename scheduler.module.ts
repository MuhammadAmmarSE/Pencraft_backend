import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { Shop } from '../../database/entities/shop.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SequelizeModule.forFeature([Shop]),
    BillingModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
