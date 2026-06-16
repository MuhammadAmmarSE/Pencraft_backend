import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { CopyType, ToneType } from '../../database/entities/rewrite-job.entity';

export class RewriteProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  productTitle: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  originalDescription?: string;

  @IsEnum(ToneType)
  @IsOptional()
  tone?: ToneType = ToneType.PROFESSIONAL;

  @IsEnum(CopyType)
  @IsOptional()
  copyType?: CopyType = CopyType.PRODUCT_DESCRIPTION;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(10)
  keywords?: string[];

  @IsBoolean()
  @IsOptional()
  includeSEO?: boolean = true;

  @IsBoolean()
  @IsOptional()
  includeEmoji?: boolean = false;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  targetAudience?: string;

  @IsString()
  @IsOptional()
  shopifyProductId?: string;

  @IsBoolean()
  @IsOptional()
  applyToShopify?: boolean = false;
}

export class BulkRewriteDto {
  @IsArray()
  @ArrayMaxSize(50)
  products: {
    shopifyProductId: string;
    productTitle: string;
    originalDescription?: string;
  }[];

  @IsEnum(ToneType)
  @IsOptional()
  tone?: ToneType = ToneType.PROFESSIONAL;

  @IsBoolean()
  @IsOptional()
  includeSEO?: boolean = true;

  @IsBoolean()
  @IsOptional()
  applyToShopify?: boolean = false;
}

export class GenerateEmailDto {
  @IsEnum(['abandoned_cart', 'welcome', 'win_back', 'promotional', 'post_purchase'])
  emailType: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  productName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  context?: string;

  @IsEnum(ToneType)
  @IsOptional()
  tone?: ToneType = ToneType.FRIENDLY;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;
}

export class GenerateAdCopyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  productTitle: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  productDescription?: string;

  @IsEnum(['facebook', 'instagram', 'google', 'tiktok'])
  platform: string;

  @IsEnum(ToneType)
  @IsOptional()
  tone?: ToneType = ToneType.URGENT;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(5)
  usps?: string[];
}

export class ApplyRewriteDto {
  @IsNumber()
  jobId: number;

  @IsBoolean()
  @IsOptional()
  updateSEO?: boolean = true;
}
