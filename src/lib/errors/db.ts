export function isDbUnavailableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || error.errno;
  if (typeof code === "string") {
    if (["ECONNREFUSED", "EHOSTUNREACH", "ETIMEDOUT"].includes(code)) {
      return true;
    }
  }
  const message = typeof error.message === "string" ? error.message : "";
  if (message.includes("getaddrinfo ENOTFOUND") || message.includes("connect ECONNREFUSED")) {
    return true;
  }
  return false;
}
