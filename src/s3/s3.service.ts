import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnBase: string;

  constructor() {
    this.s3 = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.bucket = process.env.AWS_S3_BUCKET!;
    this.cdnBase =
      process.env.CDN_BASE ||
      `https://${this.bucket}`;
  }

  async uploadBuffer(
    fileBuffer: Buffer,
    mimeType: string,
    keyPrefix: string,
    ext?: string,
    cacheControl = 'public, max-age=31536000, immutable'
  ): Promise<string> {
    const key = `${keyPrefix}/${uuid()}${ext ?? ''}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        CacheControl: cacheControl
      }),
    );

    return `${this.cdnBase}/${key}`;
  }
}
