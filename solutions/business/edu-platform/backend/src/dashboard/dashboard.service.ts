import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplatePromotion } from '../entities/template-promotion.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TemplatePromotion)
    private readonly promotionRepo: Repository<TemplatePromotion>,
  ) {}

  // CCAAS-AI: mock — future: combine real grading tasks from homework module
  async getPending(user_id?: string, limit: number = 10) {
    // Mock pending items
    const mockItems = [
      {
        type: 'grading',
        title: '八(2)班 SAS 专项练习',
        count: 32,
        deadline: 'tomorrow',
        progress: '32/38',
        skill_status: 'analyzed',
        link: '/homework/hw_1/grade',
      },
      {
        type: 'grading',
        title: '八(3)班 全等复习作业',
        count: 35,
        deadline: '周三',
        progress: '35/40',
        skill_status: '',
        link: '/homework/hw_2/grade',
      },
    ];

    // Real promotion pending items
    const pendingPromotions = await this.promotionRepo.find({
      where: { status: 'pending' },
      relations: ['template'],
    });

    const promotionItems = pendingPromotions.map((p) => ({
      type: 'review',
      title: `${p.template?.name || '模板'}推优申请`,
      count: 1,
      deadline: '',
      progress: '',
      skill_status: '',
      link: '/templates/promotions',
    }));

    // If no real promotions, add mock one
    const reviewItems = promotionItems.length > 0
      ? promotionItems
      : [
          {
            type: 'review',
            title: '王老师推优申请',
            count: 1,
            deadline: '',
            progress: '',
            skill_status: '',
            link: '/templates/promotions',
          },
        ];

    const items = [...mockItems, ...reviewItems].slice(0, limit);
    return { items, total: items.length };
  }

  // CCAAS-AI: mock — future: call CCAAS Session API for recent Skill run results
  async getAiBriefing(user_id?: string) {
    return {
      insights: [
        {
          summary: '八(2)班 SAS 正确率连续 3 周下降（72%→64%→56%），建议安排专项辅导。',
          source_skill_run_id: 'sr_mock_1',
          suggested_actions: [
            {
              label: '分析夹角错因',
              prompt: '详细分析八(2)班 SAS 专项练习中夹角概念混淆的错因',
            },
            {
              label: '对齐课标 v2.1',
              prompt: '帮我检查 SSS/SAS 教案是否符合课标 v2.1 的新要求',
            },
          ],
        },
        {
          summary: '八(3)班全等三角形单元测试平均分 78，高于年级均分 72。',
          source_skill_run_id: 'sr_mock_2',
          suggested_actions: [
            {
              label: '查看班级详情',
              prompt: '展示八(3)班全等三角形各题正确率',
            },
          ],
        },
      ],
      common_actions: [
        { label: '新建教案', prompt: '帮我新建一份教案' },
        { label: '发布作业', prompt: '帮我发布一份作业' },
        { label: '查看学情', prompt: '帮我查看最近的学情分析' },
      ],
    };
  }
}
