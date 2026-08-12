import { OxVehicle, Vec3 } from './class';
import {
  CreateNewVehicle,
  DeleteVehicle,
  GetStoredVehicleFromId,
  IsPlateAvailable,
  SelectVehicleRow,
  SelectVehicleRows,
  type VehicleRow,
} from './db';
import { GetVehicleData } from '../../common/vehicles';
import { DEBUG } from '../../common/config';
import './class';
import './commands';
import './events';
import type { VehicleProperties } from '@overextended/ox_lib/server';

if (DEBUG) import('./parser');

export interface CreateVehicleData {
  model: string;
  owner?: number;
  group?: string;
  stored?: string;
  properties?: Partial<VehicleProperties>;
}

export async function CreateVehicle(
  data: string | (CreateVehicleData & Partial<VehicleRow>),
  coords?: Vec3,
  heading?: number,
  invokingScript = GetInvokingResource(),
) {
  if (typeof data === 'string') data = { model: data };

  const vehicleData = GetVehicleData(data.model as string);

  if (!vehicleData)
    throw new Error(
      `Failed to create vehicle '${data.model}' (model is invalid).\nEnsure vehicle exists in '@ox_core/common/data/vehicles.json'`,
    );

  if (data.id) {
    const vehicle = OxVehicle.getFromVehicleId(data.id);

    if (vehicle) {
      if (vehicle.entity && DoesEntityExist(vehicle.entity)) {
        return vehicle;
      }

      vehicle.despawn(true);
    }
  }

  const isOwned = !!(data.owner || data.group);

  if (!data.vin) data.vin = await OxVehicle.generateVin(vehicleData, isOwned);

  data.plate =
    data.vin && data.plate
      ? data.plate
      : data.plate && (await IsPlateAvailable(data.plate))
        ? data.plate
        : await OxVehicle.generatePlate();

  const metadata = data.data || ({} as { properties?: Partial<VehicleProperties>; [key: string]: any });
  metadata.properties = data.properties || data.data?.properties || ({} as Partial<VehicleProperties>);

  if (!data.id && data.vin && isOwned) {
    data.id = await CreateNewVehicle(
      data.plate,
      data.vin,
      data.owner || null,
      data.group || null,
      data.model,
      vehicleData.class,
      metadata,
      data.stored || null,
    );
  }

  const properties = data.properties || metadata.properties || ({} as Partial<VehicleProperties>);
  delete metadata.properties;

  const vehicle = new OxVehicle(
    data.vin,
    invokingScript,
    data.plate,
    data.model,
    vehicleData.make,
    data.stored || null,
    metadata,
    properties,
    data.id,
    data.owner,
    data.group,
  );

  if (coords) {
    vehicle.respawn(coords, heading || 0);
  }

  if (vehicle.entity) vehicle.setStored(null, false);

  return vehicle;
}

export async function SpawnVehicle(id: number | string, coords?: Vec3, heading?: number) {
  const invokingScript = GetInvokingResource();
  const vehicle = await GetStoredVehicleFromId(id, typeof id === 'string' ? 'vin' : 'id');

  if (!vehicle) return;

  return await CreateVehicle(vehicle, coords, heading, invokingScript);
}

/**
 * Return a vehicle's persisted row by id or vin, spawned or not.
 *
 * Every other vehicle accessor answers from the live instance registry, so a
 * vehicle nobody has spawned this session is invisible to all of them.
 */
export function GetStoredVehicle(idOrVin: number | string) {
  return SelectVehicleRow(idOrVin);
}

/**
 * Return every vehicle a character owns, parked or out in the world.
 *
 * `stored` names the facility for the ones parked and is null for the rest,
 * which is what makes one read able to answer "where is each of my vehicles".
 */
export function GetStoredVehiclesForOwner(charId: number) {
  return SelectVehicleRows('owner', charId);
}

/** Return every vehicle a group owns, parked or out in the world. */
export function GetStoredVehiclesForGroup(group: string) {
  return SelectVehicleRows('group', group);
}

/**
 * Delete a vehicle's persisted row by id or vin, spawned or not.
 *
 * `OxVehicle.delete` reaches the live instance registry, so it cannot remove a
 * vehicle nobody has spawned this session -- the whole set a garage holds.
 * Answers whether the row is gone, which a caller disposing of an asset needs
 * to distinguish from a delete that reached nothing.
 *
 * The live instance is resolved by vehicleId rather than `OxVehicle.get`,
 * which spawns a stored vehicle when the registry misses.
 */
export async function DeleteStoredVehicle(idOrVin: number | string) {
  const row = await SelectVehicleRow(idOrVin);

  if (!row) return false;

  const vehicle = OxVehicle.getFromVehicleId(row.id);

  return vehicle ? await vehicle.delete() : await DeleteVehicle(row.id);
}

exports('CreateVehicle', CreateVehicle);
exports('SpawnVehicle', SpawnVehicle);
exports('GetStoredVehicle', GetStoredVehicle);
exports('GetStoredVehiclesForOwner', GetStoredVehiclesForOwner);
exports('GetStoredVehiclesForGroup', GetStoredVehiclesForGroup);
exports('DeleteStoredVehicle', DeleteStoredVehicle);
