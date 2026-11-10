export interface SalesforceUserData {
  FirstName?: string;
  LastName: string;
  Alias: string;
  Email: string;
  Username: string;
  Nickname: string;
  Title?: string;
  Company?: string;
  Department?: string;
  Division?: string;
  Phone?: string;
  Mobile?: string;
  UserLicense?: string;
  Profile?: string;
  Role?: string;
  TimeZone?: string;
  Locale?: string;
  Language?: string;
  EmailEncoding?: string;
  SendPassword?: boolean | string;
  [key: string]: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ProcessResult {
  record: SalesforceUserData;
  success: boolean;
  error?: string;
  timestamp: string;
}

