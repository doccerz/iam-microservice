export const logger = {
  info: (...args: unknown[]): void => {
    console.log(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
