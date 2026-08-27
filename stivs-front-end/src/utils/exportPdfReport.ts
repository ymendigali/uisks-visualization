export interface PdfReportColumn {
	key: string;
	label: string;
}

export interface PdfReportOptions {
	title: string;
	fileNamePrefix: string;
	subtitleLines: string[];
	columns: PdfReportColumn[];
	rows: string[][];
}

export const exportPdfReport = async ({ title, fileNamePrefix, subtitleLines, columns, rows }: PdfReportOptions): Promise<void> => {
	const [{ default: JsPDF }, { default: autoTable }, { robotoRegularBase64, robotoBoldBase64 }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable'),
		import('../assets/fonts/robotoPdfFont'),
	]);

	const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

	// jsPDF's built-in fonts have no Cyrillic glyphs, so a Roboto TTF is embedded for correct rendering.
	doc.addFileToVFS('Roboto-Regular.ttf', robotoRegularBase64);
	doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
	doc.addFileToVFS('Roboto-Bold.ttf', robotoBoldBase64);
	doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

	const marginLeft = 32;
	let cursorY = 40;

	doc.setFont('Roboto', 'bold');
	doc.setFontSize(16);
	doc.text(title, marginLeft, cursorY);

	doc.setFont('Roboto', 'normal');
	doc.setFontSize(10);
	subtitleLines.forEach((line) => {
		cursorY += 16;
		doc.text(line, marginLeft, cursorY);
	});

	autoTable(doc, {
		startY: cursorY + 14,
		head: [columns.map((column) => column.label)],
		body: rows,
		margin: { left: marginLeft, right: marginLeft },
		styles: { font: 'Roboto', fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
		headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [26, 43, 122], textColor: 255 },
		alternateRowStyles: { fillColor: [244, 246, 251] },
	});

	const fileDate = new Date().toISOString().slice(0, 10);
	doc.save(`${fileNamePrefix}-${fileDate}.pdf`);
};
