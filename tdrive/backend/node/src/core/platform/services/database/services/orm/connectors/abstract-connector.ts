/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
import { Connector, UpsertOptions } from ".";
import { ConnectionOptions, DatabaseType } from "../..";
import { FindOptions } from "../repository/repository";
import { ColumnDefinition, EntityDefinition } from "../types";
import { ListResult, Paginable, Pagination } from "../../../../../framework/api/crud-service";
import type {
  TDiagnosticResult,
  TServiceDiagnosticDepth,
} from "../../../../../framework/api/diagnostics";

export abstract class AbstractConnector<T extends ConnectionOptions> implements Connector {
  constructor(protected type: DatabaseType, protected options: T, protected secret: string) {}

  abstract connect(): Promise<this>;
  abstract disconnect(): Promise<this>;
  abstract getDiagnostics(depth: TServiceDiagnosticDepth): Promise<TDiagnosticResult>;

  abstract drop(): Promise<this>;

  abstract createTable(
    entity: EntityDefinition,
    columns: { [name: string]: ColumnDefinition },
  ): Promise<boolean>;

  abstract upsert(entities: any[], _options: UpsertOptions): Promise<boolean[]>;

  abstract atomicCompareAndSet<Entity, FieldValueType>(
    entity: Entity,
    fieldName: keyof Entity,
    previousValue: FieldValueType,
    newValue: FieldValueType,
  ): Promise<{
    didSet: boolean;
    currentValue: FieldValueType | null;
  }>;

  abstract remove(entities: any[]): Promise<boolean[]>;

  abstract find<EntityType>(
    entityType: any,
    filters: any,
    options: FindOptions,
  ): Promise<ListResult<EntityType>>;

  abstract getOffsetPagination(options: Paginable): Pagination;

  getOptions(): T {
    return this.options;
  }

  getType(): DatabaseType {
    return this.type;
  }
  getClient() {
    return this.getClient();
  }
}
