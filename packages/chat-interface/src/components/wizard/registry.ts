/**
 * Wizard Registry
 *
 * Solutions register wizard configs here; the AskUserQuestion renderer
 * checks the registry to decide between default question UI vs wizard.
 *
 * Matching strategy:
 * 1. Direct slug match (e.g. header === "备课向导")
 * 2. Trigger header match: any of the AskUserQuestion question headers
 *    appears in a wizard's triggerHeaders list
 */

import type { WizardConfig } from './types';

interface WizardEntry {
  config: WizardConfig;
  triggerHeaders: string[];
}

const wizardRegistry = new Map<string, WizardEntry>();

export interface RegisterWizardOptions {
  /** Additional question header values that trigger this wizard */
  triggerHeaders?: string[];
}

export function registerWizard(
  skillSlug: string,
  config: WizardConfig,
  options?: RegisterWizardOptions,
): void {
  wizardRegistry.set(skillSlug, {
    config,
    triggerHeaders: options?.triggerHeaders || [],
  });
}

export function getWizardConfig(skillSlug: string): WizardConfig | undefined {
  return wizardRegistry.get(skillSlug)?.config;
}

export function hasWizard(skillSlug: string): boolean {
  return wizardRegistry.has(skillSlug);
}

/**
 * Find a wizard config by checking if any of the given headers
 * match a registered wizard's triggerHeaders.
 */
export function findWizardByHeaders(headers: string[]): WizardConfig | undefined {
  for (const entry of wizardRegistry.values()) {
    if (entry.triggerHeaders.length === 0) continue;
    for (const h of headers) {
      if (h && entry.triggerHeaders.includes(h)) return entry.config;
    }
  }
  return undefined;
}
