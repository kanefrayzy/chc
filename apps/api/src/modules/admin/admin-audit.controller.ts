import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminAuditService } from './admin-audit.service';
import { toAdminAudit, type AdminAuditRowDto } from './admin.mapper';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminAuditController {
  constructor(private readonly service: AdminAuditService) {}

  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('cursor') cursor: string | undefined,
  ): Promise<{ items: AdminAuditRowDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.service.list({ limit, cursor });
    return { items: items.map(toAdminAudit), nextCursor };
  }
}
