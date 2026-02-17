import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSessionsTable1708185600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: `lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`,
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'tenantId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'clientId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'idle'",
            isNullable: false,
          },
          {
            name: 'messageCount',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'totalTokens',
            type: 'integer',
            default: 0,
            isNullable: false,
          },
          {
            name: 'estimatedCost',
            type: 'real',
            default: 0.0,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'lastActivity',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'closedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'workspaceDir',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create composite index for tenant filtering and time-based queries
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'idx_sessions_tenant_created',
        columnNames: ['tenantId', 'createdAt'],
      }),
    );

    // Create index for status filtering
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'idx_sessions_status',
        columnNames: ['status'],
      }),
    );

    // Create index for lastActivity queries (recently active sessions)
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'idx_sessions_last_activity',
        columnNames: ['lastActivity'],
      }),
    );

    // Create index for sessionId lookups
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'idx_sessions_session_id',
        columnNames: ['sessionId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions');
  }
}
