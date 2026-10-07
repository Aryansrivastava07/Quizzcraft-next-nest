import { Connection } from 'mongoose';
import { GroupSchema } from '../schemas/group.schema';
import { GroupMessageSchema } from '../schemas/group-message.schema';
import { NotificationSchema } from '../schemas/notification.schema';
import { UserSchema } from '../schemas/user.schema';
import { QuizSchema } from '../schemas/quiz.schema';
import { AttemptsSchema } from '../schemas/attempts.schema';

export const GroupProviders = [
  {
    provide: 'GROUP_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Group', GroupSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'GROUP_MESSAGE_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('GroupMessage', GroupMessageSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'NOTIFICATION_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Notification', NotificationSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'USER_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('User', UserSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'QUIZ_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Quiz', QuizSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'ATTEMPTS_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('attempts', AttemptsSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
