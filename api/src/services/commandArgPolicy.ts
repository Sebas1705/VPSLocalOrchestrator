/**
 * Argument rules for the default command allowlist.
 *
 * Allowlisting an executable is not enough: `docker run -v /:/host`, `date -f
 * <path>`, `ss -D <path>`, `hostname <name>` and `ip netns exec` are all the
 * "allowed" program doing something very different. Each program below states
 * what it may be called with, and anything not listed is denied, so a new flag
 * in a future release of the tool stays denied until it is added here.
 *
 * Programs without a rule are ones an operator added to COMMAND_ALLOWLIST
 * (typically an absolute path to a deploy script): their arguments are not
 * checked, because this module cannot know what they mean. That is also the way
 * to expose something denied here, such as `docker compose up`: wrap the exact
 * invocation in a script and allowlist the script.
 *
 * Every value pattern starts with a non-dash character (or is a free-text
 * option whose parser always consumes the next argument), so a value can never
 * smuggle in a flag.
 */

export interface ArgSpec {
  /** Boolean flags, matched exactly. */
  flags?: readonly string[];
  /** Combined short boolean flags such as `-tulpn`. Only list non-value letters. */
  cluster?: RegExp;
  /** Flags that take a value: `--name=v`, `--name v`, `-n v` and `-nv`. */
  options?: Readonly<Record<string, RegExp>>;
  /** Pattern for positional arguments. Without it, none are accepted. */
  positional?: RegExp;
  /** Stricter pattern for the first positional, e.g. the verb in `ip link show`. */
  firstPositional?: RegExp;
  minPositional?: number;
  maxPositional?: number;
}

export interface CommandRule extends ArgSpec {
  /** The program takes no dangerous arguments at all (`echo`). */
  anyArguments?: boolean;
  /**
   * The first argument that is not one of the rule's own boolean `flags` must
   * name one of these, and the rest is checked against that entry. Only boolean
   * flags may precede it: `systemctl -t status poweroff` must not be read as
   * the `status` subcommand with a `-t poweroff` value.
   */
  subcommands?: Readonly<Record<string, ArgSpec>>;
}

const WORD = /^[A-Za-z0-9][A-Za-z0-9_.:@%+,=/-]*$/;
const UNIT = /^[A-Za-z0-9@_][A-Za-z0-9@._:\\-]*$/;
const CONTAINER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const IMAGE = /^[A-Za-z0-9][A-Za-z0-9_.:/@-]*$/;
const INTEGER = /^\d{1,9}$/;
const TIME = /^[A-Za-z0-9+-][A-Za-z0-9 :.+-]*$/;
const TEXT = /^[^\r\n\0]*$/;
const PATH_ARG = /^[^-\r\n\0][^\r\n\0]*$/;
const USER = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

const DOCKER_LIST_OPTIONS = {
  '--format': TEXT,
  '--filter': WORD,
  '-f': WORD,
};

const SYSTEMCTL_FLAGS = [
  '--no-pager',
  '--no-legend',
  '--plain',
  '--full',
  '--all',
  '-a',
  '-l',
  '-q',
  '--quiet',
  '--no-ask-password',
];

const SYSTEMCTL_LIST: ArgSpec = {
  flags: SYSTEMCTL_FLAGS,
  options: { '--type': WORD, '-t': WORD, '--state': WORD },
  positional: UNIT,
};

const SYSTEMCTL_READ: ArgSpec = {
  flags: [...SYSTEMCTL_FLAGS, '--value'],
  options: { '--lines': INTEGER, '-n': INTEGER, '--output': WORD, '-o': WORD, '--property': WORD, '-p': WORD },
  positional: UNIT,
};

const SYSTEMCTL_CHANGE: ArgSpec = {
  flags: ['--no-pager', '--no-ask-password', '-q', '--quiet'],
  positional: UNIT,
  minPositional: 1,
};

const IP_FLAGS = ['-br', '-brief', '-s', '-stats', '-d', '-details', '-o', '-oneline', '-4', '-6', '-j', '-json', '-p', '-pretty'];

/** Read verbs only. No abbreviations: `ip link s` means `set`, not `show`. */
const IP_READ: ArgSpec = {
  flags: IP_FLAGS,
  firstPositional: /^(show|list|lst|ls|get)$/,
  positional: IMAGE,
};

const COMMAND_RULES: Readonly<Record<string, CommandRule>> = {
  // No run/exec/create/cp/build/compose/pull/volume/network/plugin/login/save,
  // and no global options (-H, --config, --context). `inspect` is left out too:
  // it prints the environment of every container, secrets included.
  docker: {
    flags: ['--version', '-v'],
    subcommands: {
      ps: {
        flags: ['-a', '--all', '-q', '--quiet', '-l', '--latest', '-s', '--size', '--no-trunc'],
        cluster: /^-[aqls]+$/,
        options: { ...DOCKER_LIST_OPTIONS, '--last': INTEGER, '-n': INTEGER },
      },
      images: {
        flags: ['-a', '--all', '-q', '--quiet', '--no-trunc', '--digests'],
        cluster: /^-[aq]+$/,
        options: DOCKER_LIST_OPTIONS,
        positional: IMAGE,
        maxPositional: 1,
      },
      logs: {
        flags: ['-f', '--follow', '-t', '--timestamps'],
        cluster: /^-[ft]+$/,
        options: { '--tail': /^(\d{1,9}|all)$/, '-n': /^(\d{1,9}|all)$/, '--since': TIME, '--until': TIME },
        positional: CONTAINER,
        minPositional: 1,
        maxPositional: 1,
      },
      stats: {
        flags: ['--no-stream', '-a', '--all', '--no-trunc'],
        options: { '--format': TEXT },
        positional: CONTAINER,
      },
      top: { positional: CONTAINER, minPositional: 1, maxPositional: 1 },
      port: { positional: CONTAINER, minPositional: 1, maxPositional: 1 },
      version: { options: { '--format': TEXT, '-f': TEXT } },
      info: { options: { '--format': TEXT, '-f': TEXT } },
      start: { positional: CONTAINER, minPositional: 1 },
      stop: { options: { '--time': INTEGER, '-t': INTEGER }, positional: CONTAINER, minPositional: 1 },
      restart: { options: { '--time': INTEGER, '-t': INTEGER }, positional: CONTAINER, minPositional: 1 },
    },
  },

  // No link/edit/mask/set-property/set-environment/import-environment,
  // no poweroff/reboot/halt/kexec, no daemon-reexec, no --root/-H/-M/--user.
  // Unit names cannot contain "/", so enable/disable cannot point at a file.
  systemctl: {
    flags: ['--version', ...SYSTEMCTL_FLAGS],
    subcommands: {
      status: SYSTEMCTL_READ,
      show: SYSTEMCTL_READ,
      cat: SYSTEMCTL_READ,
      'is-active': SYSTEMCTL_READ,
      'is-enabled': SYSTEMCTL_READ,
      'is-failed': SYSTEMCTL_READ,
      'list-units': SYSTEMCTL_LIST,
      'list-unit-files': SYSTEMCTL_LIST,
      'list-timers': SYSTEMCTL_LIST,
      'list-sockets': SYSTEMCTL_LIST,
      'list-dependencies': SYSTEMCTL_LIST,
      start: SYSTEMCTL_CHANGE,
      stop: SYSTEMCTL_CHANGE,
      restart: SYSTEMCTL_CHANGE,
      reload: SYSTEMCTL_CHANGE,
      'try-restart': SYSTEMCTL_CHANGE,
      enable: SYSTEMCTL_CHANGE,
      disable: SYSTEMCTL_CHANGE,
    },
  },

  // No -D/--directory, --file, --root, --image (other journals), --cursor-file
  // (writes), --vacuum-*/--rotate/--flush (mutate), -f (never returns).
  journalctl: {
    flags: ['--no-pager', '--reverse', '--dmesg', '--quiet', '--utc', '--catalog', '--all', '--pager-end', '-b', '--boot'],
    cluster: /^-[rkqxea]+$/,
    options: {
      '--unit': UNIT,
      '-u': UNIT,
      '--lines': /^(\d{1,9}|all)$/,
      '-n': /^(\d{1,9}|all)$/,
      '--priority': WORD,
      '-p': WORD,
      '--since': TIME,
      '-S': TIME,
      '--until': TIME,
      '-U': TIME,
      '--output': WORD,
      '-o': WORD,
      '--grep': TEXT,
      '-g': TEXT,
      '--identifier': WORD,
      '-t': WORD,
    },
  },

  df: {
    flags: ['--human-readable', '--si', '--inodes', '--local', '--all', '--total', '--print-type', '--portability'],
    cluster: /^-[ahHiklPT]+$/,
    options: {
      '--block-size': WORD,
      '-B': WORD,
      '--type': WORD,
      '-t': WORD,
      '--exclude-type': WORD,
      '-x': WORD,
      '--output': WORD,
    },
    positional: PATH_ARG,
  },

  // No --files0-from and -X/--exclude-from: their errors echo file contents.
  du: {
    flags: ['--human-readable', '--summarize', '--total', '--one-file-system', '--apparent-size', '--si'],
    cluster: /^-[achkmsxb]+$/,
    options: { '--max-depth': INTEGER, '-d': INTEGER },
    positional: PATH_ARG,
  },

  // No -s/-c: they repeat until the timeout kills the command.
  free: {
    flags: ['--human', '--bytes', '--kilo', '--mega', '--giga', '--tera', '--kibi', '--mebi', '--gibi', '--tebi', '--si', '--total', '--wide'],
    cluster: /^-[bkmghltw]+$/,
  },

  uptime: { flags: ['-p', '--pretty', '-s', '--since'] },

  // BSD `e` and the `environ` format print process environments, including this
  // API's own API_TOKEN and SECRET_KEY, so neither `e` nor "env" is accepted.
  ps: {
    flags: ['--no-headers', '--no-header', '--headers', '--forest'],
    cluster: /^-[AadeFfHjLlMNTwy]+$/,
    options: {
      '-o': /^(?!.*env)[A-Za-z0-9%,_:=+-]+$/i,
      '-eo': /^(?!.*env)[A-Za-z0-9%,_:=+-]+$/i,
      '-Ao': /^(?!.*env)[A-Za-z0-9%,_:=+-]+$/i,
      '--format': /^(?!.*env)[A-Za-z0-9%,_:=+-]+$/i,
      '-p': /^\d+(,\d+)*$/,
      '--pid': /^\d+(,\d+)*$/,
      '--ppid': /^\d+(,\d+)*$/,
      '-u': USER,
      '-U': USER,
      '--user': USER,
      '-C': WORD,
      '--sort': /^[-+]?[A-Za-z0-9%_]+(,[-+]?[A-Za-z0-9%_]+)*$/,
    },
    positional: /^[auxfwrTlvjsSc]+$/,
  },

  // Read verbs only: no add/del/set/flush, no `ip netns exec` (runs commands),
  // no -batch (reads commands from a file), no -n/-netns.
  ip: {
    flags: IP_FLAGS,
    subcommands: {
      a: IP_READ,
      addr: IP_READ,
      address: IP_READ,
      l: IP_READ,
      link: IP_READ,
      r: IP_READ,
      ro: IP_READ,
      route: IP_READ,
      n: IP_READ,
      neigh: IP_READ,
      neighbor: IP_READ,
      neighbour: IP_READ,
      rule: IP_READ,
    },
  },

  // No -K (kills sockets), -D (writes a file), -F (reads a file), -N (netns).
  ss: {
    flags: [
      '--tcp',
      '--udp',
      '--unix',
      '--all',
      '--listening',
      '--numeric',
      '--processes',
      '--summary',
      '--no-header',
      '--ipv4',
      '--ipv6',
      '--extended',
      '--memory',
      '--info',
      '--options',
    ],
    cluster: /^-[tuwxalnpsrmio46eH]+$/,
    positional: /^[A-Za-z0-9.:_/=()-]+$/,
  },

  ls: {
    flags: ['--all', '--almost-all', '--human-readable', '--recursive', '--reverse', '--directory', '--classify', '--inode'],
    cluster: /^-[aAbcdFghHiklLnNopqQrRsStuUvxX1]+$/,
    options: { '--color': /^(never|auto|always)$/, '--time-style': WORD, '--sort': WORD },
    positional: PATH_ARG,
  },

  echo: { anyArguments: true },

  // Only `+FORMAT` positionals: `date 010112002030` sets the clock. No -s/--set
  // and no -f/--file, which prints every line of any file in its error output.
  date: {
    flags: ['-u', '--utc', '--universal', '-R', '--rfc-email', '--iso-8601'],
    cluster: /^-I(date|hours|minutes|seconds|ns)?$/,
    options: { '-d': TEXT, '--date': TEXT, '--iso-8601': WORD, '--rfc-3339': WORD },
    positional: /^\+[^\r\n\0]*$/,
    maxPositional: 1,
  },

  whoami: {},

  // A positional or -F/--file sets the hostname.
  hostname: {
    flags: [
      '-f',
      '--fqdn',
      '--long',
      '-s',
      '--short',
      '-d',
      '--domain',
      '-i',
      '--ip-address',
      '-I',
      '--all-ip-addresses',
      '-A',
      '--all-fqdns',
    ],
  },

  uname: {
    flags: [
      '--all',
      '--kernel-name',
      '--nodename',
      '--kernel-release',
      '--kernel-version',
      '--machine',
      '--processor',
      '--hardware-platform',
      '--operating-system',
    ],
    cluster: /^-[asnrvmpio]+$/,
  },

  id: { cluster: /^-[ugGnrz]+$/, positional: USER, maxPositional: 1 },

  pwd: { flags: ['-L', '-P'] },

  // No conninfo strings in -d: they can name key files and passfiles.
  pg_isready: {
    flags: ['-q', '--quiet'],
    options: {
      '-h': WORD,
      '--host': WORD,
      '-p': INTEGER,
      '--port': INTEGER,
      '-U': USER,
      '--username': USER,
      '-d': /^[A-Za-z0-9_][A-Za-z0-9_.$-]*$/,
      '--dbname': /^[A-Za-z0-9_][A-Za-z0-9_.$-]*$/,
      '-t': INTEGER,
      '--timeout': INTEGER,
    },
  },
};

/** Check one option-style argument. Returns how many extra args it consumed, or null if not allowed. */
function matchOption(spec: ArgSpec, arg: string, next: string | undefined): { consumed: number } | null {
  const options = spec.options ?? {};
  let pattern: RegExp | undefined;
  let value: string | undefined;
  let consumed = 0;

  const equals = arg.startsWith('--') ? arg.indexOf('=') : -1;
  const shortName = arg.slice(0, 2);
  if (Object.hasOwn(options, arg)) {
    pattern = options[arg];
    value = next;
    consumed = 1;
  } else if (equals > 0 && Object.hasOwn(options, arg.slice(0, equals))) {
    pattern = options[arg.slice(0, equals)];
    value = arg.slice(equals + 1);
  } else if (!arg.startsWith('--') && arg.length > 2 && Object.hasOwn(options, shortName)) {
    pattern = options[shortName];
    value = arg.slice(2);
  }

  if (!pattern || value === undefined || !pattern.test(value)) return null;
  return { consumed };
}

/** Validate args against one spec. Returns a denial reason, or null when allowed. */
function checkSpec(spec: ArgSpec, args: readonly string[], label: string): string | null {
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;

    if (!arg.startsWith('-') || arg === '-') {
      positionals.push(arg);
      continue;
    }
    if (spec.flags?.includes(arg) || spec.cluster?.test(arg)) continue;

    const match = matchOption(spec, arg, args[i + 1]);
    if (!match) return `option "${arg}" is not allowed for ${label}`;
    i += match.consumed;
  }

  if (positionals.length > 0 && !spec.positional) {
    return `argument "${positionals[0]}" is not allowed for ${label}`;
  }
  if (positionals.length < (spec.minPositional ?? 0)) {
    return `${label} needs at least ${spec.minPositional} argument(s)`;
  }
  if (spec.maxPositional !== undefined && positionals.length > spec.maxPositional) {
    return `${label} accepts at most ${spec.maxPositional} argument(s)`;
  }
  for (const [index, value] of positionals.entries()) {
    const pattern = index === 0 && spec.firstPositional ? spec.firstPositional : spec.positional;
    if (pattern && !pattern.test(value)) {
      return `argument "${value}" is not allowed for ${label}`;
    }
  }
  return null;
}

/**
 * Check a program's arguments against its rule.
 * Returns a denial reason, or null when allowed. Values appear only inside
 * double quotes, which is how the audit trail strips them from the reason.
 */
export function checkCommandArguments(program: string, args: readonly string[]): string | null {
  if (!Object.hasOwn(COMMAND_RULES, program)) return null;
  const rule = COMMAND_RULES[program] as CommandRule;
  if (rule.anyArguments) return null;
  if (args.length === 1 && (args[0] === '--help' || args[0] === '--version')) return null;

  if (!rule.subcommands) return checkSpec(rule, args, program);

  let index = 0;
  while (index < args.length && rule.flags?.includes(args[index] as string)) index++;

  const subcommand = args[index];
  if (subcommand === undefined) return null;
  if (!Object.hasOwn(rule.subcommands, subcommand)) {
    return `${program} subcommand "${subcommand}" is not allowed`;
  }
  return checkSpec(rule.subcommands[subcommand] as ArgSpec, args.slice(index + 1), `${program} ${subcommand}`);
}

/** Programs whose arguments are constrained. */
export function hasArgumentRule(program: string): boolean {
  return Object.hasOwn(COMMAND_RULES, program);
}
