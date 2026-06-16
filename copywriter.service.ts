import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Shop, PlanType } from '../../database/entities/shop.entity';
import {
  RewriteJob,
  JobStatus,
  CopyType,
  ToneType,
} from '../../database/entities/rewrite-job.entity';
import { UsageLog, UsageAction } from '../../database/entities/usage-log.entity';
import { PromptBuilder } from './prompt.builder';
import {
  RewriteProductDto,
  BulkRewriteDto,
  GenerateEmailDto,
  GenerateAdCopyDto,
} from './copywriter.dto';

@Injectable()
export class CopywriterService {
  private readonly logger = new Logger(CopywriterService.name);

  private readonly PLAN_LIMITS: Record<PlanType, number> = {
    [PlanType.FREE]: 5,
    [PlanType.STARTER]: 100,
    [PlanType.GROWTH]: 500,
    [PlanType.PRO]: 99999,
  };

  constructor(
    @InjectModel(RewriteJob)
    private readonly rewriteJobModel: typeof RewriteJob,
    @InjectModel(UsageLog)
    private readonly usageLogModel: typeof UsageLog,
    @InjectModel(Shop)
    private readonly shopModel: typeof Shop,
    private readonly configService: ConfigService,
  ) {}

  // ─── Guard: Check plan limits before processing ───────────────────────────────
  private async checkUsageLimit(shop: Shop, creditsNeeded = 1): Promise<void> {
    const limit = this.PLAN_LIMITS[shop.plan];
    if (shop.monthlyRewrites + creditsNeeded > limit) {
      throw new ForbiddenException(
        `Monthly limit reached for your ${shop.plan} plan. ` +
          `Used ${shop.monthlyRewrites}/${limit}. Please upgrade to continue.`,
      );
    }
  }

  // ─── Core: Call Claude API ────────────────────────────────────────────────────
  private async callClaudeAPI(prompt: string): Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    modelUsed: string;
  }> {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    const model = this.configService.get<string>('anthropic.model');

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.logger.error('Claude API error', error);
      throw new InternalServerErrorException(
        'AI service temporarily unavailable. Please try again.',
      );
    }

    const data = await response.json();
    const processingTimeMs = Date.now() - startTime;

    this.logger.log(
      `Claude API call completed in ${processingTimeMs}ms — ` +
        `${data.usage.input_tokens + data.usage.output_tokens} tokens`,
    );

    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      modelUsed: model,
    };
  }

  // ─── Core: Parse JSON from AI response safely ─────────────────────────────────
  private parseAIResponse<T>(content: string): T {
    try {
      // Strip any accidental markdown code fences
      const clean = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(clean) as T;
    } catch {
      this.logger.error('Failed to parse AI response', content);
      throw new InternalServerErrorException(
        'Failed to parse AI response. Please try again.',
      );
    }
  }

  // ─── Core: Increment usage counters ──────────────────────────────────────────
  private async incrementUsage(
    shop: Shop,
    action: UsageAction,
    jobId?: number,
    creditsUsed = 1,
  ): Promise<void> {
    await Promise.all([
      this.shopModel.increment(
        { monthlyRewrites: creditsUsed, totalRewrites: creditsUsed },
        { where: { id: shop.id } },
      ),
      this.usageLogModel.create({
        shopId: shop.id,
        action,
        creditsUsed,
        rewriteJobId: jobId,
        meta: { timestamp: new Date().toISOString() },
      }),
    ]);
  }

  // ─── Feature 1: Single Product Description Rewrite ───────────────────────────
  async rewriteProduct(
    shop: Shop,
    dto: RewriteProductDto,
  ): Promise<RewriteJob> {
    await this.checkUsageLimit(shop);

    // Create job record (status: pending)
    const job = await this.rewriteJobModel.create({
      shopId: shop.id,
      shopifyProductId: dto.shopifyProductId,
      productTitle: dto.productTitle,
      copyType: dto.copyType || CopyType.PRODUCT_DESCRIPTION,
      tone: dto.tone || ToneType.PROFESSIONAL,
      originalContent: dto.originalDescription,
      status: JobStatus.PROCESSING,
      keywords: dto.keywords || [],
    });

    try {
      const prompt = PromptBuilder.buildProductDescriptionPrompt({
        productTitle: dto.productTitle,
        originalDescription: dto.originalDescription,
        tone: dto.tone || ToneType.PROFESSIONAL,
        keywords: dto.keywords,
        includeSEO: dto.includeSEO !== false,
        includeEmoji: dto.includeEmoji === true,
        targetAudience: dto.targetAudience,
      });

      const startTime = Date.now();
      const result = await this.callClaudeAPI(prompt);
      const processingTimeMs = Date.now() - startTime;

      const parsed = this.parseAIResponse<{
        description: string;
        seoTitle: string;
        seoDescription: string;
        keywordsUsed: string[];
      }>(result.content);

      // Update job to completed
      await job.update({
        rewrittenContent: parsed.description,
        seoTitle: parsed.seoTitle,
        seoDescription: parsed.seoDescription,
        keywords: parsed.keywordsUsed,
        status: JobStatus.COMPLETED,
        metadata: {
          ...result.usage,
          modelUsed: result.modelUsed,
          processingTimeMs,
        },
      });

      // Track usage
      await this.incrementUsage(shop, UsageAction.REWRITE, job.id);

      // Optionally push back to Shopify
      if (dto.applyToShopify && dto.shopifyProductId) {
        await this.applyRewriteToShopify(shop, job.id);
      }

      await job.reload();
      return job;
    } catch (error) {
      await job.update({
        status: JobStatus.FAILED,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  // ─── Feature 2: Bulk Product Rewrite ─────────────────────────────────────────
  async bulkRewrite(
    shop: Shop,
    dto: BulkRewriteDto,
  ): Promise<{ jobIds: number[]; queued: number }> {
    const count = dto.products.length;
    await this.checkUsageLimit(shop, count);

    if (count > 50) {
      throw new BadRequestException('Maximum 50 products per bulk rewrite');
    }

    // Process concurrently in batches of 5 to avoid rate limits
    const BATCH_SIZE = 5;
    const jobIds: number[] = [];

    for (let i = 0; i < dto.products.length; i += BATCH_SIZE) {
      const batch = dto.products.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map((product) =>
          this.rewriteProduct(shop, {
            productTitle: product.productTitle,
            originalDescription: product.originalDescription,
            shopifyProductId: product.shopifyProductId,
            tone: dto.tone,
            includeSEO: dto.includeSEO,
            applyToShopify: dto.applyToShopify,
          }),
        ),
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          jobIds.push(result.value.id);
        } else {
          this.logger.error('Bulk rewrite job failed', result.reason);
        }
      });

      // Small delay between batches — be a good API citizen
      if (i + BATCH_SIZE < dto.products.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return { jobIds, queued: count };
  }

  // ─── Feature 3: Email Sequence Generation ────────────────────────────────────
  async generateEmail(
    shop: Shop,
    dto: GenerateEmailDto,
  ): Promise<{
    emailType: string;
    subjectLine: string;
    previewText: string;
    body: string;
    ctaText: string;
  }> {
    await this.checkUsageLimit(shop);

    const prompt = PromptBuilder.buildEmailPrompt({
      emailType: dto.emailType,
      productName: dto.productName,
      context: dto.context,
      tone: dto.tone || ToneType.FRIENDLY,
      discountPercent: dto.discountPercent,
    });

    const result = await this.callClaudeAPI(prompt);
    const parsed = this.parseAIResponse<{
      subjectLine: string;
      previewText: string;
      body: string;
      ctaText: string;
    }>(result.content);

    await this.incrementUsage(shop, UsageAction.EMAIL_GENERATE);

    return { emailType: dto.emailType, ...parsed };
  }

  // ─── Feature 4: Ad Copy Generation ───────────────────────────────────────────
  async generateAdCopy(
    shop: Shop,
    dto: GenerateAdCopyDto,
  ): Promise<{
    platform: string;
    variants: Array<{
      angle: string;
      headline: string;
      primaryText: string;
      description: string;
      cta: string;
    }>;
  }> {
    await this.checkUsageLimit(shop);

    const prompt = PromptBuilder.buildAdCopyPrompt({
      productTitle: dto.productTitle,
      productDescription: dto.productDescription,
      platform: dto.platform,
      tone: dto.tone || ToneType.URGENT,
      usps: dto.usps,
    });

    const result = await this.callClaudeAPI(prompt);
    const parsed = this.parseAIResponse<{ variants: any[] }>(result.content);

    await this.incrementUsage(shop, UsageAction.AD_COPY_GENERATE);

    return { platform: dto.platform, variants: parsed.variants };
  }

  // ─── Feature 5: Apply Rewrite to Shopify ─────────────────────────────────────
  async applyRewriteToShopify(shop: Shop, jobId: number): Promise<RewriteJob> {
    const job = await this.rewriteJobModel.findOne({
      where: { id: jobId, shopId: shop.id },
    });

    if (!job) throw new BadRequestException('Rewrite job not found');
    if (job.status !== JobStatus.COMPLETED) {
      throw new BadRequestException('Job must be completed before applying');
    }
    if (!job.shopifyProductId) {
      throw new BadRequestException('No Shopify product ID linked to this job');
    }

    const updatePayload: any = {
      product: {
        id: job.shopifyProductId,
        body_html: job.rewrittenContent,
      },
    };

    if (job.seoTitle || job.seoDescription) {
      updatePayload.product.metafields_global_title_tag = job.seoTitle;
      updatePayload.product.metafields_global_description_tag = job.seoDescription;
    }

    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2024-01/products/${job.shopifyProductId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': shop.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      this.logger.error('Shopify product update failed', error);
      throw new InternalServerErrorException(
        'Failed to update product on Shopify. Please try again.',
      );
    }

    await job.update({
      appliedToShopify: true,
      appliedAt: new Date(),
    });

    this.logger.log(
      `Applied rewrite job ${jobId} to Shopify product ${job.shopifyProductId}`,
    );

    return job;
  }

  // ─── Get Job History ──────────────────────────────────────────────────────────
  async getJobHistory(
    shop: Shop,
    page = 1,
    limit = 20,
  ): Promise<{ jobs: RewriteJob[]; total: number; page: number; pages: number }> {
    const offset = (page - 1) * limit;

    const { count, rows } = await this.rewriteJobModel.findAndCountAll({
      where: { shopId: shop.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      jobs: rows,
      total: count,
      page,
      pages: Math.ceil(count / limit),
    };
  }

  // ─── Get Usage Stats ──────────────────────────────────────────────────────────
  async getUsageStats(shop: Shop): Promise<{
    plan: string;
    monthlyRewrites: number;
    totalRewrites: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  }> {
    const limit = this.PLAN_LIMITS[shop.plan];
    const remaining = Math.max(0, limit - shop.monthlyRewrites);

    return {
      plan: shop.plan,
      monthlyRewrites: shop.monthlyRewrites,
      totalRewrites: shop.totalRewrites,
      limit,
      remaining,
      percentUsed: Math.round((shop.monthlyRewrites / limit) * 100),
    };
  }
}
