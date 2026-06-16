import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { Shop } from '../../database/entities/shop.entity';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── GET /products ────────────────────────────────────────────────────────────
  @Get()
  async getProducts(
    @CurrentShop() shop: Shop,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.productsService.getProducts(shop, page, limit);
    const count = await this.productsService.getProductCount(shop);
    return {
      success: true,
      data: {
        products: result.products,
        total: count,
        hasNextPage: result.hasNextPage,
        page,
      },
    };
  }

  // ─── GET /products/:id ────────────────────────────────────────────────────────
  @Get(':id')
  async getProduct(
    @CurrentShop() shop: Shop,
    @Param('id') productId: string,
  ) {
    const product = await this.productsService.getProduct(shop, productId);
    return { success: true, data: product };
  }
}
