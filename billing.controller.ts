import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { Shop } from '../../database/entities/shop.entity';
import { PlanType } from '../../database/entities/shop.entity';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  // ─── GET /billing/plans ───────────────────────────────────────────────────
  // Returns all plan configs + current shop plan status
  @Get('plans')
  @UseGuards(JwtAuthGuard)
  async getPlans(@CurrentShop() shop: Shop) {
    const info = await this.billingService.getPlanInfo(shop);
    return {
      success: true,
      data: {
        ...info,
        shopPlan: shop.plan,
        monthlyRewrites: shop.monthlyRewrites,
        shopifyChargeId: shop.shopifyChargeId,
      },
    };
  }

  // ─── POST /billing/subscribe ──────────────────────────────────────────────
  // Initiates a Shopify subscription — returns confirmationUrl for redirect
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @CurrentShop() shop: Shop,
    @Body('plan') plan: string,
  ) {
    const validPlans = [PlanType.STARTER, PlanType.GROWTH, PlanType.PRO];
    if (!validPlans.includes(plan as PlanType)) {
      throw new BadRequestException(`Invalid plan: ${plan}. Must be one of: ${validPlans.join(', ')}`);
    }

    const result = await this.billingService.createSubscription(
      shop,
      plan as PlanType,
    );

    this.logger.log(`Subscription initiated for ${shop.shopDomain} → ${plan}`);

    return {
      success: true,
      data: {
        confirmationUrl: result.confirmationUrl,
        chargeId: result.chargeId,
        message: 'Redirect the merchant to confirmationUrl to approve billing',
      },
    };
  }

  // ─── GET /billing/callback ────────────────────────────────────────────────
  // Shopify redirects here after merchant approves/declines
  // Then we redirect to frontend with result
  @Get('callback')
  async billingCallback(
    @Query('shop') shopDomain: string,
    @Query('plan') plan: string,
    @Query('charge_id') chargeId: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('app.url');

    if (!shopDomain || !plan || !chargeId) {
      return res.redirect(`${frontendUrl}/upgrade?error=missing_params`);
    }

    try {
      const shop = await this.billingService.handleCallback(
        shopDomain,
        plan as PlanType,
        chargeId,
      );

      this.logger.log(`Billing callback success: ${shopDomain} → ${plan}`);

      // Redirect back to frontend upgrade page with success
      return res.redirect(
        `${frontendUrl}/upgrade?success=true&plan=${plan}`,
      );
    } catch (error: any) {
      this.logger.error(`Billing callback failed: ${shopDomain} — ${error.message}`);
      return res.redirect(
        `${frontendUrl}/upgrade?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  // ─── DELETE /billing/cancel ───────────────────────────────────────────────
  // Cancel current subscription — downgrades to free immediately
  @Delete('cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@CurrentShop() shop: Shop) {
    await this.billingService.cancelSubscription(shop);
    return {
      success: true,
      message: 'Subscription cancelled. Your plan has been downgraded to Free.',
      data: { plan: PlanType.FREE },
    };
  }

  // ─── GET /billing/status ──────────────────────────────────────────────────
  // Check live subscription status from Shopify
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentShop() shop: Shop) {
    if (!shop.shopifyChargeId) {
      return {
        success: true,
        data: {
          plan: shop.plan,
          subscriptionStatus: null,
          message: 'No active paid subscription',
        },
      };
    }

    const status = await this.billingService.getSubscriptionStatus(
      shop,
      shop.shopifyChargeId,
    );

    return {
      success: true,
      data: {
        plan: shop.plan,
        subscriptionStatus: status,
        chargeId: shop.shopifyChargeId,
        billingCycleStart: shop.billingCycleStart,
      },
    };
  }

  // ─── POST /billing/webhooks/subscription-update ───────────────────────────
  // Shopify notifies us when a subscription changes (cancelled, frozen, etc.)
  @Post('webhooks/subscription-update')
  @HttpCode(HttpStatus.OK)
  async handleSubscriptionWebhook(
    @Req() req: Request,
    @Body() body: any,
  ) {
    // Verify HMAC from Shopify
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
    const secret = this.configService.get<string>('shopify.apiSecret');
    const rawBody = JSON.stringify(body);

    const digest = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (digest !== hmacHeader) {
      throw new UnauthorizedException('Invalid webhook HMAC');
    }

    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    await this.billingService.handleSubscriptionWebhook(shopDomain, body);

    return { received: true };
  }
}
