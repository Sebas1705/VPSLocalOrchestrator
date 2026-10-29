import { execFileSync } from 'child_process';

jest.mock('child_process', () => ({ execFileSync: jest.fn() }));

const execSyncMock = execFileSync as jest.Mock;

describe('networkMonitor', () => {
  afterEach(() => {
    execSyncMock.mockReset();
  });

  it('parses network interfaces and connections', async () => {
    const ipOutput = [
      '1: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500',
      '    inet 192.168.0.10/24 brd 192.168.0.255 scope global eth0',
      '    inet6 2001:db8::1/64 scope global',
      '     100 10 1 2 200 20 0 0',
      '2: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536',
      '    inet 127.0.0.1/8 scope host lo',
      '     50 5 0 0 50 5 0 0',
    ].join('\n');

    const ssOutput = [
      'State Recv-Q Send-Q Local Address:Port Peer Address:Port',
      'ESTAB 0 0 127.0.0.1:80 127.0.0.1:50000',
      'TIME-WAIT 0 0 192.168.0.10:22 192.168.0.1:40000',
      'LISTEN 0 0 0.0.0.0:443 0.0.0.0:*',
      'CLOSE-WAIT 0 0 0.0.0.0:1234 0.0.0.0:*',
    ].join('\n');

    execSyncMock
      .mockImplementationOnce(() => Buffer.from(ipOutput))
      .mockImplementationOnce(() => Buffer.from(ssOutput));

    const { getNetworkStats } = await import('../../../src/services/networkMonitor.js');
    const stats = await getNetworkStats();

    expect(execSyncMock).toHaveBeenCalledTimes(2);
    // argv only, never a shell string
    const [ipFile, ipArgs, ipOpts] = execSyncMock.mock.calls[0];
    expect(ipFile).toMatch(/(^|[\/])ip$/);
    expect(ipArgs).toEqual(['-s', '-h', 'link', 'show']);
    expect(ipOpts).toEqual(expect.objectContaining({ shell: false }));
    const [ssFile, ssArgs] = execSyncMock.mock.calls[1];
    expect(ssFile).toMatch(/(^|[\/])ss$/);
    expect(ssArgs).toEqual(['-tan']);
    expect(stats.interfaces.length).toBe(2);
    expect(stats.interfaces[0].ipv4).toBe('192.168.0.10');
    expect(stats.interfaces[0].ipv6).toBe('2001:db8::1');
    expect(stats.connections).toEqual({ established: 1, timeWait: 1, listening: 1, other: 1 });
    expect(stats.timestamp).toBeInstanceOf(Date);
  });

  it('returns safe defaults when commands fail', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('command failed');
    });

    const { getNetworkStats } = await import('../../../src/services/networkMonitor.js');
    const stats = await getNetworkStats();

    expect(stats.interfaces).toEqual([]);
    expect(stats.connections).toEqual({ established: 0, timeWait: 0, listening: 0, other: 0 });
  });

  it('ignores link-local ipv6 and handles partial stats', async () => {
    const ipOutput = [
      '3: wlan0: <BROADCAST,MULTICAST> mtu 1500',
      '    inet 10.0.0.5/24 brd 10.0.0.255 scope global wlan0',
      '    inet6 fe80::1/64 scope link',
      '     100 10 1 2', // malformed stats line (too short)
    ].join('\n');

    execSyncMock
      .mockImplementationOnce(() => Buffer.from(ipOutput))
      .mockImplementationOnce(() => {
        throw new Error('ss timeout');
      });

    const { getNetworkStats } = await import('../../../src/services/networkMonitor.js');
    const stats = await getNetworkStats();

    expect(stats.interfaces[0].ipv6).toBeUndefined(); // link-local should be skipped
    expect(stats.interfaces[0].bytesIn).toBe(0); // malformed stats should leave defaults
    expect(stats.connections).toEqual({ established: 0, timeWait: 0, listening: 0, other: 0 });
  });
});
