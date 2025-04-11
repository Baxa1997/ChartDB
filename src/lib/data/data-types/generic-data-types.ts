import type { DataTypeData } from './data-types';

export const genericDataTypes: readonly DataTypeData[] = [
    { name: 'bigint', id: 'bigint' },
    { name: 'binary', id: 'binary', hasCharMaxLength: true },
    { name: 'blob', id: 'blob' },
    { name: 'boolean', id: 'boolean' },
    { name: 'char', id: 'char', hasCharMaxLength: true },
    { name: 'date', id: 'date' },
    { name: 'datetime', id: 'datetime' },
    { name: 'decimal', id: 'decimal' },
    { name: 'double', id: 'double' },
    { name: 'enum', id: 'enum' },
    { name: 'float', id: 'float' },
    { name: 'int', id: 'int' },
    { name: 'json', id: 'json' },
    { name: 'numeric', id: 'numeric' },
    { name: 'real', id: 'real' },
    { name: 'set', id: 'set' },
    { name: 'smallint', id: 'smallint' },
    { name: 'text', id: 'text' },
    { name: 'time', id: 'time' },
    { name: 'timestamp', id: 'timestamp' },
    { name: 'uuid', id: 'uuid' },
    { name: 'varbinary', id: 'varbinary', hasCharMaxLength: true },
    { name: 'varchar', id: 'varchar', hasCharMaxLength: true },
] as const;
