import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CopywriterService } from './copywriter.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { Shop } from '../../database/entities/shop.entity';
import {
  RewriteProductDto,
  BulkRewriteDto,
  GenerateEmailDto,
  GenerateAdCopyDto,
  ApplyRewriteDto,
} from './copywriter.dto';

@Controller('copywriter')
@UseGuards(JwtAuthGuard)
export class CopywriterController {
  private readonly logger = new Logger(CopywriterController.name);

  constructor(private readonly copywriterService: CopywriterService) {}

  // ─── POST /copywriter/rewrite ─────────────────────────────────────────────────
  // Single product description rewrite
  @Post('rewrite')
  @HttpCode(HttpStatus.OK)
  async rewriteProduct(
    @CurrentShop() shop: Shop,
    @Body() dto: RewriteProductDto,
  ) {
    this.logger.log(`Rewrite request from ${shop.shopDomain}`);
    const job = await this.copywriterService.rewriteProduct(shop, dto);
    return {
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        productTitle: job.productTitle,
        rewrittenContent: job.rewrittenContent,
        seoTitle: job.seoTitle,
        seoDescription: job.seoDescription,
        keywords: job.keywords,
        appliedToShopify: job.appliedToShopify,
        metadata: job.metadata,
      },
    };
  }

  // ─── POST /copywriter/rewrite/bulk ────────────────────────────────────────────
  // Bulk product rewrite (up to 50 products)
  @Post('rewrite/bulk')
  @HttpCode(HttpStatus.OK)
  async bulkRewrite(
    @CurrentShop() shop: Shop,
    @Body() dto: BulkRewriteDto,
  ) {
    this.logger.log(
      `Bulk rewrite request from ${shop.shopDomain} — ${dto.products.length} products`,
    );
    const result = await this.copywriterService.bulkRewrite(shop, dto);
    return {
      success: true,
      data: result,
      message: `${result.queued} products queued for rewrite`,
    };
  }

  // ─── POST /copywriter/email ───────────────────────────────────────────────────
  // Generate email copy (abandoned cart, welcome, etc.)
  @Post('email')
  @HttpCode(HttpStatus.OK)
  async generateEmail(
    @CurrentShop() shop: Shop,
    @Body() dto: GenerateEmailDto,
  ) {
    this.logger.log(
      `Email copy request from ${shop.shopDomain} — type: ${dto.emailType}`,
    );
    const result = await this.copywriterService.generateEmail(shop, dto);
    return { success: true, data: result };
  }

  // ─── POST /copywriter/ad-copy ─────────────────────────────────────────────────
  // Generate ad copy variants for Facebook, Instagram, Google, TikTok
  @Post('ad-copy')
  @HttpCode(HttpStatus.OK)
  async generateAdCopy(
    @CurrentShop() shop: Shop,
    @Body() dto: GenerateAdCopyDto,
  ) {
    this.logger.log(
      `Ad copy request from ${shop.shopDomain} — platform: ${dto.platform}`,
    );
    const result = await this.copywriterService.generateAdCopy(shop, dto);
    return { success: true, data: result };
  }

  // ─── POST /copywriter/apply ───────────────────────────────────────────────────
  // Push approved rewrite back to Shopify product
  @Post('apply')
  @HttpCode(HttpStatus.OK)
  async applyRewrite(
    @CurrentShop() shop: Shop,
    @Body() dto: ApplyRewriteDto,
  ) {
    this.logger.log(
      `Apply rewrite request from ${shop.shopDomain} — job: ${dto.jobId}`,
    );
    const job = await this.copywriterService.applyRewriteToShopify(
      shop,
      dto.jobId,
    );
    return {
      success: true,
      message: 'Product updated on Shopify successfully',
      data: { jobId: job.id, appliedAt: job.appliedAt },
    };
  }

  // ─── GET /copywriter/jobs ─────────────────────────────────────────────────────
  // Paginated job history
  @Get('jobs')
  async getJobHistory(
    @CurrentShop() shop: Shop,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.copywriterService.getJobHistory(
      shop,
      page,
      limit,
    );
    return { success: true, data: result };
  }

  // ─── GET /copywriter/jobs/:id ─────────────────────────────────────────────────
  // Single job detail
  @Get('jobs/:id')
  async getJob(
    @CurrentShop() shop: Shop,
    @Param('id', ParseIntPipe) jobId: number,
  ) {
    const { jobs } = await this.copywriterService.getJobHistory(shop, 1, 1);
    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      return { success: false, message: 'Job not found' };
    }
    return { success: true, data: job };
  }

  // ─── GET /copywriter/usage ────────────────────────────────────────────────────
  // Usage stats and plan info
  @Get('usage')
  async getUsageStats(@CurrentShop() shop: Shop) {
    const stats = await this.copywriterService.getUsageStats(shop);
    return { success: true, data: stats };
  }
}
