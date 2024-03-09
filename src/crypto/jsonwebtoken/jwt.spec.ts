import { JsonWebToken } from './jwt';


describe('crypto/jsonwebtoken/jwt', () => {
  test('should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });

  const secret = 'y7sd8gosodgiuhsuigsdo8gsduoghjdg';
  const oneToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoxLCJ1c2VybmFtZSI6InVzZXIifSwiaWF0IjoxNzEwMDE5MjYwLCJzdWIiOiJ1c2VyIiwianRpIjoiN2FkYjlmOGMtNTJkNi00OGViLTg3NDgtZDQ0NGZmYjk3YjA0In0.RODjaeVaZ7nYZtmxwU1WCKXus1bZa4fYgBoFB18dznA';

  test('should be able to create a token', async () => {
    const payload = { id: 1, username: 'user' } as const;

    const jwt = await JsonWebToken.encode(payload, {
      key: secret,
      salt: 'salt',
      sub: 'user',
    });

    expect(jwt.token).toBeDefined();
    expect(typeof jwt.token).toBe('string');
    
    expect(jwt.object.sub).toBe('user');
    expect(jwt.object.payload.id).toBe(1);
    expect(jwt.object.payload.username).toBe('user');
  });

  test('should be able to decode a token', async () => {
    const jwt = await JsonWebToken.decode(oneToken, secret, 'salt');

    if(jwt.isLeft()) {
      console.error(jwt.value);
      expect(jwt.isLeft()).toBe(false);
    }

    expect((jwt.value as JsonWebToken).sub).toBe('user');
    expect((jwt.value as JsonWebToken).payload.id).toBe(1);
    expect((jwt.value as JsonWebToken).payload.username).toBe('user');
  });

  test('should\'t be able to decode a token with a wrong secret', async () => {
    const jwt = await JsonWebToken.decode(oneToken, 'wrong', 'salt');
    expect(jwt.isLeft()).toBe(true);
  });

  test('should\'t be able to decode a token with a wrong salt', async () => {
    const jwt = await JsonWebToken.decode(oneToken, secret, 'wrong');
    expect(jwt.isLeft()).toBe(true);
  });
});
