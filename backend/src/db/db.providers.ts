import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';

export const Db = [
  {
    provide: 'DATABASE_CONNECTION',
    inject: [ConfigService],
    useFactory: async (configService: ConfigService): Promise<typeof mongoose> => {
      const MONGO_URI = configService.get<string>('MONGO_URI');
      if (!MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not defined');
      }

      // One-line DB query logger
      mongoose.set('debug', (collectionName: string, methodName: string, ...methodArgs: any[]) => {
        let argsStr = '';
        try {
          argsStr = JSON.stringify(methodArgs[0] ?? {});
          if (argsStr.length > 120) {
            argsStr = argsStr.slice(0, 117) + '...';
          }
        } catch {
          argsStr = '[object]';
        }
        console.log(`[DB] ${collectionName}.${methodName}(${argsStr})`);
      });

      console.log(`[DB] Connecting to MongoDB...`);
      const conn = await mongoose.connect(MONGO_URI);
      const host = conn.connection.host || 'cluster';
      console.log(`[DB] Connected to MongoDB successfully (${host})`);
      return conn;
    },
  },
];
