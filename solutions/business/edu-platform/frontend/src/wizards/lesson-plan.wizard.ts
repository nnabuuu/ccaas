/**
 * Lesson Plan Generator Wizard Configuration
 *
 * 4-step wizard for collecting lesson plan parameters:
 * 1. 选择范围 (scope) — subject, grade, class, lesson type, duration
 * 2. 选择章节 (chapters) — tree selection from textbook
 * 3. 学情分析 (gaps) — class analysis with emphasis toggles
 * 4. 确认生成 (confirm) — summary of all selections
 */

import { registerWizard } from '@kedge-agentic/chat-interface';

registerWizard('备课向导', {
  id: 'lesson-plan',
  title: '备课向导',
  steps: [
    {
      id: 'scope',
      title: '选择范围',
      type: 'form',
      fields: [
        {
          key: 'subject',
          label: '学科',
          type: 'select',
          options: [
            { label: '数学', value: '数学' },
            { label: '语文', value: '语文' },
            { label: '英语', value: '英语' },
            { label: '物理', value: '物理' },
            { label: '化学', value: '化学' },
            { label: '生物', value: '生物' },
            { label: '历史', value: '历史' },
            { label: '地理', value: '地理' },
          ],
          contextKey: 'subject',
        },
        {
          key: 'grade',
          label: '年级学期',
          type: 'select',
          options: [
            { label: '七年级上', value: '七年级上' },
            { label: '七年级下', value: '七年级下' },
            { label: '八年级上', value: '八年级上' },
            { label: '八年级下', value: '八年级下' },
            { label: '九年级上', value: '九年级上' },
            { label: '九年级下', value: '九年级下' },
            { label: '高一上', value: '高一上' },
            { label: '高一下', value: '高一下' },
            { label: '高二上', value: '高二上' },
            { label: '高二下', value: '高二下' },
          ],
          contextKey: 'grade',
        },
        {
          key: 'class_id',
          label: '班级',
          type: 'select',
          options: [
            { label: '1 班', value: '1班' },
            { label: '2 班', value: '2班' },
            { label: '3 班', value: '3班' },
            { label: '4 班', value: '4班' },
          ],
          contextKey: 'classId',
        },
        {
          key: 'lessonType',
          label: '课型',
          type: 'select',
          options: [
            { label: '新授课', value: '新授课' },
            { label: '复习课', value: '复习课' },
            { label: '练习课', value: '练习课' },
            { label: '试卷讲评', value: '试卷讲评' },
          ],
        },
        {
          key: 'duration',
          label: '课时',
          type: 'select',
          options: [
            { label: '1 课时 (40 分钟)', value: '1课时' },
            { label: '2 课时 (80 分钟)', value: '2课时' },
            { label: '3 课时 (120 分钟)', value: '3课时' },
          ],
        },
      ],
    },
    {
      id: 'chapters',
      title: '选择章节',
      type: 'tree-select',
      dependsOn: ['scope'],
    },
    {
      id: 'gaps',
      title: '学情分析',
      type: 'data-review',
      dependsOn: ['scope', 'chapters'],
    },
    {
      id: 'confirm',
      title: '确认生成',
      type: 'summary',
      dependsOn: ['scope', 'chapters', 'gaps'],
    },
  ],
}, {
  triggerHeaders: ['学科', '备课', '备课参数', '科目'],
});
