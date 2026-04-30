/** Immutable value object — derived from manifest, cached per lessonId */
export interface TaskMap {
  /** step idx -> task number, e.g. { 1:1, 3:2, 5:3, 7:4, 9:5 } */
  stepToTask: Record<number, number>;
  /** task number -> step idx, e.g. { 1:1, 2:3, 3:5, 4:7, 5:9 } */
  taskToStep: Record<number, number>;
  /** ordered step indices, e.g. [1, 3, 5, 7, 9] */
  taskSteps: number[];
  /** total number of tasks */
  maxTask: number;
}
