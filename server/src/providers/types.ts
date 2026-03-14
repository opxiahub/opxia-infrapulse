export interface ProviderCredential {
  id: number;
  user_id: number;
  label: string;
  provider: string;
  region: string;
  encrypted_credentials: string;
  verified: number;
  credential_type: 'permanent' | 'temporary';
  created_at: string;
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}
