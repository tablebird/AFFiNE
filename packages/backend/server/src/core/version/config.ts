import { defineRuntimeConfig, ModuleConfig } from '../../base/config';

export interface VersionConfig {
  enable: boolean;
  allowedVersion: string;
}

declare module '../../base/config' {
  interface AppConfig {
    version: ModuleConfig<never, VersionConfig>;
  }
}

declare module '../../base/guard' {
  interface RegisterGuardName {
    version: 'version';
  }
}

defineRuntimeConfig('version', {
  enable: {
    desc: 'Check version of the app',
    default: false,
  },
  allowedVersion: {
    desc: 'Allowed version range of the app that can access the server',
    default: '>=0.0.1',
  },
});
