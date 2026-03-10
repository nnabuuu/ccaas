import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentProxyService } from './agent-proxy.service';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import { KpMatchRequestDto } from './dto/kp-match-request.dto';

@Controller('api/v1/agent')
export class AgentController {
  constructor(private readonly agentProxy: AgentProxyService) {}

  /** POST /api/v1/agent/analyze — analyze-explain template */
  @Post('analyze')
  async analyze(
    @Body() dto: AnalyzeRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.agentProxy.streamToResponse('analyze-explain', dto, req, res);
  }

  /** POST /api/v1/agent/teach — teacher template */
  @Post('teach')
  async teach(
    @Body() dto: AnalyzeRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.agentProxy.streamToResponse('teacher', dto, req, res);
  }

  /** POST /api/v1/agent/student — student template */
  @Post('student')
  async student(
    @Body() dto: AnalyzeRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.agentProxy.streamToResponse('student', dto, req, res);
  }

  /** POST /api/v1/agent/kp-match — kp-refinement template */
  @Post('kp-match')
  async kpMatch(
    @Body() dto: KpMatchRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.agentProxy.streamToResponse('kp-refinement', dto, req, res);
  }
}
