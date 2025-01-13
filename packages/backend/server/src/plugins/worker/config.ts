import { defineStartupConfig, ModuleConfig } from '../../base/config';

export interface WorkerStartupConfigurations {
  allowedOrigin: string[];
}

declare module '../config' {
  interface PluginsConfig {
    worker: ModuleConfig<WorkerStartupConfigurations>;
  }
}

defineStartupConfig('plugins.worker', {
  allowedOrigin: [],
});
