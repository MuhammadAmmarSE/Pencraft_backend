import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Shop } from '../database/entities/shop.entity';

@Controller('health')
export class HealthController {
  constructor(
    @InjectModel(Shop)
    private readonly shopModel: typeof Shop,
  ) {}

  @Get()
  async check() {
    // Ping the DB to confirm connection is alive
    let dbOk = false;
    try {
      await this.shopModel.count();
      dbOk = true;
    } catch {}

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      db: dbOk ? 'connected' : 'error',
    };
  }
}
