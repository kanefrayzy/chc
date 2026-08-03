import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { CodeShopService } from './code-shop.service';
import { BuyCodeDto } from './code-shop.dto';

export interface CodeProductDto {
  id: string;
  name: string;
  denominationMinor: string;
  priceMinor: string;
  description: string | null;
  stock: number;
}

export interface PurchasedCodeDto {
  id: string;
  code: string;
  productName: string;
  denominationMinor: string;
  priceMinor: string;
  soldAt: string | null;
}

@Controller('code-shop')
export class CodeShopController {
  constructor(private readonly shop: CodeShopService) {}

  /** Витрина доступна и гостям — чтобы цены было видно до регистрации. */
  @Get('products')
  async products(): Promise<{ items: CodeProductDto[] }> {
    const items = await this.shop.listProducts();
    return {
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        denominationMinor: minorToJson(p.denominationMinor),
        priceMinor: minorToJson(p.priceMinor),
        description: p.description,
        stock: p.stock,
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('buy')
  async buy(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: BuyCodeDto,
  ): Promise<{ code: PurchasedCodeDto; balanceMinor: string }> {
    const { item, product, balanceMinor } = await this.shop.buy({
      userId: user.sub,
      productId: body.productId,
    });
    return {
      code: {
        id: item.id,
        code: item.code,
        productName: product.name,
        denominationMinor: minorToJson(product.denominationMinor),
        priceMinor: minorToJson(item.priceMinor ?? product.priceMinor),
        soldAt: item.soldAt ? item.soldAt.toISOString() : null,
      },
      balanceMinor: minorToJson(balanceMinor),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async history(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: PurchasedCodeDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.shop.history({
      userId: user.sub,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    return {
      items: items.map((i) => ({
        id: i.id,
        code: i.code,
        productName: i.product.name,
        denominationMinor: minorToJson(i.product.denominationMinor),
        priceMinor: minorToJson(i.priceMinor ?? i.product.priceMinor),
        soldAt: i.soldAt ? i.soldAt.toISOString() : null,
      })),
      nextCursor,
    };
  }
}
