import { db } from '../db';
import type { VehicleProperties } from '@overextended/ox_lib';
import type { OxVehicleRow } from 'types';
import { DEFAULT_VEHICLE_STORE } from 'config';

export type VehicleRow = {
  id: number;
  owner?: number;
  group?: string;
  plate: string;
  vin: string;
  model: string;
  data: { properties: Partial<VehicleProperties>; [key: string]: any };
};

const selectVehicleRow = 'SELECT id, owner, `group`, plate, vin, model, class, data, `stored` FROM vehicles';

if (DEFAULT_VEHICLE_STORE)
  setImmediate(() => db.query('UPDATE vehicles SET `stored` = ? WHERE `stored` IS NULL', [DEFAULT_VEHICLE_STORE]));

export async function IsPlateAvailable(plate: string) {
  return !(await db.exists('SELECT 1 FROM vehicles WHERE plate = ?', [plate]));
}

export async function IsVinAvailable(plate: string) {
  return !(await db.exists('SELECT 1 FROM vehicles WHERE vin = ?', [plate]));
}

/**
 * `data` is a JSON column the driver usually decodes, but not always; one
 * decoder keeps the string case from being handled differently per caller.
 */
function parseVehicleData<T extends { data: any }>(row: T) {
  if (typeof row.data === 'string') {
    console.warn(
      'vehicle.data was selected from the database as a string rather than JSON.\nLet us know if this warning occurred..',
    );
    row.data = JSON.parse(row.data);
  }

  return row;
}

export async function GetStoredVehicleFromId(id: number | string, column = 'id') {
  const row = await db.row<VehicleRow>(
    `SELECT id, owner, \`group\`, plate, vin, model, data FROM vehicles WHERE ${column} = ? AND \`stored\` IS NOT NULL`,
    [id],
  );

  return row ? parseVehicleData(row) : row;
}

/**
 * Select a vehicle's persisted row by id or vin, spawned or not.
 *
 * `stored` is returned rather than filtered on: a caller enumerating what a
 * character owns needs the vehicle that is currently out as much as the ones
 * parked, and this is the only read that reaches a vehicle no longer in the
 * live instance registry.
 */
export async function SelectVehicleRow(idOrVin: number | string) {
  const column = typeof idOrVin === 'string' ? 'vin' : 'id';
  const row = await db.row<OxVehicleRow>(`${selectVehicleRow} WHERE \`${column}\` = ?`, [idOrVin]);

  return row ? parseVehicleData(row) : null;
}

export async function SelectVehicleRows(column: 'owner' | 'group', value: number | string) {
  const rows = await db.execute<OxVehicleRow>(`${selectVehicleRow} WHERE \`${column}\` = ? ORDER BY id`, [value]);

  return rows.map(parseVehicleData);
}

export async function SetVehicleColumn(id: number | void, column: string, value: any) {
  if (!id) return;

  return (await db.update(`UPDATE vehicles SET \`${column}\` = ? WHERE id = ?`, [value, id])) === 1;
}

export function SaveVehicleData(
  values: any, // -.-
  batch?: boolean,
) {
  const query = 'UPDATE vehicles SET `stored` = ?, data = ? WHERE id = ?';

  return batch ? db.batch(query, values) : db.update(query, values);
}

export function CreateNewVehicle(
  plate: string,
  vin: string,
  owner: number | null,
  group: string | null,
  model: string,
  vehicleClass: number,
  data: object,
  stored: string | null,
) {
  return db.insert(
    'INSERT INTO vehicles (plate, vin, owner, `group`, model, class, data, `stored`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [plate, vin, owner, group, model, vehicleClass, JSON.stringify(data), stored],
  );
}

export async function DeleteVehicle(id: number) {
  return (await db.update('DELETE FROM vehicles WHERE id = ?', [id])) === 1;
}
