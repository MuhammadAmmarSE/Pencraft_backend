import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { Shop, ShopStatus } from '../../database/entities/shop.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(Shop)
    private readonly shopModel: typeof Shop,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  buildInstallUrl(shop: string, state: string): string {
    const apiKey = this.configService.get<string>('shopify.apiKey');
    const scopes = this.configService.get<string[]>('shopify.scopes').join(',');
    const redirectUri = `${this.configService.get('app.url')}/api/v1/auth/callback`;

    return (
      `https://${shop}/admin/oauth/authorize` +
      `?client_id=${apiKey}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`
    );
  }

  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  verifyHmac(query: Record<string, string>): boolean {
    const { hmac, ...rest } = query;
    const secret = this.configService.get<string>('shopify.apiSecret');

    const message = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join('&');

    const digest = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(hmac, 'hex'),
    );
  }

  async exchangeCodeForToken(shop: string, code: string): Promise<string> {
    const apiKey = this.configService.get<string>('shopify.apiKey');
    const apiSecret = this.configService.get<string>('shopify.apiSecret');

    const response = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  async fetchShopInfo(shop: string, accessToken: string): Promise<any> {
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch shop info');
    }

    const data = await response.json();
    return data.shop;
  }

  async upsertShop(shopDomain: string, accessToken: string): Promise<Shop> {
    const shopInfo = await this.fetchShopInfo(shopDomain, accessToken);

    const [shop] = await this.shopModel.upsert({
      shopDomain,
      accessToken,
      shopName: shopInfo.name,
      shopEmail: shopInfo.email,
      currency: shopInfo.currency,
      timezone: shopInfo.timezone,
      status: ShopStatus.ACTIVE,
    });

    this.logger.log(`Shop upserted: ${shopDomain}`);
    return shop;
  }

  issueToken(shop: Shop): string {
    return this.jwtService.sign({
      sub: shop.id,
      shopDomain: shop.shopDomain,
      plan: shop.plan,
    });
  }

  async validateToken(token: string): Promise<Shop> {
    try {
      const payload = this.jwtService.verify(token);
      const shop = await this.shopModel.findByPk(payload.sub);

      if (!shop || shop.status !== ShopStatus.ACTIVE) {
        throw new UnauthorizedException('Shop not found or inactive');
      }

      return shop;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async handleUninstall(shopDomain: string): Promise<void> {
    await this.shopModel.update(
      { status: ShopStatus.UNINSTALLED, accessToken: '' },
      { where: { shopDomain } },
    );
    this.logger.log(`Shop uninstalled: ${shopDomain}`);
  }
}
