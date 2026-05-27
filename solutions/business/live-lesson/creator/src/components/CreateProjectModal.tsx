import ProjectFormModal, { type ProjectFormValues } from './ProjectFormModal'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: ProjectFormValues) => Promise<void>
}

export default function CreateProjectModal({ open, onClose, onSubmit }: Props) {
  return (
    <ProjectFormModal
      open={open}
      title="新建课程项目"
      submitLabel="创建"
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}
