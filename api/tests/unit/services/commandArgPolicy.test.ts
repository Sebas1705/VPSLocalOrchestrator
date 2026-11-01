/**
 * Unit tests - per-program argument rules
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkCommandArguments, hasArgumentRule } from '../../../src/services/commandArgPolicy.js';
import { authorizeCommand, DEFAULT_COMMAND_ALLOWLIST, type CommandPolicyConfig } from '../../../src/services/commandPolicy.js';
import { CommandExecutionError } from '../../../src/domain/errors/index.js';

function argvOf(command: string): [string, string[]] {
  const [program = '', ...args] = command.split(' ');
  return [program, args];
}

const ALLOWED = [
  'docker ps',
  'docker ps -a',
  'docker ps -aq',
  'docker ps --no-trunc --format {{json',
  'docker ps --filter status=running',
  'docker images',
  'docker images --format {{.ID}}',
  'docker logs web',
  'docker logs -f --tail 100 web',
  'docker logs --since 10m web',
  'docker stats --no-stream',
  'docker top web',
  'docker start web',
  'docker stop -t 5 web db',
  'docker restart web',
  'docker version',
  'docker info',
  'docker --version',
  'systemctl status nginx',
  'systemctl --no-pager status nginx',
  'systemctl status nginx --no-pager -n 20',
  'systemctl is-active nginx.service',
  'systemctl list-units --type=service --state=running',
  'systemctl list-units --type service',
  'systemctl show nginx -p ActiveState --value',
  'systemctl start nginx',
  'systemctl restart nginx',
  'systemctl reload nginx',
  'systemctl enable nginx',
  'systemctl disable nginx',
  'systemctl',
  'journalctl -u nginx -n 50 --no-pager',
  'journalctl --unit=nginx --lines=50',
  'journalctl -n50',
  'journalctl -r -p err',
  'journalctl --since yesterday',
  'df',
  'df -h',
  'df -hT /',
  'df -B1 /',
  'du -sh /var/log',
  'du -d 1 /tmp',
  'free -h',
  'free -m',
  'uptime',
  'uptime -p',
  'ps aux',
  'ps auxf',
  'ps -ef',
  'ps -eo pid,comm,%cpu --sort=-%cpu',
  'ps -p 1 -o pid,cmd',
  'ip a',
  'ip addr show',
  'ip -br addr',
  'ip link show dev eth0',
  'ip route',
  'ip route get 1.1.1.1',
  'ss -tulpn',
  'ss -s',
  'ls',
  'ls -la /tmp',
  'ls --color=never /var/log',
  'echo hello -e --anything',
  'date',
  'date -u',
  'date +%Y-%m-%d',
  'date -Iseconds',
  'date --iso-8601=seconds',
  'date --rfc-3339=date',
  'date -d yesterday',
  'whoami',
  'hostname',
  'hostname -f',
  'hostname -I',
  'uname -a',
  'uname -sr',
  'id',
  'id -un',
  'id root',
  'pwd',
  'pg_isready',
  'pg_isready -h db -p 5432 -d app -t 3',
  'df --version',
  'ls --help',
];

const DENIED: Array<[string, string]> = [
  // Root through the Docker socket
  ['mounting the host', 'docker run -v /:/host alpine'],
  ['privileged container', 'docker run --privileged alpine'],
  ['exec into a container', 'docker exec web sh'],
  ['create', 'docker create alpine'],
  ['copy out of a container', 'docker cp web:/etc/shadow /tmp/x'],
  ['build', 'docker build /tmp'],
  ['compose', 'docker compose up -d'],
  ['volume mount via compose run', 'docker compose run web'],
  ['commit', 'docker commit web'],
  ['plugin install', 'docker plugin install evil'],
  ['image load', 'docker load'],
  ['login', 'docker login'],
  ['removing containers', 'docker rm -f web'],
  ['inspect prints container secrets', 'docker inspect web'],
  ['another daemon', 'docker -H tcp://evil:2375 ps'],
  ['another daemon, attached value', 'docker --host=tcp://evil:2375 ps'],
  ['another config', 'docker --config /tmp/x ps'],
  ['another context', 'docker --context evil ps'],
  ['a global flag ahead of run', 'docker -l ps run alpine'],
  ['a flag only run accepts', 'docker ps --privileged'],
  ['stray positional', 'docker ps run'],
  ['a container reference that is a flag', 'docker logs --entrypoint=sh'],
  ['prototype key as subcommand', 'docker constructor'],
  ['prototype key as option', 'docker ps --constructor=x'],

  // systemctl
  ['power off', 'systemctl poweroff'],
  ['reboot', 'systemctl reboot'],
  ['kexec', 'systemctl kexec'],
  ['linking a unit from anywhere', 'systemctl link /tmp/evil.service'],
  ['enabling a unit by path', 'systemctl enable /tmp/evil.service'],
  ['editor', 'systemctl edit nginx'],
  ['mask', 'systemctl mask nginx'],
  ['environment', 'systemctl set-environment LD_PRELOAD=/tmp/x'],
  ['properties', 'systemctl set-property nginx CPUQuota=1%'],
  ['daemon-reexec', 'systemctl daemon-reexec'],
  ['another host', 'systemctl -H root@evil status nginx'],
  ['another root', 'systemctl --root=/tmp/x status nginx'],
  ['user manager', 'systemctl --user start evil'],
  ['value option ahead of the verb', 'systemctl -t status poweroff'],
  ['service without a name', 'systemctl start'],
  ['option on a mutating verb', 'systemctl start --force nginx'],

  // Reading or writing files through options
  ['journal from a file', 'journalctl --file=/etc/shadow'],
  ['journal directory', 'journalctl -D /tmp/x'],
  ['journal root', 'journalctl --root=/tmp/x'],
  ['journal cursor writes a file', 'journalctl --cursor-file=/tmp/x'],
  ['journal vacuum', 'journalctl --vacuum-size=1K'],
  ['journal flush', 'journalctl --flush'],
  ['journal follow never returns', 'journalctl -f'],
  ['journal flag cluster with a value letter', 'journalctl -rD/tmp/x'],
  ['du file list', 'du --files0-from=/etc/shadow'],
  ['du exclude file', 'du -X /etc/shadow /tmp'],
  ['date file', 'date -f /etc/shadow'],
  ['date file attached', 'date -f/etc/shadow'],
  ['date file in a cluster', 'date -uf/etc/shadow'],
  ['date file long', 'date --file=/etc/shadow'],
  ['date file abbreviated', 'date --fil=/etc/shadow'],
  ['date reference', 'date -r /etc/shadow'],
  ['setting the clock', 'date -s 2020-01-01'],
  ['setting the clock, positional', 'date 010112002030'],
  ['ss dump to file', 'ss -D /tmp/x'],
  ['ss filter from file', 'ss -F /etc/shadow'],
  ['ss kill sockets', 'ss -K'],
  ['ss other namespace', 'ss -N evil'],
  ['ip batch file', 'ip -batch /tmp/x'],
  ['ip batch short', 'ip -b /tmp/x'],
  ['hostname change', 'hostname evil'],
  ['hostname from file', 'hostname -F /etc/shadow'],
  ['free repeating', 'free -s 1'],
  ['pg conninfo', 'pg_isready -d sslkey=/etc/shadow'],

  // Running things
  ['ip netns exec', 'ip netns exec evil sh'],
  ['ip address change', 'ip addr add 10.0.0.1/24 dev eth0'],
  ['ip link change', 'ip link set eth0 down'],
  ['ip link abbreviated set', 'ip link s eth0 down'],
  ['ip route change', 'ip route add default via 10.0.0.1'],
  ['ip flush', 'ip addr flush dev eth0'],
  ['ip other namespace', 'ip -n evil addr'],

  // Process environments hold API_TOKEN and SECRET_KEY
  ['ps environment', 'ps e'],
  ['ps environment in a cluster', 'ps auxe'],
  ['ps environment format', 'ps -o environ'],
  ['ps environment format attached', 'ps -oenviron'],
  ['ps environment long format', 'ps --format=pid,environ'],
  ['ps environment format with -eo', 'ps -eo environ'],

  ['whoami argument', 'whoami x'],
  ['uname unknown', 'uname -Z'],
  ['pwd argument', 'pwd /tmp'],
  ['id with two users', 'id a b'],
];

describe('checkCommandArguments', () => {
  it.each(ALLOWED)('allows %s', (command) => {
    const [program, args] = argvOf(command);
    expect(checkCommandArguments(program, args)).toBeNull();
  });

  it.each(DENIED)('denies %s: %s', (_label, command) => {
    const [program, args] = argvOf(command);
    expect(checkCommandArguments(program, args)).toEqual(expect.any(String));
  });

  it('has a rule for every program on the default allowlist', () => {
    expect(DEFAULT_COMMAND_ALLOWLIST.filter((program) => !hasArgumentRule(program))).toEqual([]);
  });

  it('leaves programs an operator added themselves alone', () => {
    expect(checkCommandArguments('deploy.sh', ['--anything', 'at', 'all'])).toBeNull();
  });

  it('does not treat object prototype keys as programs with rules', () => {
    expect(hasArgumentRule('constructor')).toBe(false);
  });

  it('puts caller values only inside double quotes', () => {
    expect(checkCommandArguments('docker', ['run', '-e', 'A=secret'])).toBe('docker subcommand "run" is not allowed');
    expect(checkCommandArguments('date', ['--file=secret'])).toBe('option "--file=secret" is not allowed for date');
  });
});

describe('authorizeCommand with argument rules', () => {
  let binDir: string;
  let config: CommandPolicyConfig;

  function expectDenied(input: Parameters<typeof authorizeCommand>[0]): void {
    expect(() => authorizeCommand(input, config)).toThrow(CommandExecutionError);
    try {
      authorizeCommand(input, config);
    } catch (error) {
      expect((error as CommandExecutionError).statusCode).toBe(403);
    }
  }

  beforeAll(() => {
    binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-arg-policy-'));
    for (const name of ['docker', 'date', 'sudo', 'deploy.sh']) {
      fs.writeFileSync(path.join(binDir, name), '#!/bin/sh\n', { mode: 0o755 });
    }
    const script = path.join(binDir, 'deploy.sh');
    config = { allowlist: new Set(['docker', 'date', script]), searchPath: [binDir], allowSudo: true };
  });

  afterAll(() => {
    fs.rmSync(binDir, { recursive: true, force: true });
  });

  it('denies in the string form', () => {
    expectDenied('docker run -v /:/host alpine');
    expectDenied('date -f /etc/shadow');
  });

  it('denies in the argv form', () => {
    expectDenied({ command: 'docker', args: ['run', '-v', '/:/host', 'alpine'] });
  });

  it('denies by absolute path', () => {
    expectDenied({ command: path.join(binDir, 'docker'), args: ['run', 'alpine'] });
  });

  it('applies the same rules under sudo', () => {
    expectDenied('sudo docker run -v /:/host alpine');
    expectDenied('sudo -n date -f /etc/shadow');
    expect(authorizeCommand('sudo docker ps', config).args).toEqual(['-n', path.join(binDir, 'docker'), 'ps']);
  });

  it('does not constrain an allowlisted script', () => {
    const script = path.join(binDir, 'deploy.sh');
    expect(authorizeCommand({ command: script, args: ['--env', 'prod'] }, config).args).toEqual(['--env', 'prod']);
  });
});
