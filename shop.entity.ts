import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  HasMany,
  Default,
} from 'sequelize-typescript';
import { UsageLog } from './usage-log.entity';
import { RewriteJob } from './rewrite-job.entity';

export enum PlanType {
  FREE = 'free',
  STARTER = 'starter',
  GROWTH = 'growth',
  PRO = 'pro',
}

export enum ShopStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  UNINSTALLED = 'uninstalled',
}

@Table({
  tableName: 'shops',
  timestamps: true,
})
export class Shop extends Model {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  shopDomain: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  accessToken: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  shopName: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  shopEmail: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: true,
  })
  currency: string;

  @Column({
    type: DataType.STRING(10),
    allowNull: true,
  })
  timezone: string;

  @Default(PlanType.FREE)
  @Column({
    type: DataType.ENUM(...Object.values(PlanType)),
    allowNull: false,
  })
  plan: PlanType;

  @Default(ShopStatus.ACTIVE)
  @Column({
    type: DataType.ENUM(...Object.values(ShopStatus)),
    allowNull: false,
  })
  status: ShopStatus;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  shopifyChargeId: string;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  totalRewrites: number;

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  monthlyRewrites: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
  })
  billingCycleStart: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  preferences: {
    defaultTone: string;
    defaultLanguage: string;
    includeSEO: boolean;
    includeEmoji: boolean;
  };

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => UsageLog)
  usageLogs: UsageLog[];

  @HasMany(() => RewriteJob)
  rewriteJobs: RewriteJob[];
}
