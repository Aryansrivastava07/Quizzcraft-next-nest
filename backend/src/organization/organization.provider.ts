import { Connection } from 'mongoose';
import { OrganizationSchema } from '../schemas/organization.schema';
import { UserSchema } from '../schemas/user.schema';
import { QuizSchema } from '../schemas/quiz.schema';
import { GroupSchema } from '../schemas/group.schema';

export const OrganizationProviders = [
  {
    provide: 'ORGANIZATION_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Organization', OrganizationSchema),
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
    provide: 'GROUP_MODEL',
    useFactory: (connection: Connection) =>
      connection.model('Group', GroupSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
