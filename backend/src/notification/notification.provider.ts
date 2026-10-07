import { Connection } from 'mongoose';
import { NotificationSchema } from '../schemas/notification.schema';

export const NotificationProviders = [
  {
    provide: 'NOTIFICATION_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Notification', NotificationSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
