import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, WaitlistStatus } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { UpdateWaitlistDto } from './dto/update-waitlist.dto';
import { WaitlistService } from './waitlist.service';

type UserRequest = Request & { user: { userId: string } };

@ApiTags('waitlist')
@ApiBearerAuth()
@Controller('waitlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.RESERVAS, UserRole.HOST)
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Get()
  list(@Query('date') date?: string, @Query('status') status?: WaitlistStatus, @Query('name') name?: string, @Query('phone') phone?: string, @Query('pax') pax?: string) {
    return this.waitlist.list({ date, status, name, phone, ...(pax ? { pax: Number(pax) } : {}) });
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.waitlist.get(id); }

  @Post()
  create(@Body() dto: CreateWaitlistDto, @Req() request: UserRequest) {
    return this.waitlist.create(dto, request.user.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWaitlistDto, @Req() request: UserRequest) {
    return this.waitlist.update(id, dto, request.user.userId);
  }

  @Post(':id/notify')
  notify(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.waitlist.notify(id, request.user.userId);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() request: UserRequest) {
    return this.waitlist.cancel(id, request.user.userId);
  }
}