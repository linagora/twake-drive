/**
 * x2t-wasm converter for converting between Office formats and OnlyOffice
 * internal .bin format.
 *
 * Uses CryptPad's build of OnlyOffice x2t compiled to WebAssembly.
 * The WASM module runs entirely in the browser — no server needed.
 */

let x2tModule = null

const FORMAT_CODES = {
  // Input formats
  docx: 65,
  xlsx: 257,
  pptx: 129,
  // Legacy formats
  doc: 69,
  xls: 258,
  ppt: 132,
  // Internal OnlyOffice binary (canvas / Editor.bin)
  doct: 8193, // 0x2001 — Editor.bin for word
  xlst: 8194, // 0x2002 — Editor.bin for cell
  pptt: 8195, // 0x2003 — Editor.bin for slide
  // Open Document formats
  odt: 67,
  ods: 259,
  odp: 130
}

const EXT_TO_DOC_TYPE = {
  docx: 'doct',
  doc: 'doct',
  odt: 'doct',
  xlsx: 'xlst',
  xls: 'xlst',
  ods: 'xlst',
  pptx: 'pptt',
  ppt: 'pptt',
  odp: 'pptt'
}

const DOC_TYPE_EXT = {
  doct: 'bin',
  xlst: 'bin',
  pptt: 'bin'
}

/**
 * Lazy-load and initialize the x2t WASM module.
 * The module is cached after first load.
 */
async function initX2T() {
  if (x2tModule) return x2tModule

  // x2t.js is served as a static asset from the vendor directory.
  // It's an Emscripten module that sets up a global `Module` variable.
  // We load it in an iframe to avoid polluting the main window scope.
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    document.body.appendChild(iframe)

    const iframeWindow = iframe.contentWindow

    // Set up Module config before loading the script
    iframeWindow.Module = {
      noInitialRun: true,
      noExitRuntime: true,
      onRuntimeInitialized: () => {
        const module = iframeWindow.Module
        // Set up virtual filesystem directories
        try {
          module.FS.mkdir('/working')
        } catch (e) {
          // Directory may already exist
        }
        try {
          module.FS.mkdir('/working/media')
        } catch (e) {
          // ignore
        }
        try {
          module.FS.mkdir('/working/fonts')
        } catch (e) {
          // ignore
        }

        x2tModule = { module, iframe }
        resolve(x2tModule)
      }
    }

    const script = iframeWindow.document.createElement('script')
    // Use a full absolute URL so x2t.js's `new URL(src)` call works.
    // x2t.js uses `new URL(document.currentScript.src).search` to locate
    // the companion .wasm file, which requires a fully qualified URL.
    script.src = new URL('/vendor/cryptpad-onlyoffice/x2t/x2t.js', window.location.origin).href
    script.onerror = () => {
      iframe.remove()
      reject(new Error('Failed to load x2t WASM module'))
    }
    iframeWindow.document.body.appendChild(script)
  })
}

/**
 * Build the XML params file that x2t expects for conversion.
 */
function buildParamsXML(inputPath, outputPath, inputFormat, outputFormat) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    `<m_sFileFrom>${inputPath}</m_sFileFrom>`,
    `<m_sFileTo>${outputPath}</m_sFileTo>`,
    `<m_nFormatFrom>${FORMAT_CODES[inputFormat]}</m_nFormatFrom>`,
    `<m_nFormatTo>${FORMAT_CODES[outputFormat]}</m_nFormatTo>`,
    '<m_bIsNoBase64>true</m_bIsNoBase64>',
    '<m_sThemeDir>/working/themes</m_sThemeDir>',
    '<m_sFontDir>/working/fonts</m_sFontDir>',
    '</TaskQueueDataConvert>'
  ].join('\n')
}

/**
 * Convert a file from one format to another using x2t WASM.
 *
 * @param {Uint8Array} inputData - The raw file bytes
 * @param {string} inputFormat - Source format (e.g. 'docx', 'xlsx', 'pptx')
 * @param {string} outputFormat - Target format (e.g. 'doct', 'xlst', 'pptt')
 * @returns {Promise<Uint8Array>} The converted file bytes
 */
export async function convert(inputData, inputFormat, outputFormat) {
  const { module } = await initX2T()

  // Use unique file paths per conversion to avoid race conditions
  const conversionId = Math.random().toString(36).substring(2, 10)
  const inputExt = DOC_TYPE_EXT[inputFormat] || inputFormat
  const outputExt = DOC_TYPE_EXT[outputFormat] || outputFormat
  const inputPath = `/working/input-${conversionId}.${inputExt}`
  const outputPath = `/working/output-${conversionId}.${outputExt}`
  const paramsPath = `/working/params-${conversionId}.xml`

  // Write input file to Emscripten virtual FS
  module.FS.writeFile(inputPath, inputData)

  // Write conversion params
  const params = buildParamsXML(inputPath, outputPath, inputFormat, outputFormat)
  module.FS.writeFile(paramsPath, params)

  // Run conversion
  const result = module.ccall('main1', 'number', ['string'], [paramsPath])

  if (result !== 0) {
    // Clean up
    try { module.FS.unlink(inputPath) } catch (e) { /* ignore */ }
    try { module.FS.unlink(paramsPath) } catch (e) { /* ignore */ }
    throw new Error(`x2t conversion failed with code ${result}`)
  }

  // Read output — copy to main frame to avoid cross-frame typed array issues
  const iframeOutput = module.FS.readFile(outputPath)
  const outputData = new Uint8Array(iframeOutput.length)
  outputData.set(iframeOutput)

  // Clean up virtual FS
  try { module.FS.unlink(inputPath) } catch (e) { /* ignore */ }
  try { module.FS.unlink(outputPath) } catch (e) { /* ignore */ }
  try { module.FS.unlink(paramsPath) } catch (e) { /* ignore */ }

  return outputData
}

/**
 * Convert an Office file (docx/xlsx/pptx) to OnlyOffice internal .bin format.
 *
 * @param {Uint8Array} fileData - Raw file bytes
 * @param {string} fileExt - File extension without dot (e.g. 'docx')
 * @returns {Promise<Uint8Array>} The .bin content
 */
export async function convertToInternal(fileData, fileExt) {
  const internalFormat = EXT_TO_DOC_TYPE[fileExt]
  if (!internalFormat) {
    throw new Error(`Unsupported file extension: ${fileExt}`)
  }
  return convert(fileData, fileExt, internalFormat)
}

/**
 * Convert from OnlyOffice internal .bin format back to an Office file.
 *
 * @param {Uint8Array} binData - The .bin content from editor
 * @param {string} targetExt - Target extension (e.g. 'docx', 'xlsx', 'pptx')
 * @returns {Promise<Uint8Array>} The converted file bytes
 */
export async function convertFromInternal(binData, targetExt) {
  const internalFormat = EXT_TO_DOC_TYPE[targetExt]
  if (!internalFormat) {
    throw new Error(`Unsupported target extension: ${targetExt}`)
  }
  return convert(binData, internalFormat, targetExt)
}

/**
 * Get the OnlyOffice document type from a file extension.
 *
 * @param {string} ext - File extension without dot
 * @returns {'word'|'cell'|'slide'} The documentType for DocEditor config
 */
export function getDocumentType(ext) {
  const map = {
    docx: 'word',
    doc: 'word',
    odt: 'word',
    xlsx: 'cell',
    xls: 'cell',
    ods: 'cell',
    pptx: 'slide',
    ppt: 'slide',
    odp: 'slide'
  }
  return map[ext] || 'word'
}

/**
 * Destroy the x2t module and clean up the iframe.
 */
export function destroyConverter() {
  if (x2tModule) {
    x2tModule.iframe.remove()
    x2tModule = null
  }
}
