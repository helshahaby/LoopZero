import { useState, type FormEvent } from "react";
import { Button, Form, SelectField, TextField } from "../ui/index.js";
import { hasErrors } from "../lib/validation.js";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  supplyKey,
  validateSupply,
  type Category,
  type SupplyInput,
  type SupplyItem,
} from "../domain/supply.js";

interface SupplyFormProps {
  initial?: SupplyItem;
  /** Normalised name+supplier keys already taken (excluding the record being edited). */
  existingKeys: readonly string[];
  submitLabel: string;
  onSubmit: (input: SupplyInput) => void;
  onCancel?: () => void;
}

export function SupplyForm({ initial, existingKeys, submitLabel, onSubmit, onCancel }: SupplyFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "glaze");
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
  const [errors, setErrors] = useState<ReturnType<typeof validateSupply>>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values = { name, supplier, category, quantity, key: supplyKey(name, supplier) };
    const nextErrors = validateSupply(values, existingKeys);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    onSubmit({
      name: name.trim(),
      supplier: supplier.trim(),
      category: category as Category,
      quantity: Number(quantity),
    });
  }

  return (
    <Form onSubmit={handleSubmit}>
      <div className="grid">
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name ?? errors.key}
          hint="What it's called, e.g. Cobalt blue"
        />
        <TextField
          label="Supplier"
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          error={errors.supplier}
          hint="Where you get it from"
        />
        <SelectField
          label="Type"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          options={CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
          error={errors.category}
        />
        <TextField
          label="Quantity left"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={errors.quantity}
          hint="How many you have on the shelf"
          inputMode="numeric"
        />
      </div>
      <div className="form__actions">
        <Button type="submit">{submitLabel}</Button>
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </Form>
  );
}
