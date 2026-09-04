import { useMemo, useState } from "react";
import { useCollection } from "./hooks/useCollection.js";
import { supplyRepository } from "./lib/supplyRepository.js";
import { filterRecords, sortRecords } from "./lib/collection.js";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  LOW_STOCK_THRESHOLD,
  needsAttention,
  stockStatus,
  supplyKey,
  type SupplyInput,
  type SupplyItem,
} from "./domain/supply.js";
import { AppShell, Button, Dialog, EmptyState, Notice, Section, SelectField, StatCard } from "./ui/index.js";
import { SupplyForm } from "./components/SupplyForm.js";
import { SupplyTable } from "./components/SupplyTable.js";
import { LowStockPanel } from "./components/LowStockPanel.js";

/** Out of stock first, then low, then the rest; alphabetical within each band. */
const urgencySortKey = (item: SupplyItem): string => {
  const status = stockStatus(item.quantity);
  const rank = status === "out" ? 0 : status === "low" ? 1 : 2;
  return `${rank}|${item.name.toLowerCase()}`;
};

export function App() {
  const { records, loading, notice, create, update, remove, dismissNotice } = useCollection(supplyRepository);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<SupplyItem | null>(null);
  const [deleting, setDeleting] = useState<SupplyItem | null>(null);

  const lowItems = useMemo(
    () => sortRecords(records.filter(needsAttention), urgencySortKey),
    [records],
  );
  const outCount = useMemo(() => records.filter((item) => stockStatus(item.quantity) === "out").length, [records]);

  const visible = useMemo(
    () =>
      sortRecords(
        filterRecords(records, [
          (item) => categoryFilter === "all" || item.category === categoryFilter,
          (item) => !lowOnly || needsAttention(item),
        ]),
        urgencySortKey,
      ),
    [records, categoryFilter, lowOnly],
  );

  const existingKeys = (excludeId?: string) =>
    records.filter((item) => item.id !== excludeId).map((item) => supplyKey(item.name, item.supplier));

  function handleCreate(input: SupplyInput) {
    create(input);
  }

  function handleEditSubmit(input: SupplyInput) {
    if (editing) update(editing.id, input);
    setEditing(null);
  }

  function handleDeleteConfirm() {
    if (deleting) remove(deleting.id);
    setDeleting(null);
  }

  function handleAdjust(id: string, delta: number) {
    const item = records.find((record) => record.id === id);
    if (item) update(id, { quantity: Math.max(0, item.quantity + delta) });
  }

  const filtersActive = categoryFilter !== "all" || lowOnly;

  return (
    <AppShell
      title="Studio Supplies"
      description="Track your glazes, clay and tools, and spot what's running low before it runs out."
    >
      {notice ? (
        <Notice tone="warning" onDismiss={dismissNotice}>
          {notice}
        </Notice>
      ) : null}

      <div className="grid">
        <StatCard label="Supplies tracked" value={records.length} />
        <StatCard label="Running low" value={lowItems.length} />
        <StatCard label="Out of stock" value={outCount} />
      </div>

      <Section title={`Running low (at or under ${LOW_STOCK_THRESHOLD} left)`}>
        <LowStockPanel items={lowItems} onEdit={setEditing} />
      </Section>

      <Section title="Add a supply">
        <SupplyForm existingKeys={existingKeys()} submitLabel="Add supply" onSubmit={handleCreate} />
      </Section>

      <Section
        title="All supplies"
        actions={
          <div className="filters">
            <SelectField
              label="Filter by type"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              options={[
                { value: "all", label: "All types" },
                ...CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
              ]}
            />
            <label className="filter-toggle">
              <input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
              Low stock only
            </label>
          </div>
        }
      >
        {loading ? (
          <p className="muted">Loading your supplies…</p>
        ) : visible.length === 0 ? (
          records.length === 0 ? (
            <EmptyState
              title="No supplies yet"
              description="Add your first glaze, clay or tool above and it will show up here."
            />
          ) : (
            <EmptyState
              title="Nothing matches these filters"
              description="No supplies match the current type and stock filters."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCategoryFilter("all");
                    setLowOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <SupplyTable
            items={visible}
            onAdjust={handleAdjust}
            onEdit={setEditing}
            onDelete={setDeleting}
            empty={null}
          />
        )}
      </Section>

      <Dialog open={editing !== null} title={editing ? `Edit ${editing.name}` : "Edit supply"} onClose={() => setEditing(null)}>
        {editing ? (
          <SupplyForm
            key={editing.id}
            initial={editing}
            existingKeys={existingKeys(editing.id)}
            submitLabel="Save changes"
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <Dialog open={deleting !== null} title="Delete supply" onClose={() => setDeleting(null)}>
        <p>
          {deleting ? (
            <>
              Remove <strong>{deleting.name}</strong> from {deleting.supplier}? You won't be able to bring it back.
            </>
          ) : null}
        </p>
        <div className="form__actions">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
