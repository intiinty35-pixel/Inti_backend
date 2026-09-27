import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinarySignatureDto } from './dto/cloudinary-signature.dto';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  createCloudinarySignature(dto: CloudinarySignatureDto) {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = dto.folder?.trim() || 'ariz/properties';
    const credentials = this.getCloudinaryCredentials();
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      credentials.apiSecret,
    );

    return {
      cloudName: credentials.cloudName,
      apiKey: credentials.apiKey,
      timestamp,
      folder,
      signature,
    };
  }

  private getCloudinaryCredentials() {
    const value = this.config.getOrThrow<string>('CLOUDINARY_URL');
    const url = new URL(value);
    return {
      apiKey: decodeURIComponent(url.username),
      apiSecret: decodeURIComponent(url.password),
      cloudName: url.hostname,
    };
  }
}
