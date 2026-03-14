export type AppBackendProvider = "aws";

export function getAppBackendProvider(): AppBackendProvider {
  return "aws";
}

export function isAwsBackendEnabled() {
  return true;
}
