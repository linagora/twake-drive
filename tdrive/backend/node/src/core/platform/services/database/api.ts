import { TdriveServiceProvider } from "../../framework";
import type { IServiceDiagnosticProvider } from "../../framework/api/diagnostics";
import { Connector } from "./services/orm/connectors";
import Manager from "./services/orm/manager";
import Repository from "./services/orm/repository/repository";
import { EntityTarget } from "./services/orm/types";

export interface DatabaseServiceAPI extends TdriveServiceProvider, IServiceDiagnosticProvider {
  /**
   * Get the database connector
   */
  getConnector(): Connector;

  /**
   * Get entities manager
   */
  getManager(): Manager<unknown>;

  /**
   * Get repository for given entity
   *
   * @param table
   * @param entity
   */
  getRepository<Entity>(table: string, entity: EntityTarget<Entity>): Promise<Repository<Entity>>;
}
