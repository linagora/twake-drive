import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });
export const {
  NODE_ENV,
  SERVER_PORT,
  SECRET_KEY,
  CREDENTIALS_ENDPOINT,
  ONLY_OFFICE_SERVER,
  CREDENTIALS_ID,
  CREDENTIALS_SECRET,
  SERVER_PREFIX,
  SERVER_ORIGIN,
} = process.env;

export const twakeDriveTokenRefrehPeriodMS = 10 * 60 * 1000;
export const onlyOfficeForgottenFilesCheckPeriodMS = 10 * 60 * 1000;
export const onlyOfficeConnectivityCheckPeriodMS = 10 * 60 * 1000;
