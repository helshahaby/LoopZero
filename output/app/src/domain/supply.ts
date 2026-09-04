import type { Entity } from "../lib/repository.js";
import { normalizeKey } from "../lib/id.js";
import {
  isNumber,
  maxLength,
  numberRange,
  oneOf,
  required,
  unique,
  validateFields,
  type FieldErrors,
} from "../lib/validation.js";

export const CATEGORIES = ["glaze", "clay", "tools", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  glaze: "Glaze",
  clay: "Clay",
  tools: "Tools",
  other: "Other",
};

/** "A couple left" — at or under this count a supply needs attention. */
export const LOW_STOCK_THRESHOLD = 2;

export interface SupplyItem extends Entity {
  name: string;
  supplier: string;
  category: Category;
  quantity: number;
}

export type SupplyInput = Omit<SupplyItem, keyof Entity>;

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return "out";
  if (quantity <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export function needsAttention(item: Pick<SupplyItem, "quantity">): boolean {
  return stockStatus(item.quantity) !== "ok";
}

/** Normalised identity of a supply: the same name from the same supplier is a duplicate. */
export function supplyKey(name: string, supplier: string): string {
  return normalizeKey(`${name} from ${supplier}`);
}

export interface SupplyFormValues {
  name: string;
  supplier: string;
  category: string;
  quantity: string;
  /** Computed name+supplier identity, validated for duplicates. */
  key: string;
}

const isWholeNumber = (value: string): string | undefined =>
  value.trim() !== "" && !Number.isInteger(Number(value)) ? "Quantity must be a whole number" : undefined;

export function validateSupply(
  values: SupplyFormValues,
  existingKeys: readonly string[],
): FieldErrors<SupplyFormValues> {
  return validateFields(values, {
    name: [required("Give the supply a name"), maxLength(80, "Keep the name under 80 characters")],
    supplier: [required("Add the supplier"), maxLength(80, "Keep the supplier under 80 characters")],
    category: [oneOf(CATEGORIES, "Choose a type")],
    quantity: [
      required("Enter how many you have left"),
      isNumber("Quantity must be a number"),
      isWholeNumber,
      numberRange(0, 100000, "Quantity must be between 0 and 100,000"),
    ],
    key: [unique(existingKeys, "You already track this item from this supplier")],
  });
}

/** Accepts a stored value only when every field is usable; otherwise the entry is dropped. */
export function parseSupplyRecord(value: unknown): SupplyItem | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id === "") return undefined;
  if (typeof v.created_at !== "string" || v.created_at === "") return undefined;
  if (typeof v.updated_at !== "string" || v.updated_at === "") return undefined;
  if (typeof v.name !== "string" || v.name.trim() === "") return undefined;
  if (typeof v.supplier !== "string" || v.supplier.trim() === "") return undefined;
  if (typeof v.category !== "string" || !(CATEGORIES as readonly string[]).includes(v.category)) return undefined;
  if (typeof v.quantity !== "number" || !Number.isInteger(v.quantity) || v.quantity < 0) return undefined;
  return {
    id: v.id,
    created_at: v.created_at,
    updated_at: v.updated_at,
    name: v.name.trim(),
    supplier: v.supplier.trim(),
    category: v.category as Category,
    quantity: v.quantity,
  };
}
