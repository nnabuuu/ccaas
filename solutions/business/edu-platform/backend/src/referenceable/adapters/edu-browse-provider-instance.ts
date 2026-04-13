import { EduBrowseProvider } from './edu-browse-provider';

/**
 * Singleton instance shared between AppModule (for ContextLayerModule.forRoot)
 * and ReferenceableModule (for late service binding via setServices).
 */
export const eduBrowseProvider = new EduBrowseProvider();
