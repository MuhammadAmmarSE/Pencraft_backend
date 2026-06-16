import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
  Default,
} from 'sequelize-typescript';
import { Shop } from './shop.entity';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum CopyType {
  PRODUCT_DESCRIPTION = 'product_description',
  EMAIL_SUBJECT = 'email_subject',
  EMAIL_BODY = 'email_body',
  AD_COPY = 'ad_copy',
  SEO_TITLE = 'seo_title',
  SEO_DESCRIPTION = 'seo_description',
}

export enum ToneType {
  PROFESSIONAL = 'professional',
  FRIENDLY = 'friendly',
  LUXURY = 'luxury',
  URGENT = 'urgent',
  PLAYFUL = 'playful',
  MINIMALIST = 'minimalist',
}

@Table({
  tableName: 'rewrite_jobs',
  timestamps: true,
})
export class RewriteJob extends Model {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @ForeignKey(() => Shop)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  shopId: number;

  @BelongsTo(() => Shop)
  shop: Shop;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  shopifyProductId: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  productTitle: string;

  @Default(CopyType.PRODUCT_DESCRIPTION)
  @Column({
    type: DataType.ENUM(...Object.values(CopyType)),
    allowNull: false,
  })
  copyType: CopyType;

  @Default(ToneType.PROFESSIONAL)
  @Column({
    type: DataType.ENUM(...Object.values(ToneType)),
    allowNull: false,
  })
  tone: ToneType;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  originalContent: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  rewrittenContent: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  seoTitle: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  seoDescription: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  keywords: string[];

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  metadata: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    modelUsed: string;
    processingTimeMs: number;
  };

  @Default(JobStatus.PENDING)
  @Column({
    type: DataType.ENUM(...Object.values(JobStatus)),
    allowNull: false,
  })
  status: JobStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  errorMessage: string;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  appliedToShopify: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  appliedAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
