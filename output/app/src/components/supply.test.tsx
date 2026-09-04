import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App.js";
import { corruptStorage, readStorage, seedStorage } from "../test/helpers.js";
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

async function addSupply(
  user: userEvent.UserEvent,
  values: { name: string; supplier: string; category: string; quantity: string },
) {
  const name = screen.getByLabelText("Name");
  const supplier = screen.getByLabelText("Supplier");
  const quantity = screen.getByLabelText("Quantity left");
  await user.clear(name);
  await user.clear(supplier);
  await user.clear(quantity);
  await user.type(name, values.name);
  await user.type(supplier, values.supplier);
  await user.selectOptions(screen.getByLabelText("Type"), values.category);
  await user.type(quantity, values.quantity);
  await user.click(screen.getByRole("button", { name: "Add supply" }));
}

function statValue(label: string): string {
  return screen.getByText(label).closest(".stat")?.textContent ?? "";
}

describe("supply register", () => {
  it("adds a complete supply and shows it in the list", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSupply(user, { name: "Cobalt blue", supplier: "Laguna", category: "glaze", quantity: "12" });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Cobalt blue")).toBeInTheDocument();
    expect(within(table).getByText("from Laguna")).toBeInTheDocument();
    expect(within(table).getByText("Glaze")).toBeInTheDocument();
    expect(within(table).getByText("12")).toBeInTheDocument();
    expect(statValue("Supplies tracked")).toContain("1");

    // The new record was persisted to browser storage.
    const stored = readStorage<SupplyItem>(SUPPLY_STORAGE_KEY);
    expect(stored?.records).toHaveLength(1);
    expect(stored?.records[0]).toMatchObject({ name: "Cobalt blue", supplier: "Laguna", category: "glaze", quantity: 12 });
  });

  it("rejects invalid input with a visible message and adds nothing", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add supply" }));
    expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("Give the supply a name"))).toBe(true);
    expect(screen.getAllByRole("alert").some((node) => node.textContent?.includes("Add the supplier"))).toBe(true);

    await user.type(screen.getByLabelText("Name"), "Cobalt blue");
    await user.type(screen.getByLabelText("Supplier"), "Laguna");
    await user.type(screen.getByLabelText("Quantity left"), "-3");
    await user.click(screen.getByRole("button", { name: "Add supply" }));
    expect(
      screen.getAllByRole("alert").some((node) => node.textContent?.includes("Quantity must be between 0 and 100,000")),
    ).toBe(true);

    await user.clear(screen.getByLabelText("Quantity left"));
    await user.type(screen.getByLabelText("Quantity left"), "2.5");
    await user.click(screen.getByRole("button", { name: "Add supply" }));
    expect(
      screen.getAllByRole("alert").some((node) => node.textContent?.includes("Quantity must be a whole number")),
    ).toBe(true);

    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
    expect(readStorage(SUPPLY_STORAGE_KEY)).toBeUndefined();
  });

  it("rejects the same name from the same supplier but allows another supplier", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSupply(user, { name: "Cobalt blue", supplier: "Laguna", category: "glaze", quantity: "5" });

    await addSupply(user, { name: "Cobalt blue", supplier: "Laguna", category: "glaze", quantity: "3" });
    expect(
      screen.getAllByRole("alert").some((node) => node.textContent?.includes("You already track this item from this supplier")),
    ).toBe(true);

    await addSupply(user, { name: "Cobalt blue", supplier: "Amaco", category: "glaze", quantity: "3" });
    expect(screen.getAllByText("Cobalt blue")).toHaveLength(2);
    expect(statValue("Supplies tracked")).toContain("2");
  });

  it("edits a supply and keeps the change", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [makeItem({ name: "Cobalt blue", quantity: 8 })]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Edit Cobalt blue" }));
    const dialog = screen.getByRole("dialog", { name: "Edit Cobalt blue" });
    await user.clear(within(dialog).getByLabelText("Quantity left"));
    await user.type(within(dialog).getByLabelText("Quantity left"), "3");
    await user.clear(within(dialog).getByLabelText("Supplier"));
    await user.type(within(dialog).getByLabelText("Supplier"), "Amaco");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("3")).toBeInTheDocument();
    expect(within(table).getByText("from Amaco")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes a supply after confirmation", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [makeItem({ name: "Cobalt blue" })]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Delete Cobalt blue" }));
    const dialog = screen.getByRole("dialog", { name: "Delete supply" });
    expect(within(dialog).getByText("Cobalt blue")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
    expect(readStorage(SUPPLY_STORAGE_KEY)?.records).toHaveLength(0);
  });

  it("narrows the list to one type at a time", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Cobalt blue", category: "glaze" }),
      makeItem({ name: "Stoneware", supplier: "Laguna Clay", category: "clay" }),
      makeItem({ name: "Wire cutters", supplier: "Bench Tools", category: "tools" }),
    ]);
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Filter by type"), "clay");
    const table = screen.getByRole("table");
    expect(within(table).getByText("Stoneware")).toBeInTheDocument();
    expect(within(table).queryByText("Cobalt blue")).not.toBeInTheDocument();
    expect(within(table).queryByText("Wire cutters")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by type"), "all");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("Cobalt blue")).toHaveLength(1);
  });

  it("adjusts the quantity with the quick +1 and −1 buttons", async () => {
    seedStorage(SUPPLY_STORAGE_KEY, [makeItem({ name: "Cobalt blue", quantity: 4 })]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Use one Cobalt blue" }));
    expect(screen.getByRole("table").textContent).toContain("3");
    await user.click(screen.getByRole("button", { name: "Add one Cobalt blue" }));
    expect(screen.getByRole("table").textContent).toContain("4");
  });

  it("keeps saved supplies across a reload", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Cobalt blue", quantity: 12 }),
      makeItem({ name: "Stoneware", supplier: "Laguna Clay", category: "clay", quantity: 6 }),
    ]);
    render(<App />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Cobalt blue")).toBeInTheDocument();
    expect(within(table).getByText("Stoneware")).toBeInTheDocument();
    expect(statValue("Supplies tracked")).toContain("2");
  });

  it("still renders when the saved data is unreadable", () => {
    corruptStorage(SUPPLY_STORAGE_KEY, "{not json");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Studio Supplies" })).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toContain("unreadable");
    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
  });

  it("skips damaged entries but keeps the ones that survived", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      makeItem({ name: "Cobalt blue", quantity: 12 }),
      { id: "broken", name: 42, supplier: null, category: "glaze", quantity: "lots" },
    ]);
    render(<App />);
    expect(screen.getByRole("alert").textContent).toContain("1 damaged entry was skipped");
    expect(screen.getByRole("table").textContent).toContain("Cobalt blue");
    expect(statValue("Supplies tracked")).toContain("1");
  });
});
