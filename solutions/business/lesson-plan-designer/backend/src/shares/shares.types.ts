export interface LessonPlanShare {
  id: string;
  lessonPlanId: string;
  sharedBy: string;
  sharedTo: string;
  permission: string;
  createTime: string;
  // Joined fields from lesson_plans
  title?: string;
  subject?: string;
  gradeLevel?: number;
  status?: string;
}

export interface LessonPlanShareRow {
  id: string;
  lesson_plan_id: string;
  shared_by: string;
  shared_to: string;
  permission: string;
  create_time: string;
  // Joined fields
  title?: string;
  subject?: string;
  grade_level?: number;
  status?: string;
}

export interface CreateShareDto {
  lessonPlanId: string;
  sharedTo: string;
  permission?: string;
}
