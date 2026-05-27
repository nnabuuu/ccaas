import ProjectFormModal, { type ProjectFormValues } from './ProjectFormModal'
import type { Project } from '../types'

interface Props {
  open: boolean
  project: Project | null
  onClose: () => void
  onSubmit: (data: ProjectFormValues) => Promise<void>
}

/**
 * Thin wrapper around `ProjectFormModal` that pre-populates from the
 * current project row. Reuses the same fields + validation as
 * `CreateProjectModal` so the create / edit experiences stay
 * symmetric.
 *
 * Renders nothing when `project` is null — the parent toggles `open`
 * and `project` together, but defending against null keeps the
 * downstream `initialValues` build a single safe branch.
 */
export default function EditProjectModal({
  open,
  project,
  onClose,
  onSubmit,
}: Props) {
  if (!project) return null
  return (
    <ProjectFormModal
      open={open}
      title="编辑项目"
      submitLabel="保存"
      initialValues={{
        title: project.title,
        description: project.description ?? '',
        subjects: project.subjects ?? [],
      }}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}
