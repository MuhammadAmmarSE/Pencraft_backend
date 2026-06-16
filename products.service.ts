import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Shop } from '../../database/entities/shop.entity';

export interface ShopifyProduct {
  id: string;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  handle: string;
  status: string;
  images: { src: string }[];
  variants: { price: string; sku: string }[];
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  // ─── Fetch paginated products from Shopify ────────────────────────────────────
  async getProducts(
    shop: Shop,
    page = 1,
    limit = 20,
  ): Promise<{ products: ShopifyProduct[]; hasNextPage: boolean }> {
    const sinceId = (page - 1) * limit;

    const url = new URL(
      `https://${shop.shopDomain}/admin/api/2024-01/products.json`,
    );
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', 'id,title,body_html,vendor,product_type,handle,status,images,variants');
    if (sinceId > 0) url.searchParams.set('since_id', String(sinceId));

    const response = await fetch(url.toString(), {
      headers: {
        'X-Shopify-Access-Token': shop.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      this.logger.error(`Shopify products fetch failed for ${shop.shopDomain}`);
      throw new InternalServerErrorException(
        'Failed to fetch products from Shopify',
      );
    }

    const data = await response.json();
    const linkHeader = response.headers.get('link') || '';
    const hasNextPage = linkHeader.includes('rel="next"');

    return { products: data.products, hasNextPage };
  }

  // ─── Fetch single product ─────────────────────────────────────────────────────
  async getProduct(shop: Shop, productId: string): Promise<ShopifyProduct> {
    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2024-01/products/${productId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shop.accessToken,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException('Product not found on Shopify');
    }

    const data = await response.json();
    return data.product;
  }

  // ─── Count total products ─────────────────────────────────────────────────────
  async getProductCount(shop: Shop): Promise<number> {
    const response = await fetch(
      `https://${shop.shopDomain}/admin/api/2024-01/products/count.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shop.accessToken,
        },
      },
    );

    if (!response.ok) return 0;
    const data = await response.json();
    return data.count;
  }
}
