import { IsBoolean } from 'class-validator';

export class UpdateOfficialDeveloperDto {
  @IsBoolean()
  isOfficialDeveloper!: boolean;
}
