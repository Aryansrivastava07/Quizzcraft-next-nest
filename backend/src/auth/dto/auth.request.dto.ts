import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsStrongPassword,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginAuthDto {
      @IsEmail()
      @IsNotEmpty()
      email!: string;

      @IsNotEmpty()
      password!: string;
}

export class RegisterAuthDto {
      @IsString()
      @IsNotEmpty()
      @Matches(/^[a-z0-9]+$/, {
        message: 'Username must contain only lowercase letters and numbers with no special characters',
      })
      @MinLength(3, { message: 'Username must be at least 3 characters long' })
      @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
      username!: string;

      @IsEmail()
      @IsNotEmpty()
      email!: string;

      @IsNotEmpty()
      @IsStrongPassword()
      password!: string;

      @IsString()
      @IsOptional()
      fullName?: string;

      @IsString()
      @IsOptional()
      institution?: string;

      @IsString()
      @IsOptional()
      phoneNumber?: string;

      @IsNumber()
      @IsOptional()
      mobileNo?: number;
}

export class LogoutAuthDto {
      @IsNotEmpty()
      userId!: string;

      @IsNotEmpty()
      refreshToken!: string
}

export class MeAuthDto {
      @IsNotEmpty()
      userId!: string;
}

export class RefreshAuthDto {
      @IsNotEmpty()
      refreshToken!: string
}

export class ResendOTP {
      @IsNotEmpty()
      @IsEmail()
      email!: string;
}

export class VerifyOTPAuthDto {
      @IsNotEmpty()
      @IsEmail()
      email!: string;

      @IsNotEmpty()
      OTP!: string;
}

export class SendPasswordResetMailAuthDto {
      @IsNotEmpty()
      @IsEmail()
      email!: string;
}

export class ResetPasswordAuthDto {
      @IsNotEmpty()
      @IsEmail()
      email!: string;

      @IsNotEmpty()
      @IsStrongPassword()
      password!: string;

      @IsOptional()
      @IsString()
      resetToken?: string;

      @IsOptional()
      @IsString()
      RESET_PASS_TOKEN?: string;
}