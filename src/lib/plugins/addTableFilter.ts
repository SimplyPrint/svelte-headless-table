import type { BodyRow } from '../bodyRows';
import type { TablePlugin, NewTablePropSet, DeriveRowsFn } from '../types/TablePlugin';
import { recordSetStore } from '../utils/store';
import { derived, writable, type Readable, type Writable } from 'svelte/store';

export interface TableFilterConfig {
	fn?: TableFilterFn;
	rowFn?: TableFilterFn|null;
	initialFilterValue?: string;
	includeHiddenColumns?: boolean;
	serverSide?: boolean;
}

export interface TableFilterState<Item> {
	filterValue: Writable<string>;
	preFilteredRows: Readable<BodyRow<Item>[]>;
}

// Item generic needed to infer type on `getFilteredRows`
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface TableFilterColumnOptions<Item> {
	exclude?: boolean;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	getFilterValue?: (props: {cell: any, value: any}) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableFilterFn = (props: TableFilterFnProps) => boolean;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableFilterFnProps = {
	row: BodyRow<any>;
	filterValue: string;
	value: string;
};

export type TableFilterPropSet = NewTablePropSet<{
	'tbody.tr.td': {
		matches: boolean;
	};
}>;

interface GetFilteredRowsOptions {
	tableCellMatches: Record<string, boolean>;
	fn: TableFilterFn;
	rowFn: TableFilterFn|null;
	includeHiddenColumns: boolean;
}

const getFilteredRows = <Item, Row extends BodyRow<Item>>(
	rows: Row[],
	filterValue: string,
	columnOptions: Record<string, TableFilterColumnOptions<Item>>,
	{ tableCellMatches, fn, rowFn, includeHiddenColumns }: GetFilteredRowsOptions
): Row[] => {
	const $filteredRows = rows
		// Filter `subRows`
		.map((row) => {
			const { subRows } = row;
			if (subRows === undefined) {
				return row;
			}
			const filteredSubRows = getFilteredRows(subRows, filterValue, columnOptions, {
				tableCellMatches,
				fn,
				rowFn,
				includeHiddenColumns,
			});
			const clonedRow = row.clone() as Row;
			clonedRow.subRows = filteredSubRows;
			return clonedRow;
		})
		.filter((row) => {
			if ((row.subRows?.length ?? 0) !== 0) {
				return true;
			}
			// An array of booleans, true if the cell matches the filter.
			const rowCellMatches = Object.values(row.cellForId).map((cell) => {
				const options = columnOptions[cell.id] as TableFilterColumnOptions<Item> | undefined;
				if (options?.exclude === true) {
					return false;
				}
				const isHidden = row.cells.find((c) => c.id === cell.id) === undefined;
				if (isHidden && !includeHiddenColumns) {
					return false;
				}
				if (!cell.isData() && !options?.getFilterValue) {
					// Don't allow non-data-fields, _unless_ there's a "getFilterValue" method defined.
					return false;
				}
				let value = cell.isData() ? cell.value : null;
				if (options?.getFilterValue !== undefined) {
					value = options?.getFilterValue({cell, value});
				}
				if (value === null) {
					return false;
				}

				const matches = fn({ value: String(value), filterValue, row });
				if (matches) {
					const dataRowColId = cell.dataRowColId();
					if (dataRowColId !== undefined) {
						tableCellMatches[dataRowColId] = matches;
					}
				}
				return matches;
			});

			// Perform general row filtering.
			if (rowFn !== null) {
				const matches = rowFn({ value: '', filterValue, row });
				if (matches) {
					return rowCellMatches.includes(true); // also only match if our rowCellMatches has a true value
				} else {
					return false;
				}
			}

			// If any cell matches, include in the filtered results.
			return rowCellMatches.includes(true);
		});
	return $filteredRows;
};

export const addTableFilter =
	<Item>({
			   fn = textPrefixFilter,
			   rowFn = null,
			   initialFilterValue = '',
			   includeHiddenColumns = false,
			   serverSide = false,
		   }: TableFilterConfig = {}): TablePlugin<
		Item,
		TableFilterState<Item>,
		TableFilterColumnOptions<Item>,
		TableFilterPropSet
	> =>
		({ columnOptions }) => {
			const filterValue = writable(initialFilterValue);
			const preFilteredRows = writable<BodyRow<Item>[]>([]);
			const tableCellMatches = recordSetStore();

			const pluginState: TableFilterState<Item> = { filterValue, preFilteredRows };

			const deriveRows: DeriveRowsFn<Item> = (rows) => {
				return derived([rows, filterValue], ([$rows, $filterValue]) => {
					preFilteredRows.set($rows);
					tableCellMatches.clear();
					const $tableCellMatches: Record<string, boolean> = {};
					const $filteredRows = getFilteredRows($rows, $filterValue, columnOptions, {
						tableCellMatches: $tableCellMatches,
						fn,
						rowFn,
						includeHiddenColumns,
					});
					tableCellMatches.set($tableCellMatches);
					if (serverSide) {
						return $rows;
					}
					return $filteredRows;
				});
			};

			return {
				pluginState,
				deriveRows,
				hooks: {
					'tbody.tr.td': (cell) => {
						const props = derived(
							[filterValue, tableCellMatches],
							([$filterValue, $tableCellMatches]) => {
								const dataRowColId = cell.dataRowColId();
								return {
									matches:
										$filterValue !== '' &&
										dataRowColId !== undefined &&
										($tableCellMatches[dataRowColId] ?? false),
								};
							}
						);
						return { props };
					},
				},
			};
		};

export const textPrefixFilter: TableFilterFn = ({ filterValue, value }) => {
	if (filterValue === '') {
		return true;
	}
	return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
};
