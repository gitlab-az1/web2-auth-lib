import {
  IPv4,
  IPv6,
  localIP,
  resolveIP,
} from './inet';


describe('_internals/inet', () => {
  test('should be ok', () => {
    expect(25 ** (1/2)).toBe(5);
  });
    
  test('should create a new IPv4 instance', () => {
    const ipv4 = IPv4.from('10.10.4.61');
    if(ipv4.isLeft()) return expect(ipv4.isLeft()).toBe(false);

    expect(ipv4.value).toBeInstanceOf(IPv4);
    expect(ipv4.value.address).toBe('10.10.4.61');
    expect(ipv4.value.octets).toEqual([10, 10, 4, 61]);
    expect(ipv4.value.family).toBe('IPv4');
  });

  test('should create a new IPv6 instance', () => {
    const ipv6 = IPv6.from('fe80::1');
    if(ipv6.isLeft()) return expect(ipv6.isLeft()).toBe(false);
    
    expect(ipv6.value).toBeInstanceOf(IPv6);
    expect(ipv6.value.address).toBe('fe80::1');
    expect(ipv6.value.blocks).toEqual(['fe80', '1']);
    // expect(ipv6.value.octets).toEqual([0xfe, 0x80, 0, 0, 0, 0, 0, 0x1]);
    expect(ipv6.value.family).toBe('IPv6');
  });

  test('should return the correct local IPv4 address', () => {
    const ipv4 = localIP();
    
    expect(ipv4).toBeInstanceOf(IPv4);
    expect(ipv4.family).toBe('IPv4');
  });

  test('should resolve the correct IPv4 address', async () => {
    const ipv4 = resolveIP('192.168.11.5');

    expect(ipv4).toBeInstanceOf(IPv4);
    expect(ipv4.family).toBe('IPv4');
    expect(ipv4.address).toBe('192.168.11.5');
    expect(ipv4.octets).toEqual([192, 168, 11, 5]);
  });

  test('should resolve the correct IPv6 address', async () => {
    const ipv6 = resolveIP('fe80::1');
    
    expect(ipv6).toBeInstanceOf(IPv6);
    expect(ipv6.family).toBe('IPv6');
    expect(ipv6.address).toBe('fe80::1');
    // expect(ipv6.octets).toEqual([0xfe, 0x80, 0, 0, 0, 0, 0, 0x1]);
  });
});
