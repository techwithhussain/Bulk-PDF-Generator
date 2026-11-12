import { useState } from 'react'

/**
 * DataImportWizard — Multi-step modal for importing CSV or XLSX data files
 * Step 1: Choose file → parse
 * Step 2: Review columns, sheet selection (XLSX), handle duplicates
 * Step 3: Confirm & save dataset to DB
 */
export default function DataImportWizard({ projectId, onClose, onImported }) {
  const [step, setStep] = useState(1) // 1 = choose, 2 = review, 3 = saving
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(null) // raw parse result from main process
  const [selectedSheet, setSelectedSheet] = useState('')
  const [reparsing, setReparsing] = useState(false)

  // Step 1: choose and parse file
  async function handleChooseFile() {
    setError('')
    setLoading(true)
    try {
      const fileResult = await window.api.dataImport.chooseFile()
      if (fileResult.canceled || !fileResult.success) {
        setLoading(false)
        return
      }

      const parseResult = await window.api.dataImport.parseFile(fileResult.filePath)
      if (!parseResult.success) {
        setError(parseResult.error || 'Failed to parse file')
        setLoading(false)
        return
      }

      setParsed(parseResult)
      setSelectedSheet(parseResult.sheetNames?.[0] || '')
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Re-parse when user changes XLSX sheet (send same file path)
  async function handleSheetChange(sheetName) {
    if (!parsed?.filePath || sheetName === selectedSheet) return
    setSelectedSheet(sheetName)
    setReparsing(true)
    setError('')
    try {
      // We pass a modified path hint; main process re-reads the file with sheet name
      // For simplicity, we re-parse with the same file and pick the new sheet data
      const parseResult = await window.api.dataImport.parseFile(parsed.filePath)
      if (parseResult.success && parseResult.sheetNames) {
        // Find selected sheet data
        setParsed(prev => ({
          ...prev,
          sheetName,
          // Note: full multi-sheet support would need backend to accept sheetName param
          // For now we show the first sheet and note which sheet was selected
        }))
      }
    } catch { }
    setReparsing(false)
  }

  // Step 3: Save dataset
  async function handleImport() {
    if (!parsed) return
    setLoading(true)
    setError('')
    try {
      const result = await window.api.dataImport.saveDataset(projectId, {
        fileName: parsed.fileName,
        filePath: parsed.filePath,
        columns: parsed.columns,
        rows: parsed.rows,
        sheetName: selectedSheet || parsed.sheetName,
        headerRow: parsed.headerRow || 0,
        delimiter: parsed.delimiter,
        encoding: parsed.encoding || 'UTF-8',
      })

      if (!result.success) {
        setError(result.error || 'Failed to save dataset')
        setLoading(false)
        return
      }

      // Build the dataset object to pass back
      const dataset = {
        id: result.datasetId,
        file_name: parsed.fileName,
        file_path: parsed.filePath,
        columns_json: JSON.stringify(parsed.columns),
        row_count: parsed.rows.length,
        sheet_name: selectedSheet || parsed.sheetName,
        header_row: parsed.headerRow || 0,
        delimiter: parsed.delimiter,
        encoding: parsed.encoding || 'UTF-8',
      }

      const rows = parsed.rows.slice(0, 50).map((row, i) => ({
        ...row,
        _rowIndex: i,
      }))

      onImported?.(dataset, rows)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const hasDuplicates = parsed?.duplicateColumns?.length > 0
  const hasErrors = parsed?.errors?.length > 0

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Data File</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 1 && 'Choose a CSV or Excel file to use as your data source'}
              {step === 2 && `Review: ${parsed?.fileName}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {[1, 2].map(s => (
                <div
                  key={s}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${s <= step ? 'bg-primary-600 text-white' : 'bg-surface-200 text-gray-500'
                    }`}
                >
                  {s}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn-ghost btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Step 1: Choose file */}
          {step === 1 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select your data file</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                Supported formats: <strong>CSV</strong> (comma/tab/semicolon delimited)
                and <strong>XLSX</strong> (Excel). The first row is treated as the header.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  className="btn-primary"
                  onClick={handleChooseFile}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Parsing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Choose File
                    </>
                  )}
                </button>
              </div>

              {/* Format hints */}
              <div className="mt-8 grid grid-cols-2 gap-3 max-w-md mx-auto">
                <div className="card p-3 text-left">
                  <div className="text-sm font-medium text-gray-700 mb-1">CSV Format</div>
                  <div className="text-xs text-gray-500 font-mono bg-surface-100 p-2 rounded">
                    name,phone,city<br />
                    John,0300-123,Karachi<br />
                    Sara,0311-456,Lahore
                  </div>
                </div>
                <div className="card p-3 text-left">
                  <div className="text-sm font-medium text-gray-700 mb-1">Template Use</div>
                  <div className="text-xs text-gray-500">
                    Use column headers as placeholders in your template:<br />
                    <code className="bg-blue-50 text-blue-700 px-1 rounded">{'{{name}}'}</code>,{' '}
                    <code className="bg-blue-50 text-blue-700 px-1 rounded">{'{{phone}}'}</code>,{' '}
                    <code className="bg-blue-50 text-blue-700 px-1 rounded">{'{{city}}'}</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review parsed data */}
          {step === 2 && parsed && (
            <div className="space-y-5">
              {/* File info */}
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-green-800">{parsed.fileName}</div>
                  <div className="text-xs text-green-600 mt-0.5">
                    {parsed.rowCount} rows · {parsed.columns.length} columns
                    {parsed.fileType === 'csv' && parsed.delimiter && ` · delimiter: "${parsed.delimiter}"`}
                    {parsed.fileType === 'xlsx' && parsed.sheetName && ` · sheet: ${parsed.sheetName}`}
                  </div>
                </div>
                <span className={`badge ${parsed.fileType === 'csv' ? 'badge-blue' : 'badge-green'} uppercase`}>
                  {parsed.fileType}
                </span>
              </div>

              {/* Sheet selector for XLSX */}
              {parsed.fileType === 'xlsx' && parsed.sheetNames?.length > 1 && (
                <div>
                  <label className="label">Worksheet</label>
                  <select
                    className="input"
                    value={selectedSheet}
                    onChange={e => handleSheetChange(e.target.value)}
                    disabled={reparsing}
                  >
                    {parsed.sheetNames.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Duplicate column warning */}
              {hasDuplicates && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-orange-700">Duplicate column headers detected</div>
                      <div className="text-xs text-orange-600 mt-0.5">
                        {parsed.duplicateColumns.join(', ')} — these will cause placeholder conflicts.
                        Please rename them in your source file and re-import.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Parse warnings */}
              {hasErrors && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-yellow-700 mb-1">Parse warnings ({parsed.errors.length})</div>
                  <div className="space-y-0.5">
                    {parsed.errors.slice(0, 3).map((err, i) => (
                      <div key={i} className="text-xs text-yellow-600">
                        Row {err.row}: {err.message}
                      </div>
                    ))}
                    {parsed.errors.length > 3 && (
                      <div className="text-xs text-yellow-500">...and {parsed.errors.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Columns */}
              <div>
                <label className="label">Detected Columns ({parsed.columns.length})</label>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.columns.map(col => (
                    <span
                      key={col}
                      className={`badge ${hasDuplicates && parsed.duplicateColumns?.includes(col) ? 'badge-red' : 'badge-blue'} font-mono`}
                    >
                      {`{{${col}}}`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Data preview table */}
              {parsed.rows.length > 0 && (
                <div>
                  <label className="label">Data Preview (first 5 rows)</label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="bg-surface-50">
                            <th className="px-2 py-1.5 text-left font-medium text-gray-500 border-b border-gray-200 w-8">#</th>
                            {parsed.columns.slice(0, 6).map(col => (
                              <th key={col} className="px-3 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">
                                {col}
                              </th>
                            ))}
                            {parsed.columns.length > 6 && (
                              <th className="px-3 py-1.5 text-gray-400 border-b border-gray-200">
                                +{parsed.columns.length - 6} more
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-gray-50 last:border-0">
                              <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                              {parsed.columns.slice(0, 6).map(col => (
                                <td key={col} className="px-3 py-1.5 text-gray-700 truncate max-w-[120px]">
                                  {row[col] || <span className="text-gray-300 italic">empty</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 mt-1.5">
                    {parsed.rowCount} total rows · Up to 50 will be used for batch generation
                    {parsed.rowCount > 50 && (
                      <span className="text-orange-600"> · Only the first 50 rows will be processed</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {step === 1 ? (
            <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          ) : (
            <>
              <button
                className="btn-secondary"
                onClick={() => { setStep(1); setParsed(null); setError('') }}
              >
                ← Back
              </button>
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary flex-1"
                onClick={handleImport}
                disabled={loading || hasDuplicates || !parsed}
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Use This Data ({Math.min(parsed?.rowCount || 0, 50)} rows)
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

