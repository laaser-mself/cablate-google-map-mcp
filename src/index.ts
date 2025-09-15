export const Logger = {
  log: (...args: any[]) => {
    console.log("[INFO]", ...args);
  },
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.log("[DEBUG]", ...args);
    }
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};
