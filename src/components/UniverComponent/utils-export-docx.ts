/**
 * Docx 导出工具
 * 将 Univer 文档数据转换为 .docx 格式
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } from 'docx'
import type { IDocumentData } from '@univerjs/core'
import type { exportImportMode } from './types'

/**
 * 将 Univer 文档数据转换为 Docx Buffer
 */
export async function jsonToBufferInDocx(docData: Partial<IDocumentData>): Promise<ArrayBuffer> {
	console.log('🚀 [Export Docx] 开始将文档数据转换为 Buffer', docData)
	
	try {
		// 转换为 docx 文档
		const doc = await convertUniverDocToDocx(docData)
		
		// 生成 buffer
		const buffer = await Packer.toBuffer(doc)
		
		console.log('✅ [Export Docx] Buffer 生成成功')
		console.log('📦 [Export Docx] Buffer 大小:', buffer.byteLength, 'bytes')
		
		return buffer as unknown as ArrayBuffer
	} catch (error) {
		console.error('❌ [Export Docx] Buffer 生成失败:', error)
		throw error
	}
}

/**
 * 转换 Univer 文档数据为 docx 并下载（支持 buffer 和 json 模式）
 */
export async function transformUniverToDocx(params: {
	mode: exportImportMode
	docData: any
	fileName?: string
	success?: () => void
	error?: (err: Error) => void
}): Promise<void> {
	const { mode, docData, fileName, success, error } = params
	
	try {
		let buffer = null
		if (mode === "buffer") {
			// Buffer 模式：docData 已经是 ArrayBuffer
			buffer = docData
		} else {
			// JSON 模式：需要转换为 buffer
			buffer = await jsonToBufferInDocx(docData)
		}
		
		// 下载文件
		const link = document.createElement('a')
		const blob = new Blob([buffer], { 
			type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=UTF-8' 
		})

		const url = URL.createObjectURL(blob)
		link.href = url
		link.download = fileName || `document_${new Date().getTime()}.docx`
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
		console.error('[transformUniverToDocx] 导出失败:', err)
		error?.(err as Error)
		throw err
	}
}

/**
 * 转换 Univer 文档数据为 docx 并下载
 */
export async function exportUniverToDocx(params: {
	docData: Partial<IDocumentData>
	fileName?: string
	success?: () => void
	error?: (err: Error) => void
}): Promise<void> {
	const { docData, fileName, success, error } = params

	try {
		console.log('🚀 [Export Docx] 开始导出文档', docData)

		// 转换为 docx 文档
		const doc = await convertUniverDocToDocx(docData)

		// 生成 blob
		const blob = await Packer.toBlob(doc)

		console.log('📦 [Export Docx] Blob 大小:', blob.size, 'bytes')

		// 下载文件
		const link = document.createElement('a')
		const url = URL.createObjectURL(blob)
		link.href = url
		link.download = fileName || `document_${new Date().getTime()}.docx`
		document.body.appendChild(link)
		link.click()

		// 清理
		setTimeout(() => {
			link.remove()
			URL.revokeObjectURL(url)
		}, 100)

		console.log('✅ [Export Docx] 文档导出成功')
		success?.()
	} catch (err) {
		console.error('❌ [Export Docx] 导出失败:', err)
		error?.(err as Error)
		throw err
	}
}

/**
 * 转换 Univer 文档数据为 docx 文档对象
 */
async function convertUniverDocToDocx(docData: Partial<IDocumentData>): Promise<Document> {
	const { body, documentStyle } = docData

	if (!body || !body.dataStream) {
		throw new Error('文档数据不完整')
	}

	const { dataStream, textRuns = [], paragraphs = [] } = body


	// 转换段落
	const docParagraphs = convertParagraphs(dataStream, textRuns, paragraphs)

	console.log('📝 [Export Docx] 转换了', docParagraphs.length, '个段落')

	// 创建文档
	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						size: {
							width: documentStyle?.pageSize?.width ? documentStyle.pageSize.width * 20 : 11906,
							height: documentStyle?.pageSize?.height ? documentStyle.pageSize.height * 20 : 16838,
						},
						margin: {
							top: (documentStyle?.marginTop || 72) * 20,
							bottom: (documentStyle?.marginBottom || 72) * 20,
							left: (documentStyle?.marginLeft || 90) * 20,
							right: (documentStyle?.marginRight || 90) * 20,
						},
					},
				},
				children: docParagraphs.length > 0 ? docParagraphs : [
					new Paragraph({
						children: [new TextRun('')],
					}),
				],
			},
		],
	})

	return doc
}

/**
 * 转换段落
 */
function convertParagraphs(
	dataStream: string,
	textRuns: any[],
	paragraphs: any[]
): Paragraph[] {
	const result: Paragraph[] = []

	console.log('🔄 [Export Docx] 开始转换段落...')
	console.log('📄 [Export Docx] dataStream:', dataStream)
	console.log('📋 [Export Docx] paragraphs:', paragraphs)
	console.log('🎨 [Export Docx] textRuns:', textRuns)

	// 如果没有段落信息，整个 dataStream 作为一个段落
	if (paragraphs.length === 0) {
		const text = dataStream.replace(/\r\n/g, '\n').trim()
		if (text) {
			result.push(
				new Paragraph({
					children: [new TextRun(text)],
				})
			)
		}
		return result
	}

	// Univer 的段落结构：paragraphs 数组存储每个段落的 startIndex
	// 需要按 startIndex 排序
	const sortedParagraphs = [...paragraphs].sort((a, b) => a.startIndex - b.startIndex)

	// Univer 的段落结构说明：
	// dataStream: "第一段\r第二段\r第三段\r\n"
	// - 中间段落用 \r 分隔，最后是 \r\n
	// - paragraphs[i].startIndex 指向该段落结尾的 \r 位置
	// - 段落文本范围：从上一个 \r 之后到当前 \r（不含 \r）
	
	// 重建段落范围
	const paragraphRanges: Array<{ start: number; end: number; style?: any }> = []
	
	if (sortedParagraphs.length === 0) {
		// 没有段落信息，整个文本作为一个段落
		paragraphRanges.push({ start: 0, end: dataStream.length })
	} else {
		// 第一个段落从 0 开始
		let prevStart = 0
		
		for (const para of sortedParagraphs) {
			const paraEnd = para.startIndex // 这是 \r 的位置
			
			paragraphRanges.push({
				start: prevStart,
				end: paraEnd, // 不包含 \r
				style: para.paragraphStyle
			})
			
			prevStart = paraEnd + 1 // 下一段从 \r 之后开始
		}
	}

	console.log('📋 [Export Docx] 段落范围:', paragraphRanges)

	// 处理每个段落
	for (let i = 0; i < paragraphRanges.length; i++) {
		const range = paragraphRanges[i]
		let startIndex = range.start
		const endIndex = range.end

		console.log(`📍 [Export Docx] 处理段落 ${i}:`, { startIndex, endIndex })

		// 提取段落文本
		let paraText = dataStream.substring(startIndex, endIndex)
		
		console.log(`📝 [Export Docx] 段落 ${i} 原始文本:`, JSON.stringify(paraText))

		// 去除结尾的换行符（最后一段可能有 \r\n）
		paraText = paraText.replace(/\r\n$/, '').replace(/\n$/, '')
		
		console.log(`📝 [Export Docx] 段落 ${i} 处理后文本:`, JSON.stringify(paraText))

		// 如果段落为空，跳过（但保留空段落以保持结构）
		if (!paraText && i < paragraphRanges.length - 1) {
			result.push(
				new Paragraph({
					children: [new TextRun('')],
				})
			)
			continue
		}

		// 如果是最后一个段落且为空，跳过
		if (!paraText && i === paragraphRanges.length - 1) {
			continue
		}

		// 获取该段落的所有 textRuns（带样式的文本片段）
		// 注意：textRun 可能跨越段落边界，只要有交集就包含
		const paraTextRuns = textRuns.filter(
			(tr) => {
				// textRun 与段落有交集：textRun 的结束在段落之后 且 textRun 的开始在段落之前
				const hasOverlap = tr.ed > startIndex && tr.st < endIndex
				console.log(`🔍 [Export Docx] 检查 textRun st=${tr.st}, ed=${tr.ed} 与段落 [${startIndex}, ${endIndex}) 是否有交集: ${hasOverlap}`)
				return hasOverlap
			}
		)

		console.log(`🎨 [Export Docx] 段落 ${i} 的 textRuns:`, paraTextRuns)

		// 转换为 docx TextRun
		let textRunElements: TextRun[] = []
		
		if (paraTextRuns.length > 0) {
			// 有样式信息，使用 textRuns
			textRunElements = convertTextRuns(paraText, paraTextRuns, startIndex)
		} else {
			// 没有样式信息，直接使用纯文本
			textRunElements = [new TextRun(paraText)]
		}

		// 获取段落样式
		const paragraphStyle = range.style || {}
		const alignment = getParagraphAlignment(paragraphStyle)
		const heading = getParagraphHeading(paragraphStyle)

		// 创建段落
		const paragraph = new Paragraph({
			children: textRunElements,
			...(alignment && { alignment }),
			...(heading && { heading }),
			spacing: {
				before: paragraphStyle.spaceAbove ? paragraphStyle.spaceAbove * 20 : 0,
				after: paragraphStyle.spaceBelow ? paragraphStyle.spaceBelow * 20 : 0,
				line: paragraphStyle.lineSpacing ? paragraphStyle.lineSpacing * 240 : undefined,
			},
			indent: {
				left: paragraphStyle.indentStart ? paragraphStyle.indentStart * 20 : 0,
				right: paragraphStyle.indentEnd ? paragraphStyle.indentEnd * 20 : 0,
				firstLine: paragraphStyle.indentFirstLine ? paragraphStyle.indentFirstLine * 20 : 0,
			},
		})

		result.push(paragraph)
	}

	console.log('✅ [Export Docx] 转换完成，共', result.length, '个段落')

	return result
}

/**
 * 转换文本运行（带样式的文本片段）
 */
function convertTextRuns(
	paraText: string,
	textRuns: any[],
	paraStartIndex: number
): TextRun[] {
	if (textRuns.length === 0) {
		return [new TextRun(paraText)]
	}

	const result: TextRun[] = []
	let lastEnd = 0

	// 按照 st 排序
	const sortedRuns = [...textRuns].sort((a, b) => a.st - b.st)

	console.log(`🎨 [convertTextRuns] paraText: "${paraText}", length: ${paraText.length}`)
	console.log(`🎨 [convertTextRuns] paraStartIndex: ${paraStartIndex}`)
	console.log(`🎨 [convertTextRuns] textRuns:`, sortedRuns)

	for (const textRun of sortedRuns) {
		const relativeStart = textRun.st - paraStartIndex
		const relativeEnd = textRun.ed - paraStartIndex
		
		console.log(`🎨 [convertTextRuns] textRun st=${textRun.st}, ed=${textRun.ed}`)
		console.log(`🎨 [convertTextRuns] relative: start=${relativeStart}, end=${relativeEnd}`)
		
		// 确保索引在有效范围内
		const start = Math.max(0, Math.min(relativeStart, paraText.length))
		const end = Math.max(0, Math.min(relativeEnd, paraText.length))
		
		console.log(`🎨 [convertTextRuns] adjusted: start=${start}, end=${end}`)
		
		// 如果前面有未处理的文本（无样式），先添加
		if (start > lastEnd) {
			const plainText = paraText.substring(lastEnd, start)
			console.log(`🎨 [convertTextRuns] 添加无样式文本: "${plainText}"`)
			result.push(new TextRun(plainText))
		}
		
		const text = paraText.substring(start, end)
		console.log(`🎨 [convertTextRuns] 提取的文本: "${text}"`)

		if (!text) continue

		const ts = textRun.ts || {}

		console.log(`🎨 [convertTextRuns] ts 对象:`, JSON.stringify(ts))
		console.log(`🎨 [convertTextRuns] ts.it =`, ts.it, `类型:`, typeof ts.it)
		console.log(`🎨 [convertTextRuns] ts.ul =`, ts.ul)

		const textRunOptions: any = {
			text,
		}

		// 字体样式
		if (ts.ff) textRunOptions.font = ts.ff
		if (ts.fs) textRunOptions.size = ts.fs * 2 // Word uses half-points
		if (ts.cl) {
			const color = convertColor(ts.cl)
			if (color) textRunOptions.color = color
		}

		// 文本装饰
		if (ts.bl === 1) {
			console.log(`🎨 [convertTextRuns] 设置粗体`)
			textRunOptions.bold = true
		}
		if (ts.it === 1) {
			console.log(`🎨 [convertTextRuns] 设置斜体`)
			textRunOptions.italics = true  // 注意：docx 库使用 'italics' 而不是 'italic'
		}
		if (ts.ul) {
			// 使用 docx 库的 UnderlineType 枚举
			textRunOptions.underline = {
				type: UnderlineType.SINGLE
			}
			console.log(`🎨 [convertTextRuns] 设置下划线: UnderlineType.SINGLE`)
		}
		// 删除线：Univer 的 ts.st 是对象 { s: 1 }
		if (ts.st && ts.st.s) {
			console.log(`🎨 [convertTextRuns] 设置删除线`)
			textRunOptions.strike = true
		}

		// 上下标：Univer 的 va 值
		// 1 = 上标 (superscript)
		// 2 = 下标 (subscript)  
		// 3 = 上标 (有些版本可能用3表示上标)
		if (ts.va === 1 || ts.va === 3) {
			console.log(`🎨 [convertTextRuns] 设置上标 va=${ts.va}`)
			textRunOptions.superScript = true
		}
		if (ts.va === 2) {
			console.log(`🎨 [convertTextRuns] 设置下标`)
			textRunOptions.subScript = true
		}

		// 背景颜色（高亮）
		if (ts.bg) {
			const highlight = convertColor(ts.bg)
			if (highlight) {
				console.log(`🎨 [convertTextRuns] 设置背景颜色: ${highlight}`)
				// docx 库的 TextRun 使用 shading 属性设置背景色
				// shading 需要完整的格式
				textRunOptions.shading = {
					fill: highlight,
					val: 'clear', // 或者 'clear', 'solid' 等
					color: 'auto'
				}
			}
		}
		
		console.log(`🎨 [convertTextRuns] textRunOptions:`, textRunOptions)

		result.push(new TextRun(textRunOptions))
		lastEnd = end
	}

	// 如果后面还有未处理的文本（无样式），添加
	if (lastEnd < paraText.length) {
		const plainText = paraText.substring(lastEnd)
		console.log(`🎨 [convertTextRuns] 添加末尾无样式文本: "${plainText}"`)
		result.push(new TextRun(plainText))
	}

	return result.length > 0 ? result : [new TextRun(paraText)]
}

/**
 * 获取段落对齐方式
 */
function getParagraphAlignment(style: any): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
	if (!style.horizontalAlign) return undefined

	const alignMap: { [key: number]: typeof AlignmentType[keyof typeof AlignmentType] } = {
		0: AlignmentType.LEFT,
		1: AlignmentType.LEFT,
		2: AlignmentType.CENTER,
		3: AlignmentType.RIGHT,
		4: AlignmentType.JUSTIFIED,
	}

	return alignMap[style.horizontalAlign]
}

/**
 * 获取段落标题级别
 */
function getParagraphHeading(style: any): any {
	if (style.namedStyleType === undefined || style.namedStyleType === null) return undefined

	console.log(`📋 [getParagraphHeading] namedStyleType:`, style.namedStyleType, `类型:`, typeof style.namedStyleType)

	// Univer 的 namedStyleType 是数字枚举
	// 0 = NORMAL (普通文本)
	// 1 = TITLE (标题)
	// 2 = HEADING1 (一级标题)
	// 3 = HEADING2 (二级标题)
	// 4 = HEADING3 (三级标题)
	// ...
	const headingMap: { [key: number]: any } = {
		1: HeadingLevel.TITLE,
		2: HeadingLevel.HEADING_1,
		3: HeadingLevel.HEADING_2,
		4: HeadingLevel.HEADING_3,
		5: HeadingLevel.HEADING_4,
		6: HeadingLevel.HEADING_5,
		7: HeadingLevel.HEADING_6,
	}

	const heading = headingMap[style.namedStyleType]
	console.log(`📋 [getParagraphHeading] 映射结果:`, heading)
	
	return heading
}

/**
 * 转换颜色
 */
function convertColor(color: any): string | undefined {
	if (!color) return undefined

	// 如果是字符串格式 "#RRGGBB"
	if (typeof color === 'string') {
		return color.replace('#', '').toUpperCase()
	}

	// 如果是对象格式 { rgb: "#RRGGBB" }
	if (color.rgb) {
		return color.rgb.replace('#', '').toUpperCase()
	}

	return undefined
}

