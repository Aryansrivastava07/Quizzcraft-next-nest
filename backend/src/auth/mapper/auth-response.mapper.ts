import { User } from "../../schemas/user.schema";
import { LoginAuthResponseDto, RegisterAuthResponseDto, MeAuthResponseDto } from "../dto/auth.response.dto";

export const toLoginDto = (user: User): LoginAuthResponseDto => ({
    username: user.username,
    email: user.email,
    emails: user.emails && user.emails.length > 0 ? user.emails : [user.email],
    verified: user.verified,
    profilePicture: user.profilePicture,
    xp: user.xp || 0,
    fullName: user.fullName || '',
    institution: user.institution || '',
    phoneNumber: user.phoneNumber || (user.mobileNo ? String(user.mobileNo) : ''),
    role: user.role || 'PUBLIC_USER',
    orgId: user.orgId || null,
    orgSlug: user.orgSlug || null,
    isSuperAdmin: user.role === 'SUPER_ADMIN' || Boolean((user as any).isSuperAdmin),
    groupIds: user.groupIds || [],
});

export const toRegisterDto = (user: User): RegisterAuthResponseDto => ({
    username: user.username,
    email: user.email,
    verified: user.verified,
    fullName: user.fullName || '',
    institution: user.institution || '',
    phoneNumber: user.phoneNumber || (user.mobileNo ? String(user.mobileNo) : ''),
    role: user.role || 'PUBLIC_USER',
    orgId: user.orgId || null,
    orgSlug: user.orgSlug || null,
    isSuperAdmin: user.role === 'SUPER_ADMIN' || Boolean((user as any).isSuperAdmin),
    groupIds: user.groupIds || [],
});

export const toMeDto = (user: User): MeAuthResponseDto => ({
    username: user.username,
    email: user.email,
    emails: user.emails && user.emails.length > 0 ? user.emails : [user.email],
    verified: user.verified,
    profilePicture: user.profilePicture,
    xp: user.xp || 0,
    fullName: user.fullName || '',
    institution: user.institution || '',
    phoneNumber: user.phoneNumber || (user.mobileNo ? String(user.mobileNo) : ''),
    role: user.role || 'PUBLIC_USER',
    orgId: user.orgId || null,
    orgSlug: user.orgSlug || null,
    isSuperAdmin: user.role === 'SUPER_ADMIN' || Boolean((user as any).isSuperAdmin),
    groupIds: user.groupIds || [],
});