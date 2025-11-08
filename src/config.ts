import dotenv from 'dotenv';

dotenv.config();

export interface OpenGaussConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

export function getConfig(): OpenGaussConfig {
  return {
    host: process.env.OPENGAUSS_HOST || 'localhost',
    port: parseInt(process.env.OPENGAUSS_PORT || '5432', 10),
    database: process.env.OPENGAUSS_DATABASE || 'postgres',
    user: process.env.OPENGAUSS_USER || '',
    password: process.env.OPENGAUSS_PASSWORD || '',
    schema: process.env.OPENGAUSS_SCHEMA || 'public',
  };
}

export function shouldShowVersion(): boolean {
  return process.argv.includes('--version') || process.argv.includes('-v');
}



