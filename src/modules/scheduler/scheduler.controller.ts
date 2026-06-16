import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ConfigService } from '@nestjs/config';

@Controller('admin/scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly configService: ConfigService,
  ) {}

  private verifyAdminKey(key: string): void {
    const adminKey = this.configService.get<string>('app.adminKey');
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async triggerReset(
    @Headers('x-admin-key') adminKey: string,
    @Query('shop') shopDomain?: string,
  ) {
    this.verifyAdminKey(adminKey);

    const result = await this.schedulerService.triggerManualReset(shopDomain);

    this.logger.log(
      `Manual reset triggered via API — ${result.reset} shop(s) reset` +
        (shopDomain ? ` (${shopDomain})` : ' (all)'),
    );

    return {
      success: true,
      message: `${result.reset} shop(s) reset successfully`,
      data: result,
    };
  }

  @Post('health-check')
  @HttpCode(HttpStatus.OK)
  async triggerHealthCheck(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdminKey(adminKey);
    await this.schedulerService.weeklySubscriptionHealthCheck();
    return { success: true, message: 'Health check complete — see server logs' };
  }
}
