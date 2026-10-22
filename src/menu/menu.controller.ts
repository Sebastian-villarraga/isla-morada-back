import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MenuItemDto } from './dto/menu-item.dto';
import { MenuService } from './menu.service';
type UserRequest = Request & { user: { userId: string } };
@ApiTags('menu') @Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}
  @Get() list() { return this.menu.listPublic(); }
  @Get('admin') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.RESERVAS) all() { return this.menu.listAll(); }
  @Post() @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.RESERVAS) create(@Body() dto: MenuItemDto, @Req() req: UserRequest) { return this.menu.create(dto, req.user.userId); }
  @Patch(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.RESERVAS) update(@Param('id') id: string, @Body() dto: Partial<MenuItemDto>, @Req() req: UserRequest) { return this.menu.update(id, dto, req.user.userId); }
  @Delete(':id') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.RESERVAS) remove(@Param('id') id: string, @Req() req: UserRequest) { return this.menu.remove(id, req.user.userId); }
}
