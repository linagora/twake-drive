import {
  TdriveContext,
  TdriveService,
  TdriveServiceConfiguration,
  TdriveServiceOptions,
  TdriveServiceProvider,
} from "./api";
import { Configuration } from "./configuration";

class StaticTdriveServiceFactory {
  public async create<
    T extends TdriveService<TdriveServiceProvider> = TdriveService<TdriveServiceProvider>,
  >(
    module: { new (options?: TdriveServiceOptions<TdriveServiceConfiguration>): T },
    context: TdriveContext,
    configuration?: string,
  ): Promise<T> {
    let config;

    if (configuration) {
      config = new Configuration(configuration);
    }
    let instance: T;
    try {
      instance = new module({ configuration: config });
    } catch (e) {
      e.toLocaleString();
      throw e;
    }
    instance.context = context;

    return instance;
  }
}

export const TdriveServiceFactory = new StaticTdriveServiceFactory();
