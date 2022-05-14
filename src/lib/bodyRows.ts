import { derived } from 'svelte/store';
import { BodyCell } from './bodyCells';
import type { DataColumn } from './columns';
import { TableComponent } from './tableComponent';
import type { AnyPlugins } from './types/TablePlugin';
import { nonUndefined } from './utils/filter';

export interface BodyRowInit<Item, Plugins extends AnyPlugins = AnyPlugins> {
	id: string;
	original: Item;
	cells: BodyCell<Item, Plugins>[];
	cellForId: Record<string, BodyCell<Item, Plugins>>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface
export interface BodyRowAttributes<Item, Plugins extends AnyPlugins = AnyPlugins> {}

export class BodyRow<Item, Plugins extends AnyPlugins = AnyPlugins> extends TableComponent<
	Item,
	Plugins,
	'tbody.tr'
> {
	original: Item;
	cells: BodyCell<Item, Plugins>[];
	/**
	 * Get the cell with a given column id.
	 *
	 * **This includes hidden cells.**
	 */
	cellForId: Record<string, BodyCell<Item, Plugins>>;
	constructor({ id, original, cells, cellForId }: BodyRowInit<Item, Plugins>) {
		super({ id });
		this.original = original;
		this.cells = cells;
		this.cellForId = cellForId;
	}

	attrs() {
		return derived([], () => {
			return {};
		});
	}
}

/**
 * Converts an array of items into an array of table `BodyRow`s based on the column structure.
 * @param data The data to display.
 * @param flatColumns The column structure.
 * @returns An array of `BodyRow`s representing the table structure.
 */
export const getBodyRows = <Item, Plugins extends AnyPlugins = AnyPlugins>(
	data: Item[],
	/**
	 * Represents data columns before column transformations.
	 */
	flatColumns: DataColumn<Item, Plugins>[]
): BodyRow<Item, Plugins>[] => {
	const rows: BodyRow<Item, Plugins>[] = data.map((item, idx) => {
		return new BodyRow({
			id: idx.toString(),
			original: item,
			cells: [],
			cellForId: {},
		});
	});
	data.forEach((item, rowIdx) => {
		const cells = flatColumns.map((c) => {
			const value =
				c.accessorFn !== undefined
					? c.accessorFn(item)
					: c.accessorKey !== undefined
					? item[c.accessorKey]
					: undefined;
			return new BodyCell({ row: rows[rowIdx], column: c, label: c.cell, value });
		});
		rows[rowIdx].cells = cells;
		flatColumns.forEach((c, colIdx) => {
			rows[rowIdx].cellForId[c.id] = cells[colIdx];
		});
	});
	return rows;
};

/**
 * Arranges and hides columns in an array of `BodyRow`s based on
 * `columnIdOrder` by transforming the `cells` property of each row.
 *
 * `cellForId` should remain unaffected.
 *
 * @param rows The rows to transform.
 * @param columnIdOrder The column order to transform to.
 * @returns A new array of `BodyRow`s with corrected row references.
 */
export const getColumnedBodyRows = <Item, Plugins extends AnyPlugins = AnyPlugins>(
	rows: BodyRow<Item, Plugins>[],
	columnIdOrder: string[]
): BodyRow<Item, Plugins>[] => {
	const columnedRows: BodyRow<Item, Plugins>[] = rows.map(
		({ id, original }) => new BodyRow({ id, original, cells: [], cellForId: {} })
	);
	if (rows.length === 0 || columnIdOrder.length === 0) return rows;
	rows.forEach((row, rowIdx) => {
		// Create a shallow copy of `row.cells` to reassign each `cell`'s `row`
		// reference.
		const cells = row.cells.map((cell) => {
			return new BodyCell({
				row: columnedRows[rowIdx],
				column: cell.column,
				value: cell.value,
				label: cell.label,
			});
		});
		const visibleCells = columnIdOrder
			.map((cid) => {
				return cells.find((c) => c.id === cid);
			})
			.filter(nonUndefined);
		columnedRows[rowIdx].cells = visibleCells;
		// Include hidden cells in `cellForId` to allow row transformations on
		// hidden cells.
		cells.forEach((cell) => {
			columnedRows[rowIdx].cellForId[cell.id] = cell;
		});
	});
	return columnedRows;
};

/**
 * Converts an array of items into an array of table `BodyRow`s based on a parent row.
 * @param subItems The sub data to display.
 * @param parentRow The parent row.
 * @returns An array of `BodyRow`s representing the child rows of `parentRow`.
 */
export const getSubRows = <Item, Plugins extends AnyPlugins = AnyPlugins>(
	subItems: Item[],
	parentRow: BodyRow<Item, Plugins>
): BodyRow<Item, Plugins>[] => {
	const subRows = subItems.map((item, idx) => {
		const id = `${parentRow.id}.${idx}`;
		return new BodyRow<Item, Plugins>({
			id,
			original: item,
			cells: [],
			cellForId: {},
		});
	});
	subItems.forEach((item, rowIdx) => {
		// parentRow.cells only include visible cells.
		// We have to derive all cells from parentRow.cellForId
		const cellForId = Object.fromEntries(
			Object.values(parentRow.cellForId).map((cell) => {
				const { column } = cell;
				const value =
					column.accessorFn !== undefined
						? column.accessorFn(item)
						: column.accessorKey !== undefined
						? item[column.accessorKey]
						: undefined;
				return [
					column.id,
					new BodyCell({ row: subRows[rowIdx], column, label: column.cell, value }),
				];
			})
		);
		subRows[rowIdx].cellForId = cellForId;
		const cells = parentRow.cells.map((cell) => {
			return cellForId[cell.id];
		});
		subRows[rowIdx].cells = cells;
	});
	return subRows;
};
