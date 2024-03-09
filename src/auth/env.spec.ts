import '../test-env';
import { type AuthEnvironemtnOptions, Environment } from './env';


describe('auth/env', () => {
  test('should be ok', () => {
    expect(25 ** 0.5).toBe(5);
  });

  const init = {
    database: {
      connection: 'postgres://localhost:5432',
      dialect: 'postgres',
      refs: {
        users: {
          tableName: 'users',
          userIdentifier: 'id',
        },
      },
      tablePrefix: 'prefix_',
    },
  } as AuthEnvironemtnOptions;

  test('method `getVariable` should return `null` if the variable is not set', () => {
    const env = new Environment(init);
    expect(env.getVariable('SOME_VARIABLE_NAME')).toBeNull();
  });

  test('method `getVariable` should return the value of the variable', () => {
    const env = new Environment(init);
    process.env.DATABASE_URI = 'postgres://localhost:5432';

    expect(env.getVariable('DATABASE_URI')).toBe('postgres://localhost:5432');
  });

  test('method `getVariable` should return the value of the variable with a fallback', () => {
    const env = new Environment(init);
    expect(env.getVariable('DATABASE_URI', { fallback: 'postgres://localhost:5432' })).toBe('postgres://localhost:5432');
  });

  test('method `getVariable` should return the value of the variable with a fallback and a rewrite', () => {
    const env = new Environment(init);
    process.env.DATABASE_URI = 'postgres://localhost:5432';

    expect(env.getVariable('DATABASE_URI', { fallback: 'postgres://localhost:5432', rewrite: (value) => new URL(value) })).toBeInstanceOf(URL);
  });

  test('method `setVariable` should set the variable', () => {
    const env = new Environment(init);
    env.setVariable('DATABASE_URI', 'postgres://localhost:5432');
    expect(process.env.DATABASE_URI).toBe('postgres://localhost:5432');
  });

  test('method `setVariable` should not set the variable if it is already set with `override = false`', () => {
    const env = new Environment(init);
    process.env.DATABASE_URI = 'postgres://localhost:5432';
    env.setVariable('DATABASE_URI', 'null', false);

    expect(process.env.DATABASE_URI).toBe('postgres://localhost:5432');
  });

  test('method `setVariable` should set the variable if `override` is `true`', () => {
    const env = new Environment(init);
    process.env.DATABASE_URI = 'postgres://localhost:5432';
    env.setVariable('DATABASE_URI', 'null', true);
    
    expect(process.env.DATABASE_URI).toBe('null');
  });

  test('method `getVariable` should replace variables inside `${.*}`', () => {
    const env = new Environment(init);
    process.env.DATABASE_URI = 'postgres://localhost:5432';
    process.env.POSTGRES_DB = 'db';

    expect(env.getVariable('DATABASE_URL', { fallback: 'postgres://${POSTGRES_DB}' })).toBe('postgres://db');
  });
});
