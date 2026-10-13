import { IsString, IsUrl, MaxLength } from 'class-validator';

export class ResolveMapsLinkDto {
  @IsString()
  @MaxLength(500)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;
}
