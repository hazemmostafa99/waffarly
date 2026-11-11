export interface CustomerProfile {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface CustomerSignUpRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface CustomerSignInRequest {
  identifier: string;
  password: string;
}
