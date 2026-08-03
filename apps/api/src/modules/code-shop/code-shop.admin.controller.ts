import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CodeShopService } from './code-shop.service';
import { CreateCodeProductDto, UpdateCodeProductDto, AddCodesDto } from './code-shop.dto';

@Controller('admin/code-shop')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class CodeShopAdminController {
  constructor(private readonly shop: CodeShopService) {}

  @Get('products')
  async products() {
    const items = await this.shop.listProductsAdmin();
    return {
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        denominationMinor: minorToJson(p.denominationMinor),
        priceMinor: minorToJson(p.priceMinor),
        description: p.description,
        displayOrder: p.displayOrder,
        enabled: p.enabled,
        stock: p.stock,
        soldCount: p.soldCount,
      })),
    };
  }

  @Post('products')
  async create(@Body() body: CreateCodeProductDto) {
    const p = await this.shop.createProduct({
      name: body.name,
      denominationMinor: BigInt(body.denominationMinor),
      priceMinor: BigInt(body.priceMinor),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    });
    return { id: p.id };
  }

  @Patch('products/:id')
  async update(@Param('id') id: string, @Body() body: UpdateCodeProductDto) {
    await this.shop.updateProduct(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.denominationMinor !== undefined
        ? { denominationMinor: BigInt(body.denominationMinor) }
        : {}),
      ...(body.priceMinor !== undefined ? { priceMinor: BigInt(body.priceMinor) } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    });
    return { ok: true };
  }

  @Delete('products/:id')
  async remove(@Param('id') id: string) {
    await this.shop.deleteProduct(id);
    return { ok: true };
  }

  @Post('products/:id/codes')
  async addCodes(@Param('id') id: string, @Body() body: AddCodesDto) {
    return this.shop.addCodes(id, body.codes);
  }

  @Get('products/:id/codes')
  async items(
    @Param('id') id: string,
    @Query('status') status?: 'AVAILABLE' | 'SOLD' | 'DISABLED',
  ) {
    const rows = await this.shop.listItems(id, status);
    return {
      items: rows.map((i) => ({
        id: i.id,
        code: i.code,
        status: i.status,
        soldTo: i.soldTo?.username ?? null,
        soldAt: i.soldAt ? i.soldAt.toISOString() : null,
      })),
    };
  }

  @Delete('codes/:id')
  async removeItem(@Param('id') id: string) {
    await this.shop.deleteItem(id);
    return { ok: true };
  }

  @Get('sales')
  async sales(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    const { items, nextCursor } = await this.shop.listSales({
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
        username: i.soldTo?.username ?? null,
        soldAt: i.soldAt ? i.soldAt.toISOString() : null,
      })),
      nextCursor,
    };
  }
}
