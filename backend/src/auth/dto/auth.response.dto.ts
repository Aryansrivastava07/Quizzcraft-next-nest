export class RegisterAuthResponseDto {
      username!: string;
      email!: string;
      verified!: boolean;
}


export class LoginAuthResponseDto {
      username!: string;
      email!: string;
      emails?: string[];
      verified!: boolean;
      profilePicture!: string;
      xp?: number;
}

export class MeAuthResponseDto {
      username!: string;
      email!: string;
      emails?: string[];
      verified!: boolean;
      profilePicture!: string;
      xp?: number;
}

