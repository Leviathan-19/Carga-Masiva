import path from 'path';

export const CONFIG = {
  CDP_ENDPOINT: process.env.CDP_ENDPOINT || 'http://localhost:9222',
  DEFAULT_TIMEOUT_MS: 15000,
  HUMAN_DELAY: {
    MIN_MS: 120,
    MAX_MS: 300,
    FIELD_TRANSITION_MS: 150,
  },
  SALESFORCE: {
    USER_NEW_URL_FRAGMENT: '/005/e',
    DEFAULT_EMAIL_ENCODING: 'Unicode (UTF-8)',
    DEFAULT_TIMEZONE: '(GMT-05:00) Ecuador Time (America/Guayaquil)',
    DEFAULT_LOCALE: 'Spanish (Ecuador)',
    DEFAULT_LANGUAGE: 'Spanish (Mexico)',
  },
  PATHS: {
    OUTPUT_DIR: path.resolve(process.cwd(), 'data', 'output'),
    SUCCESS_FILE: path.resolve(process.cwd(), 'data', 'output', 'exitosos.csv'),
    FAILURES_FILE: path.resolve(process.cwd(), 'data', 'output', 'fallidos.csv'),
  }
};

