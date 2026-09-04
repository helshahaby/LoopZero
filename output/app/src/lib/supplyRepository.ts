import { createRepository } from "./repository.js";
import { parseSupplyRecord, type SupplyItem } from "../domain/supply.js";

export const SUPPLY_STORAGE_KEY = "pottery-studio-supplies";

export const supplyRepository = createRepository<SupplyItem>(SUPPLY_STORAGE_KEY, {
  version: 1,
  parseRecord: parseSupplyRecord,
});
