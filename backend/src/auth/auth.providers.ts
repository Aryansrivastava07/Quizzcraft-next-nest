import { Connection } from 'mongoose';
import { UserSchema } from '../schemas/user.schema';
import { OrganizationSchema } from '../schemas/organization.schema';
import { GroupSchema } from '../schemas/group.schema';
import { GoogleOAuthStateSchema } from '../schemas/google-oauth-state.schema';

export const AuthProviders = [
  {
    provide: 'GOOGLE_OAUTH_STATE_MODEL',
    useFactory: (connection: Connection) => connection.model('GoogleOAuthState', GoogleOAuthStateSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'USER_MODEL',
    useFactory: (connection: Connection) => connection.model('User', UserSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'ORGANIZATION_MODEL',
    useFactory: (connection: Connection) => connection.model('Organization', OrganizationSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: 'GROUP_MODEL',
    useFactory: (connection: Connection) => connection.model('Group', GroupSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
