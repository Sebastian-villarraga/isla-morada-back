import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MenuItemDto } from './dto/menu-item.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}
  listPublic() { return this.prisma.menuItem.findMany({ where: { available: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }); }
  listAll() { return this.prisma.menuItem.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] }); }
  async create(dto: MenuItemDto, actorId: string) { const item = await this.prisma.menuItem.create({ data: dto }); await this.audit('CREATE_MENU_ITEM', item.id, actorId); return item; }
  async update(id: string, dto: Partial<MenuItemDto>, actorId: string) { await this.require(id); const item = await this.prisma.menuItem.update({ where: { id }, data: dto }); await this.audit('UPDATE_MENU_ITEM', id, actorId); return item; }
  async remove(id: string, actorId: string) { await this.require(id); await this.prisma.menuItem.delete({ where: { id } }); await this.audit('DELETE_MENU_ITEM', id, actorId); return { id }; }
  private async require(id: string) { const item = await this.prisma.menuItem.findUnique({ where: { id } }); if (!item) throw new NotFoundException({ code: 'MENU_ITEM_NOT_FOUND' }); return item; }
  private audit(action: string, entityId: string, userId: string) { return this.prisma.auditLog.create({ data: { userId, action, entity: 'MenuItem', entityId } }); }
}
