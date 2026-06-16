import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Shop, PlanType } from '../../database/entities/shop.entity';

export interface PlanConfig {
  name: string;
  planType: PlanType;
  price: number;
  trialDays: number;
  interval: 'EVERY_30_DAYS' | 'ANNUAL';
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  [PlanType.FREE]: {
    name: 'Free',
    planType: PlanType.FREE,
    price: 0,
    trialDays: 0,
    interval: 'EVERY_30_DAYS',
    features: ['5 rewrites/month', 'Product descriptions', 'SEO title + meta'],
  },
  [PlanType.STARTER]: {
    name: 'Starter',
    planType: PlanType.STARTER,
    price: 19.0,
    trialDays: 7,
    interval: 'EVERY_30_DAYS',
    features: [
      '100 rewrites/month',
      'Product descriptions',
      'Email copy (5 types)',
      'Ad copy (4 platforms)',
      'Bulk rewrite (50 products)',
      'SEO title + meta',
    ],
  },
  [PlanType.GROWTH]: {
    name: 'Growth',
    planType: PlanType.GROWTH,
    price: 49.0,
    trialDays: 7,
    interval: 'EVERY_30_DAYS',
    features: [
      '500 rewrites/month',
      'Everything in Starter',
      'Auto-apply to Shopify',
      'Tone customization',
      'Usage analytics',
    ],
  },
  [PlanType.PRO]: {
    name: 'Pro',
    planType: PlanType.PRO,
    price: 99.0,
    trialDays: 7,
    interval: 'EVERY_30_DAYS',
    features: [
      'Unlimited rewrites',
      'Everything in Growth',
      'API access',
      'Custom tone profiles',
      'Dedicated onboarding',
      'Slack support',
    ],
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(Shop)
    private readonly shopModel: typeof Shop,
    private readonly configService: ConfigService,
  ) {}

  async createSubscription(
    shop: Shop,
    planType: PlanType,
  ): Promise<{ confirmationUrl: string; chargeId: string }> {
    if (planType === PlanType.FREE) {
      throw new BadRequestException('Cannot create a charge for the free plan');
    }

    const plan = PLAN_CONFIGS[planType];
    const appUrl = this.configService.get<string>('app.url');
    const returnUrl = `${appUrl}/api/v1/billing/callback?shop=${shop.shopDomain}&plan=${planType}`;

    const mutation = `
      mutation appSubscriptionCreate(
        $name: String!,
        $lineItems: [AppSubscriptionLineItemInput!]!,
        $returnUrl: URL!,
        $trialDays: Int,
        $test: Boolean
      ) {
        appSubscriptionCreate(
          name: $name,
          lineItems: $lineItems,
          returnUrl: $returnUrl,
          trialDays: $trialDays,
          test: $test
        ) {
          appSubscription { id }
          confirmationUrl
          userErrors { field message }
        }
      }
    `;

    const variables = {
      name: `CopyAI ${plan.name} Plan`,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.price, currencyCode: 'USD' },
              interval: plan.interval,
            },
          },
        },
      ],
      returnUrl,
      trialDays: plan.trialDays,
      test: this.configService.get<string>('app.nodeEnv') !== 'production',
    };

    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shop.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation, variables }),
      },
    );

    if (!response.ok) {
      this.logger.error(`Shopify GraphQL request failed for ${shop.shopDomain}`);
      throw new InternalServerErrorException('Failed to create subscription with Shopify');
    }

    const data = await response.json();
    const result = data?.data?.appSubscriptionCreate;

    if (result?.userErrors?.length > 0) {
      const errors = result.userErrors.map((e: any) => e.message).join(', ');
      this.logger.error(`Shopify billing errors: ${errors}`);
      throw new BadRequestException(`Shopify billing error: ${errors}`);
    }

    const chargeId = result?.appSubscription?.id;
    const confirmationUrl = result?.confirmationUrl;

    if (!confirmationUrl || !chargeId) {
      throw new InternalServerErrorException('Shopify did not return a confirmation URL');
    }

    await shop.update({ shopifyChargeId: chargeId });

    this.logger.log(
      `Subscription created for ${shop.shopDomain} → plan: ${planType}, chargeId: ${chargeId}`,
    );

    return { confirmationUrl, chargeId };
  }

  async handleCallback(
    shopDomain: string,
    planType: PlanType,
    chargeId: string,
  ): Promise<Shop> {
    const shop = await this.shopModel.findOne({ where: { shopDomain } });
    if (!shop) throw new NotFoundException('Shop not found');

    const status = await this.getSubscriptionStatus(shop, chargeId);

    if (status !== 'ACTIVE' && status !== 'PENDING') {
      throw new BadRequestException(
        `Subscription is not active. Status: ${status}. Merchant may have declined.`,
      );
    }

    await shop.update({
      plan: planType,
      shopifyChargeId: chargeId,
      monthlyRewrites: 0,
      billingCycleStart: new Date().toISOString().split('T')[0],
    });

    this.logger.log(`Plan activated: ${shopDomain} → ${planType}`);
    return shop;
  }

  async getSubscriptionStatus(shop: Shop, chargeId: string): Promise<string> {
    const query = `
      query getSubscription($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            status
            currentPeriodEnd
            trialDays
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price { amount currencyCode }
                    interval
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shop.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { id: chargeId } }),
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to verify subscription status');
    }

    const data = await response.json();
    return data?.data?.node?.status ?? 'UNKNOWN';
  }

  async cancelSubscription(shop: Shop): Promise<void> {
    if (!shop.shopifyChargeId) {
      throw new BadRequestException('No active subscription to cancel');
    }

    const mutation = `
      mutation appSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription { id status }
          userErrors { field message }
        }
      }
    `;

    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': shop.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: mutation,
          variables: { id: shop.shopifyChargeId },
        }),
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to cancel subscription');
    }

    const data = await response.json();
    const errors = data?.data?.appSubscriptionCancel?.userErrors;

    if (errors?.length > 0) {
      throw new BadRequestException(errors.map((e: any) => e.message).join(', '));
    }

    await shop.update({ plan: PlanType.FREE, shopifyChargeId: null, monthlyRewrites: 0 });

    this.logger.log(`Subscription cancelled: ${shop.shopDomain} → downgraded to free`);
  }

  async handleSubscriptionWebhook(shopDomain: string, payload: any): Promise<void> {
    const shop = await this.shopModel.findOne({ where: { shopDomain } });
    if (!shop) return;

    const { status } = payload;

    this.logger.log(`Billing webhook for ${shopDomain}: status=${status}`);

    if (['CANCELLED', 'EXPIRED', 'DECLINED', 'FROZEN'].includes(status)) {
      await shop.update({ plan: PlanType.FREE, shopifyChargeId: null });
      this.logger.warn(`${shopDomain} downgraded to free — subscription ${status}`);
    }
  }

  async resetMonthlyUsage(shopDomain: string): Promise<void> {
    await this.shopModel.update(
      {
        monthlyRewrites: 0,
        billingCycleStart: new Date().toISOString().split('T')[0],
      },
      { where: { shopDomain } },
    );
    this.logger.log(`Monthly usage reset for ${shopDomain}`);
  }

  async getPlanInfo(shop: Shop): Promise<{
    currentPlan: PlanConfig;
    availablePlans: PlanConfig[];
    subscriptionStatus: string | null;
  }> {
    const currentPlan = PLAN_CONFIGS[shop.plan];
    const availablePlans = Object.values(PLAN_CONFIGS).filter(
      (p) => p.planType !== PlanType.FREE,
    );

    let subscriptionStatus: string | null = null;
    if (shop.shopifyChargeId) {
      try {
        subscriptionStatus = await this.getSubscriptionStatus(shop, shop.shopifyChargeId);
      } catch {
        subscriptionStatus = 'UNKNOWN';
      }
    }

    return { currentPlan, availablePlans, subscriptionStatus };
  }
}
