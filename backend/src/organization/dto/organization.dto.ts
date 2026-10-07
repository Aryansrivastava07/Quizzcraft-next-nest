import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and dashes (e.g. mit-physics)',
  })
  @MinLength(3)
  @MaxLength(40)
  slug!: string;

  @IsString()
  @IsOptional()
  allowedEmailDomain?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+$/, {
    message: 'Admin username must contain only lowercase letters and numbers',
  })
  adminUsername!: string;

  @IsString()
  @IsOptional()
  adminFullName?: string;

  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword!: string;
}

export class UpdateMemberRoleDto {
  @IsString()
  @IsNotEmpty()
  role!: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'ORG_PARTNER' | 'ORG_STD';
}
