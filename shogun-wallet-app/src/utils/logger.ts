export const log = (message: string, ...args: any[]) => {
  console.log(`[Shogun] ${message}`, ...args);
};

export const logError = (message: string, ...args: any[]) => {
  console.error(`[Shogun] ${message}`, ...args);
}; 