import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Shop, PlanType, ShopStatus } from '../../database/entities/shop.entity';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectModel(Shop)
    private readonly shopModel: typeof Shop,
    private readonly billingService: BillingService,
  ) {}

  @Cron('0 0 1 * *', { name: 'monthly-usage-reset', timeZone: 'UTC' })
  async resetMonthlyUsage(): Promise<void> {
    this.logger.log('━━━ Monthly usage reset started ━━━');
    const startedAt = Date.now();

    const shops = await this.shopModel.findAll({
      where: { status: ShopStatus.ACTIVE },
      attributes: ['id', 'shopDomain', 'plan', 'shopifyChargeId', 'billingCycleStart', 'monthlyRewrites'],
    });

    this.logger.log(`Found ${shops.length} active shops to process`);

    let resetCount = 0;
    let errorCount = 0;

    for (const shop of shops) {
      try {
        if (shop.plan !== PlanType.FREE && shop.shopifyChargeId) {
          const status = await this.billingService.getSubscriptionStatus(
            shop,
            shop.shopifyChargeId,
          );

          if (['CANCELLED', 'EXPIRED', 'DECLINED', 'FROZEN'].includes(status)) {
            await shop.update({
              plan: PlanType.FREE,
              shopifyChargeId: null,
              monthlyRewrites: 0,
              billingCycleStart: new Date().toISOString().split('T')[0],
            });
            this.logger.warn(`${shop.shopDomain} downgraded to free — subscription ${status}`);
            resetCount++;
            continue;
          }
        }

        await shop.update({
          monthlyRewrites: 0,
          billingCycleStart: new Date().toISOString().split('T')[0],
        });

        resetCount++;
      } catch (error: any) {
        errorCount++;
        this.logger.error(`✗ Failed to reset ${shop.shopDomain}: ${error.message}`);
      }
    }

    const duration = ((Date.now() - startedAt) / 1000).toFixed(2);
    this.logger.log(
      `━━━ Monthly reset complete — ${resetCount} reset, ${errorCount} errors — ${duration}s ━━━`,
    );
  }

  @Cron('0 2 * * *', { name: 'daily-cycle-check', timeZone: 'UTC' })
  async checkIndividualBillingCycles(): Promise<void> {
    this.logger.log(`Daily billing cycle check — day ${new Date().getDate()}`);

    const shops = await this.shopModel.findAll({
      where: {
        status: ShopStatus.ACTIVE,
        plan: { [Op.ne]: PlanType.FREE },
        billingCycleStart: { [Op.ne]: null },
      },
    });

    const shopsToReset = shops.filter((shop) => {
      if (!shop.billingCycleStart) return false;
      const cycleDay = new Date(shop.billingCycleStart).getDate();
      return cycleDay === new Date().getDate();
    });

    if (shopsToReset.length === 0) {
      this.logger.log('No shops to reset today');
      return;
    }

    this.logger.log(`Resetting ${shopsToReset.length} shops on today's billing day`);

    for (const shop of shopsToReset) {
      try {
        await shop.update({ monthlyRewrites: 0 });
        this.logger.log(`✓ Cycle reset: ${shop.shopDomain} (plan: ${shop.plan})`);
      } catch (error: any) {
        this.logger.error(`✗ Cycle reset failed for ${shop.shopDomain}: ${error.message}`);
      }
    }
  }

  @Cron('0 3 * * 0', { name: 'weekly-subscription-health-check', timeZone: 'UTC' })
  async weeklySubscriptionHealthCheck(): Promise<void> {
    this.logger.log('━━━ Weekly subscription health check started ━━━');

    const paidShops = await this.shopModel.findAll({
      where: {
        status: ShopStatus.ACTIVE,
        plan: { [Op.ne]: PlanType.FREE },
        shopifyChargeId: { [Op.ne]: null },
      },
    });

    this.logger.log(`Checking ${paidShops.length} paid subscriptions`);

    let healthyCount = 0;
    let problemCount = 0;

    for (const shop of paidShops) {
      try {
        const status = await this.billingService.getSubscriptionStatus(
          shop,
          shop.shopifyChargeId,
        );

        if (status === 'ACTIVE') {
          healthyCount++;
        } else {
          problemCount++;
          this.logger.warn(`⚠ ${shop.shopDomain} subscription is ${status}`);

          if (['CANCELLED', 'EXPIRED', 'DECLINED'].includes(status)) {
            await shop.update({ plan: PlanType.FREE, shopifyChargeId: null });
            this.logger.warn(`${shop.shopDomain} auto-downgraded to free`);
          }
        }
      } catch (error: any) {
        this.logger.error(`Health check failed for ${shop.shopDomain}: ${error.message}`);
      }
    }

    this.logger.log(
      `━━━ Health check complete — ${healthyCount} healthy, ${problemCount} issues ━━━`,
    );
  }

  async triggerManualReset(shopDomain?: string): Promise<{ reset: number }> {
    if (shopDomain) {
      const shop = await this.shopModel.findOne({ where: { shopDomain } });
      if (!shop) throw new Error(`Shop not found: ${shopDomain}`);
      await shop.update({
        monthlyRewrites: 0,
        billingCycleStart: new Date().toISOString().split('T')[0],
      });
      this.logger.log(`Manual reset triggered for ${shopDomain}`);
      return { reset: 1 };
    }

    const [affected] = await this.shopModel.update(
      {
        monthlyRewrites: 0,
        billingCycleStart: new Date().toISOString().split('T')[0],
      },
      { where: { status: ShopStatus.ACTIVE } },
    );

    this.logger.log(`Manual reset triggered for all shops — ${affected} affected`);
    return { reset: affected };
  }
}
