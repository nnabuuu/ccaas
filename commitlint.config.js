module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug 修复
        'docs',     // 文档
        'style',    // 代码格式
        'refactor', // 重构
        'test',     // 测试
        'chore',    // 构建、工具
        'perf',     // 性能优化
        'revert',   // 回滚
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'backend',
        'frontend',
        'react-sdk',
        'vue-sdk',
        'admin',
        'docs',
        'common',
        'shared',
        'ci',
        'deps',
        'release',
      ],
    ],
    'scope-empty': [1, 'never'], // 警告但不强制要求 scope
    'subject-max-length': [2, 'always', 80],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
  },
};
