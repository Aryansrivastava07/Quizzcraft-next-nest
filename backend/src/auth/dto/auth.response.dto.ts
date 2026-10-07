export class RegisterAuthResponseDto {
      username!: string;
      email!: string;
      verified!: boolean;
      fullName?: string;
      institution?: string;
      phoneNumber?: string;
      role?: string;
      orgId?: string | null;
      orgSlug?: string | null;
      isSuperAdmin?: boolean;
      groupIds?: string[];
}

export class LoginAuthResponseDto {
      username!: string;
      email!: string;
      emails?: string[];
      verified!: boolean;
      profilePicture!: string;
      xp?: number;
      fullName?: string;
      institution?: string;
      phoneNumber?: string;
      role?: string;
      orgId?: string | null;
      orgSlug?: string | null;
      isSuperAdmin?: boolean;
      groupIds?: string[];
}

export class MeAuthResponseDto {
      username!: string;
      email!: string;
      emails?: string[];
      verified!: boolean;
      profilePicture!: string;
      xp?: number;
      fullName?: string;
      institution?: string;
      phoneNumber?: string;
      role?: string;
      orgId?: string | null;
      orgSlug?: string | null;
      isSuperAdmin?: boolean;
      groupIds?: string[];
}

