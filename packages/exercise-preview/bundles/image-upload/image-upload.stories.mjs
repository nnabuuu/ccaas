/**
 * Demo bundle — `image-upload` exercise type.
 *
 * AnswerKey shape (ImageUploadAnswerKeySchema):
 *   { type:'image-upload', prompt, promptImages?, rubric:[{id,label,weight,criteria}],
 *     sampleSolution?, aiSystemPrompt?, maxImages?, accepts? }
 *
 * Student uploads photo(s); ans shape: `{ images: [url|base64, ...] }`.
 * Rubric is graded by LLM (in the real backend); the demo just renders.
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/image-upload
 */
import { defineStories } from '../../dist/index.js'

const imageUploadPlugin = {
  type: 'image-upload',
  displayName: 'Image Upload',
  grade(ctx) {
    const imgs = ctx.data.images ?? []
    return { total: imgs.length > 0 ? 80 : 0, byDimension: { hasImage: imgs.length > 0 } }
  },
}

const idealBeautyImageUpload = {
  type: 'image-upload',
  prompt: '画/写一段 80-120 字的英文短文,回答:"What does \'beauty\' mean in YOUR culture?" 上传手写照片。',
  rubric: [
    {
      id: 'content',
      label: 'Content depth',
      weight: 0.4,
      criteria: '是否给出≥1 个具体例子(实践/物件/场合),并解释其文化含义?',
    },
    {
      id: 'language',
      label: 'Language accuracy',
      weight: 0.3,
      criteria: '语法基本正确;能使用本文相关词汇(e.g. cosmetic, beauty standard, modify, conform)。',
    },
    {
      id: 'reflection',
      label: 'Personal reflection',
      weight: 0.3,
      criteria: '有第一人称视角和明确立场,而非只复述事实。',
    },
  ],
  maxImages: 2,
  sampleSolution: 'In my culture, beauty often means clear skin and a slim figure. My grandmother believes that long, straight hair is a sign of beauty, while my peers prefer dyed hair. I think these standards change with each generation, and that variety itself is beautiful.',
}

export default defineStories({
  plugin: imageUploadPlugin,
  meta: {
    title: 'Image Upload — Write about beauty in your culture',
    description: '手写 80-120 字短文并拍照上传;rubric 评估内容、语言、个人反思三个维度。',
    tags: ['demo', 'image-upload', 'writing'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyImageUpload,
}

/* ── Teacher classObserveData mock — matches ImageUploadData shape ────── */
const classObserveDataImg = {
  stats: { totalStudents: 22, submitted: 18, avgScore: 72, perfectCount: 4, pendingReview: 2 },
  rubricStats: [
    { id: 'content', label: 'Content depth', avgScore: 2.3, distribution: { 0: 1, 1: 3, 2: 6, 3: 8 } },
    { id: 'language', label: 'Language accuracy', avgScore: 2.1, distribution: { 0: 1, 1: 4, 2: 7, 3: 6 } },
    { id: 'reflection', label: 'Personal reflection', avgScore: 1.8, distribution: { 0: 2, 1: 6, 2: 6, 3: 4 } },
  ],
  scaffoldDistribution: { independent: 12, partial: 5, full: 1 },
  students: [
    {
      id: 's01', name: '王梓萱', score: 95, images: [],
      rubricResults: [
        { id: 'content', label: 'Content depth', score: 3, comment: '举例具体(奶奶 vs 同辈)' },
        { id: 'language', label: 'Language accuracy', score: 3, comment: '无显著语法错误' },
        { id: 'reflection', label: 'Personal reflection', score: 3, comment: '立场鲜明' },
      ],
      feedback: '完整、有个性的回答。',
      keyInsights: ['可作为优秀范例'],
      scaffoldTier: 'independent',
      method: 'handwrite',
    },
    {
      id: 's03', name: '王思源', score: 55, images: [],
      rubricResults: [
        { id: 'content', label: 'Content depth', score: 2, comment: '只有 1 个例子,缺乏展开' },
        { id: 'language', label: 'Language accuracy', score: 2, comment: '有时态错误' },
        { id: 'reflection', label: 'Personal reflection', score: 1, comment: '只复述事实' },
      ],
      feedback: '可以多加一句"我认为"。',
      keyInsights: ['Reflection 偏弱'],
      scaffoldTier: 'partial',
      method: 'photo',
    },
  ],
}

Default.classObserveData = classObserveDataImg
