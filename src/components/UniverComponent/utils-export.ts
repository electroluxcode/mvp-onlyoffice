
import * as ExcelJS from 'exceljs'
import type { exportImportMode } from './types'


export async function jsonToBufferInExcel(snapshot: any): Promise<ArrayBuffer> {
	console.log('🚀 [Export] Starting Univer to Excel export')
	console.log('📊 [Export] Snapshot overview:', {
		snapshot: snapshot,
		sheetCount: snapshot.sheetOrder?.length || 0,
		hasStyles: !!snapshot.styles,
	})
	
	try {
		// 创建工作簿 -  Workbook.ts
		const workbook = new ExcelJS.Workbook()
		workbook.calcProperties.fullCalcOnLoad = true
		
		// 创建工作表 - EnhancedWorkSheet.ts
		createEnhancedWorksheet(workbook, snapshot)
		
		// 设置定义的名称
		setDefinedNames(workbook, snapshot.resources)
		
		// 生成 buffer
		const buffer = await workbook.xlsx.writeBuffer()
		
		console.log('✅ [Export] Export completed successfully')
		console.log('📦 [Export] Buffer size:', buffer.byteLength, 'bytes')
		
		return buffer as ArrayBuffer
	} catch (error) {
		console.error('❌ [Export] Export failed:', error)
		throw error
	}
}

/**
 * 创建增强的工作表
 * ref: univerimportexport/src/UniverToExcel/EnhancedWorkSheet.ts
 */
function createEnhancedWorksheet(workbook: ExcelJS.Workbook, snapshot: any): void {
	const { sheetOrder, sheets, styles, resources } = snapshot
	
	if (!sheetOrder || !Array.isArray(sheetOrder)) {
		console.warn('[EnhancedWorkSheet] No sheetOrder found in snapshot')
		return
	}
	
	console.log('📊 [EnhancedWorkSheet] Processing workbook with sheets:', sheetOrder)
	
	sheetOrder.forEach((sheetId: string) => {
		const sheet = sheets[sheetId]
		
		if (!sheet) {
			console.warn('⚠️ [EnhancedWorkSheet] Missing sheet data for ID:', sheetId)
			return
		}
		
		console.log('📋 [EnhancedWorkSheet] Creating sheet:', {
			id: sheetId,
			name: sheet.name,
			hasData: !!(sheet.cellData && Object.keys(sheet.cellData).length > 0)
		})
		
		// 创建工作表
		const worksheet = createWorksheetWithSettings(workbook, sheet)
		
		// 处理工作表结构（列宽、行高）
		processSheetStructure(worksheet, sheet)
		
		// 处理单元格数据
		processCellData(worksheet, sheet, styles, snapshot)
		
		// 处理合并单元格
		processMergedCells(worksheet, sheet.mergeData)
		
		// 导出所有资源（过滤器、验证等）
		exportAllResources(worksheet, sheetId, resources)
	})
}

/**
 * 创建工作表并设置基本属性
 */
function createWorksheetWithSettings(workbook: ExcelJS.Workbook, sheet: any): ExcelJS.Worksheet {
	const worksheet = workbook.addWorksheet(sheet.name || 'Sheet', {
		properties: {
			defaultRowHeight: sheet.defaultRowHeight ? sheet.defaultRowHeight * 0.75 : undefined,
			defaultColWidth: sheet.defaultColumnWidth ? sheet.defaultColumnWidth / 7.5 : undefined,
		},
		views: [{
			state: 'normal',
			showGridLines: true,
			zoomScale: sheet.zoomRatio ? sheet.zoomRatio * 100 : 100,
		}]
	})
	
	// 设置工作表隐藏状态
	if (sheet.hidden === 1) {
		worksheet.state = 'hidden'
	}
	
	// 设置标签颜色
	if (sheet.tabColor) {
		worksheet.properties.tabColor = { argb: convertColorToArgb(sheet.tabColor) }
	}
	
	return worksheet
}

/**
 * 处理工作表结构（列宽、行高）
 */
function processSheetStructure(worksheet: ExcelJS.Worksheet, sheet: any): void {
	// 设置列宽
	if (sheet.columnData) {
		for (const colIndex in sheet.columnData) {
			const colData = sheet.columnData[colIndex]
			const colNum = parseInt(colIndex) + 1 // ExcelJS uses 1-based
			
			const column = worksheet.getColumn(colNum)
			if (colData.w !== undefined) {
				column.width = colData.w / 7.5
			} else if (sheet.defaultColumnWidth) {
				column.width = sheet.defaultColumnWidth / 7.5
			}
			
			if (colData.hd === 1) {
				column.hidden = true
			}
		}
	}
	
	// 设置行高
	if (sheet.rowData) {
		for (const rowIndex in sheet.rowData) {
			const rowData = sheet.rowData[rowIndex]
			const rowNum = parseInt(rowIndex) + 1 // ExcelJS uses 1-based
			
			const row = worksheet.getRow(rowNum)
			if (rowData.h !== undefined) {
				row.height = rowData.h * 0.75
			} else if (sheet.defaultRowHeight) {
				row.height = sheet.defaultRowHeight * 0.75
			}
			
			if (rowData.hd === 1) {
				row.hidden = true
			}
		}
	}
}

/**
 * 处理所有单元格数据
 */
function processCellData(worksheet: ExcelJS.Worksheet, sheet: any, styles: any, snapshot: any): void {
	const { cellData } = sheet
	
	if (!cellData || Object.keys(cellData).length === 0) {
		console.log('📄 [EnhancedWorkSheet] Processing empty sheet:', sheet.name)
		return
	}
	
	console.log('📊 [EnhancedWorkSheet] Processing cell data:', {
		sheetName: sheet.name,
		rowCount: Object.keys(cellData).length,
	})
	
	// 处理所有单元格
	for (const rowIndex in cellData) {
		const row = cellData[rowIndex]
		if (!row) continue
		
		for (const colIndex in row) {
			const cell = row[colIndex]
			if (!cell) continue
			
			const rowNum = parseInt(rowIndex) + 1
			const colNum = parseInt(colIndex) + 1
			
			processCell(worksheet, rowNum, colNum, cell, styles, snapshot)
		}
	}
}

/**
 * 处理单个单元格
 */
function processCell(
	worksheet: ExcelJS.Worksheet,
	row: number,
	col: number,
	cell: any,
	styles: any,
	snapshot: any
): void {
	const target = worksheet.getCell(row, col)
	
	// 处理富文本
	if (cell.p && cell.p.body) {
		target.value = convertUniverDocToExcelRichText(cell.p)
		console.log(`✅ [Export] Converted rich text for cell ${target.address}`)
	} 
	// 处理公式
	else if (cell.f) {
		const formula = cleanFormula(cell.f)
		if (formula) {
			target.value = {
				formula: formula,
				result: cell.v !== undefined ? cell.v : undefined
			}
		} else {
			target.value = convertCellValue(cell)
		}
	}
	// 处理普通值
	else {
		target.value = convertCellValue(cell)
	}
	
	// 应用单元格样式
	applyCellStyle(target, cell, styles)
	
	// 应用数字格式
	if (cell.t === 4) { // FORCE_STRING
		target.numFmt = '@'
	}
}

/**
 * 转换 Univer IDocumentData (富文本) 到 Excel 富文本
 */
function convertUniverDocToExcelRichText(doc: any): any {
	if (!doc || !doc.body) {
		return []
	}
	
	const { body } = doc
	const { dataStream, textRuns } = body
	
	if (!dataStream || !textRuns) {
		return []
	}
	
	const richTextParts: any[] = []
	
	for (const textRun of textRuns) {
		const { st, ed, ts } = textRun
		const text = dataStream.substring(st, ed)
		
		if (!text) continue
		
		const part: any = { text }
		
		if (ts) {
			const font: any = {}
			
			if (ts.ff) font.name = ts.ff
			if (ts.fs) font.size = ts.fs
			if (ts.cl) font.color = convertUniverColorToExcel(ts.cl)
			if (ts.bl === 1) font.bold = true
			if (ts.it === 1) font.italic = true
			if (ts.ul) font.underline = true
			if (ts.st) font.strike = true
			if (ts.va === 2) font.vertAlign = 'subscript'
			if (ts.va === 3) font.vertAlign = 'superscript'
			
			if (Object.keys(font).length > 0) {
				part.font = font
			}
		}
		
		richTextParts.push(part)
	}
	
	return richTextParts.length > 0 ? { richText: richTextParts } : ''
}

/**
 * 转换单元格值
 */
function convertCellValue(cell: any): any {
	if (!cell) return undefined
	
	const { v, t, p } = cell
	
	// 富文本优先
	if (p && p.body) {
		return convertUniverDocToExcelRichText(p)
	}
	
	// 根据类型处理
	switch (t) {
		case 1: // STRING
			return String(v ?? '')
		case 2: // NUMBER
			return typeof v === 'number' ? v : Number(v)
		case 3: // BOOLEAN
			return v === 1 || v === '1' || v === true
		case 4: // FORCE_STRING
			return String(v ?? '')
		default:
			if (v === null || v === undefined) {
				return ''
			}
			if (typeof v === 'boolean') {
				return v
			}
			if (typeof v === 'number' || !isNaN(Number(v))) {
				return Number(v)
			}
			return String(v)
	}
}

/**
 * 应用单元格样式
 */
function applyCellStyle(target: ExcelJS.Cell, cell: any, styles: any): void {
	if (!cell.s) return
	
	// 解析样式
	const style = typeof cell.s === 'string' ? styles[cell.s] : cell.s
	if (!style) return
	
	// 字体样式
	if (style.ff || style.fs || style.cl || style.bl !== undefined || style.it !== undefined) {
		target.font = {
			name: style.ff,
			size: style.fs,
			color: style.cl ? convertUniverColorToExcel(style.cl) : undefined,
			bold: style.bl === 1,
			italic: style.it === 1,
			underline: style.ul ? true : undefined,
			strike: style.st ? true : undefined
		}
	}
	
	// 背景色
	if (style.bg) {
		target.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: convertUniverColorToExcel(style.bg)
		}
	}
	
	// 边框
	if (style.bd) {
		target.border = convertBorderToExcel(style.bd)
	}
	
	// 对齐
	// const alignment = convertAlignmentToExcel(style)
	// if (alignment) {
	// 	target.alignment = alignment
	// }
	
	// 数字格式
	if (style.n && style.n.pattern) {
		target.numFmt = style.n.pattern
	}
}

/**
 * 转换 Univer 颜色到 Excel 格式
 */
function convertUniverColorToExcel(color: any): any {
	if (!color) return undefined
	
	if (typeof color === 'string') {
		const rgb = color.replace('#', '')
		return { argb: 'FF' + rgb.toUpperCase() }
	}
	
	if (color.rgb) {
		const rgb = color.rgb.replace('#', '')
		return { argb: 'FF' + rgb.toUpperCase() }
	}
	
	if (color.theme !== undefined) {
		return { theme: color.theme }
	}
	
	return undefined
}

/**
 * 转换颜色到 ARGB 字符串
 */
function convertColorToArgb(color: any): string {
	if (typeof color === 'string') {
		return 'FF' + color.replace('#', '').toUpperCase()
	}
	if (color.rgb) {
		return 'FF' + color.rgb.replace('#', '').toUpperCase()
	}
	return 'FF000000'
}

/**
 * 转换边框到 Excel 格式
 */
function convertBorderToExcel(border: any): any {
	if (!border) return undefined
	
	const excelBorder: any = {}
	
	const positions: { [key: string]: string } = {
		t: 'top',
		b: 'bottom',
		l: 'left',
		r: 'right'
	}
	
	for (const [univerPos, excelPos] of Object.entries(positions)) {
		if (border[univerPos]) {
			const b = border[univerPos]
			excelBorder[excelPos] = {
				style: convertBorderStyle(b.s),
				color: convertUniverColorToExcel(b.cl)
			}
		}
	}
	
	return Object.keys(excelBorder).length > 0 ? excelBorder : undefined
}

/**
 * 转换边框样式
 */
function convertBorderStyle(styleNum: number): string {
	const styleMap: { [key: number]: string } = {
		0: 'thin',
		1: 'thin',
		2: 'hair',
		3: 'dotted',
		4: 'dashed',
		5: 'dashDot',
		6: 'dashDotDot',
		7: 'double',
		8: 'medium',
		9: 'mediumDashed',
		10: 'mediumDashDot',
		11: 'mediumDashDotDot',
		12: 'slantDashDot',
		13: 'thick'
	}
	
	return styleMap[styleNum] || 'thin'
}

/**
 * 转换对齐到 Excel 格式
 * 
 * Univer 使用枚举值：
 * HorizontalAlign: UNSPECIFIED=0, LEFT=1, CENTER=2, RIGHT=3, JUSTIFIED=4
 * VerticalAlign: UNSPECIFIED=0, TOP=1, MIDDLE=2, BOTTOM=3
 */
function convertAlignmentToExcel(style: any): any {
	if (!style) return undefined
	
	const alignment: any = {}
	
	// 水平对齐 - 使用 Univer 枚举值映射
	if (style.ht !== undefined) {
		const hMap: { [key: number]: string } = {
			0: undefined,   // UNSPECIFIED - 不设置，使用 Excel 默认
			1: 'left',      // LEFT
			2: 'center',    // CENTER
			3: 'right',     // RIGHT
			4: 'justify'    // JUSTIFIED
		}
		const mapped = hMap[style.ht]
		if (mapped) {
			alignment.horizontal = mapped
		}
	}
	
	// 垂直对齐 - 使用 Univer 枚举值映射
	if (style.vt !== undefined) {
		const vMap: { [key: number]: string } = {
			0: undefined,   // UNSPECIFIED - 不设置，使用 Excel 默认
			1: 'top',       // TOP
			2: 'middle',    // MIDDLE
			3: 'bottom'     // BOTTOM
		}
		const mapped = vMap[style.vt]
		if (mapped) {
			alignment.vertical = mapped
		}
	}
	
	// 文本换行 (WrapStrategy.WRAP = 3)
	if (style.tb === 3) {
		alignment.wrapText = true
	}
	
	// 文本旋转
	if (style.tr) {
		if (style.tr.v === 1) {
			alignment.textRotation = 90
		} else if (style.tr.a !== undefined) {
			alignment.textRotation = style.tr.a
		}
	}
	
	// 缩进
	if (style.pd && style.pd.l) {
		alignment.indent = style.pd.l
	}
	
	return Object.keys(alignment).length > 0 ? alignment : undefined
}

/**
 * 处理合并单元格
 */
function processMergedCells(worksheet: ExcelJS.Worksheet, mergeData: any[]): void {
	if (!mergeData || !Array.isArray(mergeData)) return
	
	for (const merge of mergeData) {
		if (merge.startRow !== undefined && 
			merge.startColumn !== undefined && 
			merge.endRow !== undefined && 
			merge.endColumn !== undefined) {
			
			worksheet.mergeCells(
				merge.startRow + 1,
				merge.startColumn + 1,
				merge.endRow + 1,
				merge.endColumn + 1
			)
			
			console.log('🔗 [Export] Merged cells:', {
				from: `R${merge.startRow + 1}C${merge.startColumn + 1}`,
				to: `R${merge.endRow + 1}C${merge.endColumn + 1}`
			})
		}
	}
}

/**
 * 导出所有资源（过滤器、验证等）
 */
function exportAllResources(worksheet: ExcelJS.Worksheet, sheetId: string, resources: any[]): void {
	if (!resources || !Array.isArray(resources)) return
	
	// 这里可以添加过滤器、数据验证等资源的处理
	// 参考项目中有详细的实现，但为了简洁，这里先跳过
}

/**
 * 设置定义的名称
 */
function setDefinedNames(workbook: ExcelJS.Workbook, resources: any[]): void {
	if (!resources || !Array.isArray(resources)) return
	
	const definedNamesResource = resources.find((d: any) => d.name === 'SHEET_DEFINED_NAME_PLUGIN')
	if (!definedNamesResource) return
	
	try {
		const definedNames = JSON.parse(definedNamesResource.data || '{}')
		
		for (const key in definedNames) {
			const element = definedNames[key]
			if (!element || !element.name || !element.formulaOrRefString) {
				continue
			}
			
			let cleanFormula = element.formulaOrRefString
			if (cleanFormula.startsWith('=')) {
				cleanFormula = cleanFormula.substring(1)
			}
			
			workbook.definedNames.add(element.name, cleanFormula)
			console.log('📌 [Export] Added defined name:', element.name)
		}
	} catch (error) {
		console.error('❌ [Export] Error setting defined names:', error)
	}
}

/**
 * 清理公式
 */
function cleanFormula(formula: string): string {
	if (!formula) return ''
	
	// 移除前导的 =
	let cleaned = formula.trim()
	if (cleaned.startsWith('=')) {
		cleaned = cleaned.substring(1)
	}
	
	return cleaned
}

/**
 * 转换 Univer snapshot 到 Excel 并下载
 */
export async function transformUniverToExcel(params: {
	mode: exportImportMode
	snapshot: any
	fileName?: string
	success?: () => void
	error?: (err: Error) => void
}): Promise<void> {
	const { mode, snapshot, fileName, success, error } = params
	
	try {
		let buffer = null
		if(mode === "buffer"){
			buffer = snapshot
		}else{
			buffer = await jsonToBufferInExcel(snapshot)
		}
		
		// 下载文件
		const link = document.createElement('a')
		const blob = new Blob([buffer], { 
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
		})

		const url = URL.createObjectURL(blob)
		link.href = url
		link.download = fileName || `excel_${new Date().getTime()}.xlsx`
		document.body.appendChild(link)
		link.click()

		link.addEventListener('click', () => {
			link.remove()
			setTimeout(() => {
				URL.revokeObjectURL(url)
			}, 200)
		})
		
		success?.()
	} catch (err) {
		console.error('[transformUniverToExcel] 导出失败:', err)
		error?.(err as Error)
		throw err
	}
}

