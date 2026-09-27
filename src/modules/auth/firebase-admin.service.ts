import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, AppOptions, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  private readonly app: App;
  readonly auth: Auth;

  constructor(config: ConfigService) {
    const projectId = config.getOrThrow<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const appOptions: AppOptions = { projectId };

    if (clientEmail && privateKey) {
      appOptions.credential = cert({ projectId, clientEmail, privateKey });
    }

    this.app =
      getApps()[0] ??
      initializeApp(appOptions);
    this.auth = getAuth(this.app);
  }
}
