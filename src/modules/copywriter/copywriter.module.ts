import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CopywriterService } from './copywriter.service';
import { CopywriterController } from './copywriter.controller';
import { RewriteJob } from '../../database/entities/rewrite-job.entity';
import { UsageLog } from '../../database/entities/usage-log.entity';
import { Shop } from '../../database/entities/shop.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    SequelizeModule.forFeature([RewriteJob, UsageLog, Shop]),
    AuthModule,
  ],
  controllers: [CopywriterController],
  providers: [CopywriterService],
  exports: [CopywriterService],
})
export class CopywriterModule {}
