import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(@Query('prewarm') prewarm?: string) {
    return this.appService.getStatus(prewarm === 'true');
  }

  @Get('health')
  getHealth(@Query('prewarm') prewarm?: string) {
    return this.appService.getStatus(prewarm === 'true');
  }
}
