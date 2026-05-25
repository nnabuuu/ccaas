/**
 * Factory provider that selects local-vs-agentfs based on
 * `config.workspace.provider`. Wired into SessionsModule.
 */

import type { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LocalWorkspaceProvider } from './local-provider';
import { AgentfsWorkspaceProvider } from './agentfs-provider';
import { WORKSPACE_PROVIDER, type WorkspaceProvider } from './types';

export const WorkspaceProviderFactory: FactoryProvider<WorkspaceProvider> = {
  provide: WORKSPACE_PROVIDER,
  inject: [ConfigService, LocalWorkspaceProvider, AgentfsWorkspaceProvider],
  useFactory: (
    cfg: ConfigService,
    local: LocalWorkspaceProvider,
    agentfs: AgentfsWorkspaceProvider,
  ): WorkspaceProvider => {
    const choice = cfg.get<string>('workspace.provider', 'local');
    if (choice === 'local') return local;
    if (choice === 'agentfs') return agentfs;
    throw new Error(
      `unknown workspace.provider=${choice} (expected 'local' or 'agentfs')`,
    );
  },
};
