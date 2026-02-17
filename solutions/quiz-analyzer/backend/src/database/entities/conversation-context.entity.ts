import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('conversation_contexts')
export class ConversationContext {
  @PrimaryColumn('varchar')
  id: string; // ctx_{uuid}

  @Index()
  @Column('varchar', { unique: true })
  session_id: string;

  @Column('varchar', { nullable: true })
  tenant_id: string;

  @Column('varchar', { nullable: true })
  system_prompt_hash: string;

  @Column('text', { nullable: true })
  skill_config_hashes: string; // JSON array of { slug, hash }

  @Column('text', { nullable: true })
  mcp_tools_list: string; // JSON array of string

  @Column('varchar', { nullable: true })
  model: string;

  @Column('text', { nullable: true })
  workspace_dir: string;

  @Column('varchar', { nullable: true })
  client_id: string;

  @Column('text', { nullable: true })
  metadata: string; // JSON object

  @CreateDateColumn({ type: 'text' })
  created_at: string;
}
