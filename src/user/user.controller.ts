import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { RequestWithAuth } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('users')
  async getUsers() {
    return await this.userService.getUsers();
  }

  @Get('user')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getUser(@Req() request: RequestWithAuth) {
    return await this.userService.getUser(request.address);
  }

  @Get('user/charities')
  @ApiBearerAuth()
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  @UseGuards(JwtAuthGuard)
  async getUserCharities(
    @Req() request: RequestWithAuth,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 8;
    const skip = offset ? parseInt(offset, 10) : 0;
    return await this.userService.getUserCharities(request.address, take, skip);
  }

  @Get('user/inventory')
  @ApiBearerAuth()
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  @UseGuards(JwtAuthGuard)
  async getInventory(
    @Req() request: RequestWithAuth,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 8;
    const skip = offset ? parseInt(offset, 10) : 0;
    return await this.userService.getInventory(request.address, take, skip);
  }

  @Get('user/donatations')
  @ApiBearerAuth()
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  @UseGuards(JwtAuthGuard)
  async getDonatations(
    @Req() request: RequestWithAuth,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = limit ? parseInt(limit, 10) : 8;
    const skip = offset ? parseInt(offset, 10) : 0;
    return await this.userService.getDonatations(request.address, take, skip);
  }
}
