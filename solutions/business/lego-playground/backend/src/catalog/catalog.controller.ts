import { Controller, Get } from '@nestjs/common';

@Controller('catalog')
export class CatalogController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
