import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Shop } from '../../database/entities/shop.entity';

export const CurrentShop = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Shop => {
    const request = ctx.switchToHttp().getRequest();
    return request.shop;
  },
);
