-- 插入样本题目用于测试

-- 获取一个科目ID
INSERT INTO quizzes (id, tenant_id, content, subject_id, grade_level, quiz_type, difficulty, source, correct_answer, answer_options)
VALUES 
-- 题目1: 一元二次方程
('test-quiz-001', 'default', 
'解方程：x² - 5x + 6 = 0', 
(SELECT id FROM subjects WHERE name LIKE '%数学%' LIMIT 1),
'初中', '解答题', 3, '测试题库', 'x₁=2, x₂=3', '[]'),

-- 题目2: 勾股定理
('test-quiz-002', 'default',
'在直角三角形ABC中，∠C=90°，AC=3cm，BC=4cm，求斜边AB的长度。',
(SELECT id FROM subjects WHERE name LIKE '%数学%' LIMIT 1),
'初中', '解答题', 2, '测试题库', '5cm', '[]'),

-- 题目3: 英语语法
('test-quiz-003', 'default',
'选择正确的时态：She _____ to school every day. A) go B) goes C) going D) went',
(SELECT id FROM subjects WHERE name LIKE '%英语%' LIMIT 1),
'小学', '选择题', 1, '测试题库', 'B', '[{"label":"A","value":"go"},{"label":"B","value":"goes"},{"label":"C","value":"going"},{"label":"D","value":"went"}]'),

-- 题目4: 因式分解
('test-quiz-004', 'default',
'因式分解：x² - 4',
(SELECT id FROM subjects WHERE name LIKE '%数学%' LIMIT 1),
'初中', '填空题', 2, '测试题库', '(x+2)(x-2)', '[]'),

-- 题目5: 物理力学
('test-quiz-005', 'default',
'一个物体从静止开始自由落体运动，经过3秒后的速度是多少？(g=10m/s²)',
(SELECT id FROM subjects WHERE name LIKE '%物理%' LIMIT 1),
'初中', '计算题', 3, '测试题库', '30m/s', '[]');
