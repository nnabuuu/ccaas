/**
 * Demo bundle — `stance` exercise type.
 *
 * AnswerKey shape (StanceAnswerKeySchema):
 *   { type:'stance', validPositions:[string,...], minEvidence:int,
 *     stanceQ?, stanceQZh?, stanceOpts:[string,...], evidence:[string,...] }
 *
 * The stance plugin reads `stanceQ/stanceQZh/stanceOpts/evidence` and grades
 * by accepting any submission (handleCheckResult always returns allDone:true).
 *
 *   $ npx exercise-preview packages/exercise-preview/bundles/stance
 */
import { defineStories } from '../../dist/index.js'

const stancePlugin = {
  type: 'stance',
  displayName: 'Stance',
  grade(ctx) {
    const ans = ctx.data ?? {}
    const valid = (ctx.key.validPositions ?? []).includes(ans.position)
    const enough = (ans.evidence ?? []).length >= (ctx.key.minEvidence ?? 1)
    const ok = valid && enough
    return { total: ok ? 100 : 50, byDimension: { position: valid, evidence: enough } }
  },
}

const idealBeautyStance = {
  type: 'stance',
  stanceQ: 'Should cultural beauty practices be respected, or challenged when they harm health?',
  stanceQZh: '当文化"美"实践损害健康时,我们应该尊重它,还是挑战它?',
  stanceOpts: [
    'Respect — culture takes precedence',
    'Challenge — health takes precedence',
    'Depends on context (consent, severity, age)',
  ],
  validPositions: [
    'Respect — culture takes precedence',
    'Challenge — health takes precedence',
    'Depends on context (consent, severity, age)',
  ],
  minEvidence: 2,
  evidence: [
    '¶1: Happiness Edem 在 fattening room 增重六个月。',
    '¶2: 体重过快增长可能带来糖尿病、高血压等健康风险。',
    '¶3: 印度市场上的美白产品含汞,有皮肤危害。',
    '¶4: 缠足从小女孩开始,缺乏知情同意。',
    '¶5: 韩国整形手术多为成年人自愿选择。',
    '¶6: 文化习俗承载社群认同,不能简单否定。',
  ],
}

export default defineStories({
  plugin: stancePlugin,
  meta: {
    title: 'Stance — Culture vs health',
    description: '在"尊重文化"和"健康优先"之间表态,并从课文中选择 2 条以上证据。',
    tags: ['demo', 'stance', 'argument'],
  },
})

export const Default = {
  name: 'Default — empty',
  locale: 'zh',
  answerKey: idealBeautyStance,
}

export const PreFilled = {
  name: 'Pre-filled (depends-on-context)',
  locale: 'zh',
  answerKey: idealBeautyStance,
  initialAns: {
    stance: 'Depends on context (consent, severity, age)',
    evidence: [
      '¶4: 缠足从小女孩开始,缺乏知情同意。',
      '¶5: 韩国整形手术多为成年人自愿选择。',
    ],
  },
}
