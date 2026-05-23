import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

/**
 * Adds the `playground_drafts` table backing the admin Playground page
 * (§17 — exercise plugin preview design). Stores per-(user, bundle, story)
 * draft answerKey JSON so editing state survives across devices and short
 * codes can be issued from a stable backing store.
 */
export class CreatePlaygroundDrafts1764000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'playground_drafts',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: `lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))`,
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'bundleId',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'storyName',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'playground_drafts',
      new TableUnique({
        name: 'UQ_playground_drafts_user_bundle_story',
        columnNames: ['userId', 'bundleId', 'storyName'],
      }),
    );

    await queryRunner.createIndex(
      'playground_drafts',
      new TableIndex({
        name: 'IDX_playground_drafts_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'playground_drafts',
      new TableIndex({
        name: 'IDX_playground_drafts_bundle_id',
        columnNames: ['bundleId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('playground_drafts');
  }
}
