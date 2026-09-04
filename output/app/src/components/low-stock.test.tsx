import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App.js";
import { seedStorage } from "../test/helpers.js";
import { SUPPLY_STORAGE_KEY } from "../lib/supplyRepository.js";
import type { SupplyItem } from "../domain/supply.js";

function makeItem(overrides: Partial<SupplyItem> & { name: string }): SupplyItem {
  return {
    id: overrides.id ?? `id-${overrides.name.toLowerCase().replaceAll(" ", "-")}`,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    supplier: "Laguna",
    category: "glaze",
    quantity: 10,
    ...overrides,
  };
}

function statValue(label: string): string {
  return screen.getByText(label).closest(".stat")?.textContent ?? "";
}

function lowStockSection(): HTMLElement {
  return screen.getByRole("heading", { name: /Running low/ }).closest("section") as HTMLElement;
}

describe("spotting low stock", () => {
  it("flags anything with a couple left and counts it in the stats", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Cobalt blue", quantity: 2 }),
      makeItem({ name: "Stoneware", supplier: "Laguna Clay", category: "clay", quantity: 0 }),
      makeItem({ name: "Wire cutters", supplier: "Bench Tools", category: "tools", quantity: 10 }),
    ]);
    render(<App />);

    // The low-stock panel lists exactly the two items that need attention.
    const panel = lowStockSection();
    expect(within(panel).getByText("Cobalt blue")).toBeInTheDocument();
    expect(within(panel).getByText("Stoneware")).toBeInTheDocument();
    expect(within(panel).queryByText("Wire cutters")).not.toBeInTheDocument();
    expect(within(panel).getByText("Out of stock")).toBeInTheDocument();
    expect(within(panel).getByText("2 left")).toBeInTheDocument();

    // The table badges the same items.
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("Low")).toHaveLength(1);
    expect(within(table).getAllByText("Out of stock")).toHaveLength(1);

    // Derived numbers on screen.
    expect(statValue("Running low")).toContain("2");
    expect(statValue("Out of stock")).toContain("1");
    expect(statValue("Supplies tracked")).toContain("3");
  });

  it("treats 2 as low and 3 as fine", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Cobalt blue", quantity: 2 }),
      makeItem({ name: "Clear gloss", quantity: 3 }),
    ]);
    render(<App />);

    const panel = lowStockSection();
    expect(within(panel).getByText("Cobalt blue")).toBeInTheDocument();
    expect(within(panel).queryByText("Clear gloss")).not.toBeInTheDocument();

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Cobalt blue");
    expect(rows[0].textContent).toContain("Low");
    expect(rows[1].textContent).toContain("Clear gloss");
    expect(rows[1].textContent).not.toContain("Low");
  });

  it("shows only the supplies that need attention when the low-stock filter is on", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Cobalt blue", quantity: 1 }),
      makeItem({ name: "Stoneware", supplier: "Laguna Clay", category: "clay", quantity: 0 }),
      makeItem({ name: "Wire cutters", supplier: "Bench Tools", category: "tools", quantity: 10 }),
    ]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText("Low stock only"));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Cobalt blue")).toBeInTheDocument();
    expect(within(table).getByText("Stoneware")).toBeInTheDocument();
    expect(within(table).queryByText("Wire cutters")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Low stock only"));
    expect(screen.getByRole("table").textContent).toContain("Wire cutters");
  });

  it("lists out-of-stock supplies before low ones before the rest", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Zinc white", quantity: 5 }),
      makeItem({ name: "Cobalt blue", quantity: 0 }),
      makeItem({ name: "Clear gloss", quantity: 1 }),
    ]);
    render(<App />);
    const rows = screen.getByRole("table").querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Cobalt blue");
    expect(rows[1].textContent).toContain("Clear gloss");
    expect(rows[2].textContent).toContain("Zinc white");
  });

  it("jumps out when a supply drops to a couple left", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [makeItem({ name: "Cobalt blue", quantity: 3 })]);
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("table").textContent).not.toContain("Low");
    expect(lowStockSection().textContent).toContain("Nothing is running low");

    await user.click(screen.getByRole("button", { name: "Use one Cobalt blue" }));
    await user.click(screen.getByRole("button", { name: "Use one Cobalt blue" }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("Low")).toBeInTheDocument();
    expect(within(table).getByText("1")).toBeInTheDocument();
    expect(within(lowStockSection()).getByText("Cobalt blue")).toBeInTheDocument();
    expect(within(lowStockSection()).getByText("1 left")).toBeInTheDocument();
    expect(statValue("Running low")).toContain("1");
  });

  it("restocking from the low-stock panel clears the flag", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [makeItem({ name: "Cobalt blue", quantity: 1 })]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Restock Cobalt blue" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Cobalt blue" });
    await user.clear(within(dialog).getByLabelText("Quantity left"));
    await user.type(within(dialog).getByLabelText("Quantity left"), "10");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(screen.getByRole("table").textContent).not.toContain("Low");
    expect(lowStockSection().textContent).toContain("Nothing is running low");
    expect(statValue("Running low")).toContain("0");
  });
});
