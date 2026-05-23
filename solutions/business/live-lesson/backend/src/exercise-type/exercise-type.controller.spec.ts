import { ExerciseTypeController } from './exercise-type.controller';
import { ExerciseTypeRegistryService } from './exercise-type-registry.service';
import { ExerciseTypeDef } from '../adapters/persistence/entities/exercise-type-def.entity';

function makeDef(type: string): ExerciseTypeDef {
  return {
    type,
    label: `${type} label`,
    iconUrl: `/icons/${type}.svg`,
    badgeClass: 'bg-blue-50',
    defaultValue: `{"type":"${type}"}`,
    jsonSchema: '{"type":"object"}',
    refinements: '[]',
    editorComponent: null,
    category: 'exercise',
    sortOrder: 0,
  };
}

const mockRegistry = {
  getAllDefs: jest.fn<ExerciseTypeDef[], []>(),
};

describe('ExerciseTypeController', () => {
  let controller: ExerciseTypeController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ExerciseTypeController(
      mockRegistry as unknown as ExerciseTypeRegistryService,
    );
  });

  it('returns parsed types from registry', () => {
    mockRegistry.getAllDefs.mockReturnValue([makeDef('quiz')]);
    const result = controller.getAll();
    expect(result.types).toHaveLength(1);
    expect(result.types[0]).toMatchObject({
      type: 'quiz',
      label: 'quiz label',
      defaultValue: { type: 'quiz' },
      jsonSchema: { type: 'object' },
      refinements: [],
    });
  });

  it('filters out entries with malformed JSON', () => {
    const bad: ExerciseTypeDef = {
      ...makeDef('bad'),
      defaultValue: 'not-json{{{',
    };
    mockRegistry.getAllDefs.mockReturnValue([makeDef('quiz'), bad]);
    const result = controller.getAll();
    expect(result.types).toHaveLength(1);
    expect(result.types[0].type).toBe('quiz');
  });

  it('returns empty types array when registry has no defs', () => {
    mockRegistry.getAllDefs.mockReturnValue([]);
    const result = controller.getAll();
    expect(result.types).toEqual([]);
  });
});
