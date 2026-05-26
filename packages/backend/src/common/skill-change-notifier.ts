/**
 * Skill Change Notifier
 *
 * Simple callback-based notification for skill changes.
 * Used to notify SessionsGateway when skills are updated so it can
 * mark sessions for restart and emit WebSocket events.
 */

export type SkillChangeCallback = (
  solutionId: string,
  skillId: string,
  skillSlug: string,
  action: 'created' | 'updated' | 'published' | 'unpublished' | 'archived',
) => void;

class SkillChangeNotifierClass {
  private listeners: SkillChangeCallback[] = [];

  /**
   * Register a callback to be notified of skill changes
   */
  addListener(callback: SkillChangeCallback): void {
    this.listeners.push(callback);
  }

  /**
   * Remove a previously registered callback
   */
  removeListener(callback: SkillChangeCallback): void {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of a skill change
   */
  notify(
    solutionId: string,
    skillId: string,
    skillSlug: string,
    action: 'created' | 'updated' | 'published' | 'unpublished' | 'archived',
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(solutionId, skillId, skillSlug, action);
      } catch (error) {
        console.error('Error in skill change listener:', error);
      }
    }
  }
}

// Singleton instance
export const SkillChangeNotifier = new SkillChangeNotifierClass();
