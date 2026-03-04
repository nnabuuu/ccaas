export interface LessonPlanFavorite {
  id: string;
  lessonPlanId: string;
  userId: string;
  createTime: string;
  // Joined fields from lesson_plans
  title?: string;
  subject?: string;
  gradeLevel?: number;
  status?: string;
}

export interface LessonPlanFavoriteRow {
  id: string;
  lesson_plan_id: string;
  user_id: string;
  create_time: string;
  // Joined fields
  title?: string;
  subject?: string;
  grade_level?: number;
  status?: string;
}

export interface AddFavoriteDto {
  lessonPlanId: string;
}
