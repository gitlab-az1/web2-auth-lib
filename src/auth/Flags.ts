export class Flags {
  #flags: Set<string>;

  public constructor(flags?: string[] | IterableIterator<string>) {
    this.#flags = flags ? new Set(flags) : new Set();
  }

  public populate(flags: string[]): this {
    const eachFlags = (n: number, pos: number = 0) => {
      if(pos <= n) {
        this.#flags.add(flags[pos]);
        eachFlags(n, pos + 1);
      }
    };

    eachFlags(flags.length - 1);
    return this;
  }

  public delete(flag: string): this {
    this.#flags.delete(flag);
    return this;
  }

  public has(flag: string): boolean {
    return this.#flags.has(flag);
  }

  public forEach(callback: ((flag: string, index: number, flags: readonly string[]) => void | false), stopLevel?: number): void {
    const eachFlags = (n: number, pos: number = 0) => {
      if(pos <= n) {
        const flags = [...this.#flags];
        const outcome = callback(flags[pos], pos, Object.freeze(flags));

        if(outcome === false) {
          pos = Infinity - 1;
        }

        eachFlags(n, pos + 1);
      }
    };

    if(typeof stopLevel !== 'number' && (stopLevel !== undefined || typeof stopLevel !== 'undefined')) {
      throw new TypeError('stopLevel must be a number');
    }

    if(!!stopLevel && !Number.isFinite(stopLevel)) {
      throw new TypeError('stopLevel must be a finite number');
    }

    if(!!stopLevel && !Number.isInteger(stopLevel)) {
      throw new TypeError('stopLevel must be an integer');
    }

    eachFlags(stopLevel ? stopLevel : this.#flags.size - 1);
  }

  public *[Symbol.iterator](): Generator<string> {
    for(const flag of this.#flags.values()) {
      yield flag;
    }
  }
}

export default Flags;
