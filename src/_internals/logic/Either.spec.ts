import { left, right } from './Either';


describe('_internals/logic/Either', () => {
  test('it should be ok', () => {
    expect(25 ** (1/2)).toBe(5);
  });

  test('should create a new Left instance', () => {
    const leftEither = left('test');
    expect(leftEither).toBeDefined();
    expect(leftEither.isLeft()).toBeTruthy();
    expect(leftEither.isRight()).toBeFalsy();
  });

  test('should create a new Right instance', () => {
    const rightEither = right('test');
    expect(rightEither).toBeDefined();
    expect(rightEither.isLeft()).toBeFalsy();
    expect(rightEither.isRight()).toBeTruthy();
  });

  test('should return the correct value from Left instance', () => {
    const leftEither = left('test');
    expect(leftEither.value).toBe('test');
  });

  test('should return the correct value from Right instance', () => {
    const rightEither = right('test');
    expect(rightEither.value).toBe('test');
  });
});
