import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  Req,
  Session,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Step 1: App Install Entry Point ─────────────────────────────────────────
  // Shopify calls this when merchant clicks "Install"
  @Get('install')
  async install(
    @Query('shop') shop: string,
    @Session() session: Record<string, any>,
    @Res() res: Response,
  ) {
    if (!shop || !shop.includes('.myshopify.com')) {
      throw new BadRequestException('Invalid shop domain');
    }

    const state = this.authService.generateState();
    session.oauthState = state;

    const installUrl = this.authService.buildInstallUrl(shop, state);
    return res.redirect(installUrl);
  }

  // ─── Step 2: OAuth Callback ───────────────────────────────────────────────────
  // Shopify redirects here after merchant approves scopes
  @Get('callback')
  async callback(
    @Query() query: Record<string, string>,
    @Session() session: Record<string, any>,
    @Res() res: Response,
  ) {
    const { shop, code, state, hmac } = query;

    // Validate state to prevent CSRF
    if (!session.oauthState || session.oauthState !== state) {
      throw new UnauthorizedException('Invalid OAuth state — possible CSRF');
    }

    // Validate HMAC signature from Shopify
    if (!this.authService.verifyHmac(query)) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Exchange authorization code for permanent access token
    const accessToken = await this.authService.exchangeCodeForToken(
      shop,
      code,
    );

    // Save or update shop in DB
    const shopRecord = await this.authService.upsertShop(shop, accessToken);

    // Issue session JWT
    const jwt = this.authService.issueToken(shopRecord);

    // Clear OAuth state from session
    delete session.oauthState;

    this.logger.log(`OAuth complete for ${shop}`);

    // Redirect to frontend app with token
    const frontendUrl = this.configService.get('app.url');
    return res.redirect(
      `${frontendUrl}/dashboard?token=${jwt}&shop=${shop}`,
    );
  }

  // ─── Webhook: App Uninstalled ─────────────────────────────────────────────────
  // Shopify sends this when merchant uninstalls the app
  @Post('webhooks/uninstall')
  @HttpCode(HttpStatus.OK)
  async handleUninstall(
    @Req() req: Request,
    @Body() body: any,
  ) {
    // Verify webhook HMAC from Shopify headers
    const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
    const rawBody = JSON.stringify(body);
    const secret = this.configService.get<string>('shopify.apiSecret');

    const digest = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    if (digest !== hmacHeader) {
      throw new UnauthorizedException('Invalid webhook HMAC');
    }

    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    await this.authService.handleUninstall(shopDomain);

    return { received: true };
  }

  // ─── Verify JWT (used by frontend on load) ────────────────────────────────────
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@Body('token') token: string) {
    if (!token) throw new BadRequestException('Token required');
    const shop = await this.authService.validateToken(token);
    return {
      valid: true,
      shop: {
        id: shop.id,
        shopDomain: shop.shopDomain,
        shopName: shop.shopName,
        plan: shop.plan,
        monthlyRewrites: shop.monthlyRewrites,
        totalRewrites: shop.totalRewrites,
      },
    };
  }
}
