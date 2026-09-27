import { Body, Controller, Post } from '@nestjs/common';
import { CloudinarySignatureDto } from './dto/cloudinary-signature.dto';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('cloudinary/signature')
  cloudinarySignature(@Body() dto: CloudinarySignatureDto) {
    return this.media.createCloudinarySignature(dto);
  }
}
