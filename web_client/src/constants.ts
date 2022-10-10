export const API_URL = process.env.VUE_APP_API_URL;
export const STATIC_PATH = process.env.VUE_APP_STATIC_PATH;
export const OAUTH_API_ROOT = process.env.VUE_APP_OAUTH_API_ROOT;
export const OAUTH_CLIENT_ID = process.env.VUE_APP_OAUTH_CLIENT_ID;

export const decisionOptions = {
  U: 'Usable',
  UE: 'Usable-extra',
  'Q?': 'Questionable',
  UN: 'Unusable',
};

export const warningDuration = 2 * 60 * 1000; // the warning box will pop up for 2 minutes
// The server-side session token lasts 30 minutes
export const sessionTimeout = 30 * 60 * 1000;
// Log out after 15 minutes if the user is away from keyboard
export const idleTimeout = 15 * 60 * 1000;
