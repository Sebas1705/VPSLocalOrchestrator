/**
 * The environment handed to every child process.
 *
 * Before this module a child got a copy of the API's own environment, so any
 * allowlisted program (and anything it runs) could read API_TOKEN, SECRET_KEY
 * and every other credential in api/.env, for example through `docker` helpers
 * or a script added to COMMAND_ALLOWLIST.
 *
 * Now the environment is built from an allowlist:
 *  - a fixed set of harmless variables (PATH, HOME, LANG, TZ, ...) copied from
 *    the API's environment;
 *  - variables the operator names in CHILD_ENV_PASSTHROUGH (comma or space
 *    separated; `NAME` or `PREFIX*`), for things a tool really needs such as
 *    DOCKER_HOST or PGHOST;
 *  - the caller's own variables, already validated by commandPolicy.
 *
 * Names matching TOKEN, KEY, SECRET or PASSWORD are dropped even if they would
 * otherwise pass, unless the operator lists them in CHILD_ENV_PASSTHROUGH.
 * The API's own variables (API_TOKEN, SECRET_KEY, SUDO_PASSWORD, ...) are never
 * passed, even when listed there.
 */

const SAFE_VARIABLES = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'LANG',
  'LANGUAGE',
  'TZ',
  'TERM',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SHELL',
  // Windows needs these to start any process.
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
]);

const SAFE_PREFIXES = ['LC_'];

const SECRET_NAME = /(TOKEN|KEY|SECRET|PASSWORD)/i;

/** Variables the API itself reads. They are configuration for the API, not for its children. */
const API_VARIABLES = new Set([
  'API_TOKEN',
  'API_HOST',
  'SECRET_KEY',
  'ENCRYPTION_MASTER_KEY',
  'SUDO_PASSWORD',
  'ALLOW_SUDO_COMMANDS',
  'ENABLE_PRIVILEGED_ENDPOINTS',
  'ALERT_EMAIL',
  'WEBHOOK_LOG_URL',
  'ALLOWED_SCRIPT_PATHS',
  'MAX_COMMAND_TIMEOUT',
  'LOG_LEVEL',
  'PORT',
  'NODE_ENV',
  'RATE_LIMIT_TIER',
  'COMMAND_ALLOWLIST',
  'COMMAND_SEARCH_PATH',
  'CHILD_ENV_PASSTHROUGH',
]);
const API_PREFIXES = ['API_', 'FILE_', 'OUTBOUND_'];

function isApiVariable(upperName: string): boolean {
  return API_VARIABLES.has(upperName) || API_PREFIXES.some((prefix) => upperName.startsWith(prefix));
}

function parsePassthrough(raw: string | undefined): { names: Set<string>; prefixes: string[] } {
  const names = new Set<string>();
  const prefixes: string[] = [];
  for (const entry of (raw ?? '').split(/[,\s]+/)) {
    const value = entry.trim().toUpperCase();
    if (!value) continue;
    if (value.endsWith('*')) prefixes.push(value.slice(0, -1));
    else names.add(value);
  }
  return { names, prefixes };
}

/**
 * Build the environment for a child process.
 *
 * @param extra Caller-supplied variables (validated elsewhere); they win over inherited ones.
 * @param source The environment to read from. Defaults to the API's own.
 */
export function buildChildEnv(
  extra?: Record<string, string | undefined>,
  source: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const passthrough = parsePassthrough(source.CHILD_ENV_PASSTHROUGH);
  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const upper = name.toUpperCase();
    if (isApiVariable(upper)) continue;

    const listed = passthrough.names.has(upper) || passthrough.prefixes.some((prefix) => upper.startsWith(prefix));
    const safe = SAFE_VARIABLES.has(upper) || SAFE_PREFIXES.some((prefix) => upper.startsWith(prefix));
    if (!listed && !safe) continue;
    if (!listed && SECRET_NAME.test(upper)) continue;
    result[name] = value;
  }

  for (const [name, value] of Object.entries(extra ?? {})) {
    if (value !== undefined) result[name] = value;
  }
  return result;
}
