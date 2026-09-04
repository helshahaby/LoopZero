import type { ReactNode } from "react";
import { Button, DataTable } from "../ui/index.js";
import { CATEGORY_LABELS, stockStatus, type SupplyItem } from "../domain/supply.js";

interface SupplyTableProps {
  items: readonly SupplyItem[];
  onAdjust: (id: string, delta: number) => void;
  onEdit: (item: SupplyItem) => void;
  onDelete: (item: SupplyItem) => void;
  empty: ReactNode;
}

export function StockBadge({ item }: { item: SupplyItem }) {
  const status = stockStatus(item.quantity);
  if (status === "out") return <span className="stock-badge stock-badge--out">Out of stock</span>;
  if (status === "low") return <span className="stock-badge stock-badge--low">Low</span>;
  return null;
}

export function SupplyTable({ items, onAdjust, onEdit, onDelete, empty }: SupplyTableProps) {
  return (
    <DataTable
      caption="Supplies you're tracking, most urgent first"
      columns={[
        {
          key: "name",
          header: "Supply",
          render: (item) => (
            <div>
              <strong>{item.name}</strong>
              <div className="muted">from {item.supplier}</div>
            </div>
          ),
        },
        {
          key: "category",
          header: "Type",
          render: (item) => CATEGORY_LABELS[item.category],
        },
        {
          key: "quantity",
          header: "Left",
          render: (item) => (
            <div>
              <span>{item.quantity}</span>
              <StockBadge item={item} />
            </div>
          ),
        },
        {
          key: "actions",
          header: "Actions",
          render: (item) => (
            <div className="row-actions">
              <Button
                variant="secondary"
                aria-label={`Use one ${item.name}`}
                disabled={item.quantity === 0}
                onClick={() => onAdjust(item.id, -1)}
              >
                −1
              </Button>
              <Button variant="secondary" aria-label={`Add one ${item.name}`} onClick={() => onAdjust(item.id, 1)}>
                +1
              </Button>
              <Button variant="secondary" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>
                Edit
              </Button>
              <Button variant="danger" aria-label={`Delete ${item.name}`} onClick={() => onDelete(item)}>
                Delete
              </Button>
            </div>
          ),
        },
      ]}
      rows={items}
      empty={empty}
    />
  );
}
