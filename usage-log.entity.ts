import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Shop } from './shop.entity';

export enum UsageAction {
  REWRITE = 'rewrite',
  BULK_REWRITE = 'bulk_rewrite',
  EMAIL_GENERATE = 'email_generate',
  AD_COPY_GENERATE = 'ad_copy_generate',
  SEO_GENERATE = 'seo_generate',
}

@Table({
  tableName: 'usage_logs',
  timestamps: false,
})
export class UsageLog extends Model {
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
    type: DataType.ENUM(...Object.values(UsageAction)),
    allowNull: false,
  })
  action: UsageAction;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  creditsUsed: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  rewriteJobId: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  meta: Record<string, any>;

  @CreatedAt
  createdAt: Date;
}
