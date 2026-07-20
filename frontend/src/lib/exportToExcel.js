import * as XLSX from 'xlsx'

export function exportRecommendationsToExcel(items) {
  const rows = items.map((item) => ({
    'Company':  item.company  ?? '',
    'Price':    item.price    ?? '',
    'Phone':    item.phone    ?? '',
    'Email':    item.email    ?? '',
    'Website':  item.website  ?? '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Column widths
  worksheet['!cols'] = [
    { wch: 30 }, // Company
    { wch: 18 }, // Price
    { wch: 20 }, // Phone
    { wch: 32 }, // Email
    { wch: 36 }, // Website
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Recommendations')

  const timestamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `waddle-recommendations-${timestamp}.xlsx`)
}

// The comparison table as a spreadsheet — one row per supplier quote.
export function exportQuotesToExcel(rfq, quotes) {
  const rows = quotes.map((q) => ({
    'Supplier':      q.supplier      ?? '',
    'Channel':       q.channel       ?? '',
    'Price':         q.price         ?? '',
    'MOQ':           q.moq           ?? '',
    'Lead time':     q.leadTime      ?? '',
    'Payment terms': q.paymentTerms  ?? '',
    'Incoterm':      q.incoterm      ?? '',
    'Spec match':    q.specMatch     ?? '',
    'Notes':         q.specMatchNote ?? '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 26 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotes')

  const slug = (rfq?.product ?? 'rfq').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
  XLSX.writeFile(workbook, `waddle-${slug}-quotes.xlsx`)
}
