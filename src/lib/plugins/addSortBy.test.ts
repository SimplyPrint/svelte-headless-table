import {get, readable} from 'svelte/store'
import {createTable} from '../createTable'
import {addSortBy} from "./addSortBy"

const data = readable([
	{id: 1, createdAt: new Date(2023, 1, 1)},
	{id: 2, createdAt: new Date(1990, 1, 1)},
	{id: 3, createdAt: new Date(2025, 1, 1)},
	{id: 4, createdAt: new Date(2010, 1, 1)},
])

test('ascending date sort', () => {
	const table = createTable(data, {
		sort: addSortBy({initialSortKeys: [{id: "createdAt", order: "asc"}]})
	})
	const columns = table.createColumns([
		table.column({
			accessor: 'createdAt',
			header: 'Created At',
		}),
	])
	const vm = table.createViewModel(columns)
	const rows = get(vm.rows)
	const rowIds = rows.map(it => it.isData() && it.original.id)
	expect(rowIds).toStrictEqual([2, 4, 1, 3])
})

test('descending date sort', () => {
	const table = createTable(data, {
		sort: addSortBy({initialSortKeys: [{id: "createdAt", order: "desc"}]})
	})
	const columns = table.createColumns([
		table.column({
			accessor: 'createdAt',
			header: 'Created At',
		}),
	])
	const vm = table.createViewModel(columns)
	const rows = get(vm.rows)
	const rowIds = rows.map(it => it.isData() && it.original.id)
	expect(rowIds).toStrictEqual([3, 1, 4, 2])
})
