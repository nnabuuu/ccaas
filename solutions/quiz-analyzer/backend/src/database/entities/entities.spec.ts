import { Message } from './message.entity';
import { ConversationContext } from './conversation-context.entity';
import { Turn } from './turn.entity';

describe('Conversation Persistence Entities', () => {
  describe('Message entity', () => {
    it('should create a message instance with required fields', () => {
      const msg = new Message();
      msg.id = 'msg_test-uuid';
      msg.session_id = 'conv_123';
      msg.role = 'user';
      msg.content = 'Hello';
      msg.message_index = 0;
      msg.created_at = new Date().toISOString();

      expect(msg.id).toBe('msg_test-uuid');
      expect(msg.session_id).toBe('conv_123');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
      expect(msg.message_index).toBe(0);
    });

    it('should support optional fields', () => {
      const msg = new Message();
      msg.id = 'msg_test-uuid-2';
      msg.session_id = 'conv_123';
      msg.role = 'assistant';
      msg.content = 'Hi there';
      msg.message_index = 1;
      msg.parent_message_id = 'msg_test-uuid';
      msg.branch_id = 'branch_main';
      msg.is_continuation = 0;
      msg.metadata = JSON.stringify({ model: 'claude-3', inputTokens: 10, outputTokens: 20 });
      msg.tool_calls = JSON.stringify([{ id: 'tc_1', name: 'read_file', input: {}, status: 'completed' }]);
      msg.thinking_blocks = JSON.stringify([{ id: 'tb_1', content: 'Thinking...', summary: 'Analyzed' }]);
      msg.created_at = new Date().toISOString();

      expect(msg.parent_message_id).toBe('msg_test-uuid');
      expect(msg.branch_id).toBe('branch_main');
      expect(msg.is_continuation).toBe(0);
      expect(JSON.parse(msg.metadata)).toHaveProperty('model', 'claude-3');
      expect(JSON.parse(msg.tool_calls)).toHaveLength(1);
      expect(JSON.parse(msg.thinking_blocks)).toHaveLength(1);
    });
  });

  describe('ConversationContext entity', () => {
    it('should create a context instance with required fields', () => {
      const ctx = new ConversationContext();
      ctx.id = 'ctx_test-uuid';
      ctx.session_id = 'conv_123';
      ctx.created_at = new Date().toISOString();

      expect(ctx.id).toBe('ctx_test-uuid');
      expect(ctx.session_id).toBe('conv_123');
    });

    it('should support all optional metadata fields', () => {
      const ctx = new ConversationContext();
      ctx.id = 'ctx_test-uuid-2';
      ctx.session_id = 'conv_456';
      ctx.tenant_id = 'tenant_1';
      ctx.system_prompt_hash = 'sha256_abc123';
      ctx.skill_config_hashes = JSON.stringify([{ slug: 'quiz-analysis', hash: 'sha256_def456' }]);
      ctx.mcp_tools_list = JSON.stringify(['read_file', 'write_output']);
      ctx.model = 'claude-sonnet-4-5-20250514';
      ctx.workspace_dir = '/workspace/project';
      ctx.client_id = 'browser_abc';
      ctx.metadata = JSON.stringify({ custom: 'value' });
      ctx.created_at = new Date().toISOString();

      expect(ctx.tenant_id).toBe('tenant_1');
      expect(ctx.system_prompt_hash).toBe('sha256_abc123');
      expect(JSON.parse(ctx.skill_config_hashes)).toHaveLength(1);
      expect(JSON.parse(ctx.mcp_tools_list)).toContain('read_file');
      expect(ctx.model).toBe('claude-sonnet-4-5-20250514');
    });
  });

  describe('Turn entity', () => {
    it('should create a turn instance with required fields', () => {
      const turn = new Turn();
      turn.id = 'turn_test-uuid';
      turn.session_id = 'conv_123';
      turn.turn_number = 0;
      turn.user_message_id = 'msg_user_1';
      turn.total_tokens = 0;
      turn.duration_ms = 0;
      turn.created_at = new Date().toISOString();

      expect(turn.id).toBe('turn_test-uuid');
      expect(turn.session_id).toBe('conv_123');
      expect(turn.turn_number).toBe(0);
      expect(turn.user_message_id).toBe('msg_user_1');
    });

    it('should support completed turn with assistant response', () => {
      const turn = new Turn();
      turn.id = 'turn_test-uuid-2';
      turn.session_id = 'conv_123';
      turn.turn_number = 1;
      turn.user_message_id = 'msg_user_2';
      turn.assistant_message_id = 'msg_asst_2';
      turn.total_tokens = 150;
      turn.duration_ms = 3200;
      turn.created_at = new Date().toISOString();
      turn.completed_at = new Date().toISOString();

      expect(turn.assistant_message_id).toBe('msg_asst_2');
      expect(turn.total_tokens).toBe(150);
      expect(turn.duration_ms).toBe(3200);
      expect(turn.completed_at).toBeTruthy();
    });
  });
});
