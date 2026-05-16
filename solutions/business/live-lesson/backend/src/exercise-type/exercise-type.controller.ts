import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExerciseTypeRegistryService } from './exercise-type-registry.service';

@ApiTags('exercise-types')
@Controller('exercise-types')
export class ExerciseTypeController {
  private readonly logger = new Logger(ExerciseTypeController.name);

  constructor(private readonly registry: ExerciseTypeRegistryService) {}

  @Get()
  getAll() {
    const defs = this.registry.getAllDefs();
    return {
      types: defs.map((d) => {
        try {
          return {
            type: d.type,
            label: d.label,
            iconUrl: d.iconUrl,
            badgeClass: d.badgeClass,
            defaultValue: JSON.parse(d.defaultValue),
            jsonSchema: JSON.parse(d.jsonSchema),
            refinements: JSON.parse(d.refinements),
            editorComponent: d.editorComponent,
            category: d.category,
            sortOrder: d.sortOrder,
          };
        } catch (e) {
          this.logger.error(`Failed to serialize type def "${d.type}": ${e}`);
          return null;
        }
      }).filter(Boolean),
    };
  }
}
