import { Button, DataList } from "../ui/index.js";
import { CATEGORY_LABELS, stockStatus, type SupplyItem } from "../domain/supply.js";

interface LowStockPanelProps {
  items: readonly SupplyItem[];
  onEdit: (item: SupplyItem) => void;
}

/** The supplies that need attention: out of stock or down to a couple. */
export function LowStockPanel({ items, onEdit }: LowStockPanelProps) {
  if (items.length === 0) {
    return <p className="muted">Nothing is running low. You're all stocked up.</p>;
  }
  return (
    <DataList
      label="Supplies running low"
      items={items}
      empty={null}
      renderItem={(item) => {
        const status = stockStatus(item.quantity);
        return (
          <>
            <div>
              <strong>{item.name}</strong>{" "}
              <span className="muted">
                from {item.supplier} · {CATEGORY_LABELS[item.category]}
              </span>
              <div>
                {status === "out" ? (
                  <span className="stock-badge stock-badge--out">Out of stock</span>
                ) : (
                  <span className="stock-badge stock-badge--low">{item.quantity} left</span>
                )}
              </div>
            </div>
            <Button variant="secondary" aria-label={`Restock ${item.name}`} onClick={() => onEdit(item)}>
              Restock
            </Button>
          </>
        );
      }}
    />
  );
}
