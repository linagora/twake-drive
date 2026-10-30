import { isSameGeometry, readGeometry } from './geometry'

const VIEWER = { left: 0, top: 0, width: 800, height: 600 }

const makeEditorWindow = ({ corners, viewer = VIEWER, hasEditor = true }) => ({
  editor: hasEditor
    ? { asc_GetSelectionBounds: corners ? () => corners : undefined }
    : undefined,
  document: {
    getElementById: id =>
      id === 'id_viewer' && viewer
        ? { getBoundingClientRect: () => ({ ...viewer, x: 0, y: 0 }) }
        : null
  }
})

describe('readGeometry', () => {
  it('gives the bounding box and the corners of the selection', () => {
    const corners = [
      [10, 20],
      [10, 40],
      [110, 20],
      [110, 40]
    ]

    expect(readGeometry(makeEditorWindow({ corners }), true)).toEqual({
      selection: {
        rect: { left: 10, top: 20, width: 100, height: 20, corners },
        hasText: true
      },
      viewer: VIEWER,
      page: null
    })
  })

  it('places the corners in the frame of the editor, from its viewer', () => {
    const viewer = { left: 59, top: 174, width: 1167, height: 465 }
    const corners = [
      [299, 95],
      [299, 110],
      [417, 95],
      [417, 110]
    ]

    expect(
      readGeometry(makeEditorWindow({ corners, viewer }), true).selection
    ).toEqual({
      rect: {
        left: 358,
        top: 269,
        width: 118,
        height: 15,
        corners: [
          [358, 269],
          [358, 284],
          [476, 269],
          [476, 284]
        ]
      },
      hasText: true
    })
  })

  it('gives null while the editor has no selection bounds', () => {
    const zeros = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ]

    expect(readGeometry(makeEditorWindow({ hasEditor: false }), true)).toEqual({
      selection: null,
      viewer: VIEWER,
      page: null
    })
    expect(readGeometry(makeEditorWindow({}), true).selection).toBe(null)
    expect(
      readGeometry(makeEditorWindow({ corners: zeros }), true).selection
    ).toBe(null)
  })

  it('gives null while the editor cannot read its selection', () => {
    const editorWindow = makeEditorWindow({})
    editorWindow.editor.asc_GetSelectionBounds = () => {
      throw new TypeError('no document')
    }

    expect(readGeometry(editorWindow, true).selection).toBe(null)
  })

  it('gives null for corners that are not pairs of numbers', () => {
    const corners = [[10], [10, 40], [110, 20, 0], [110, 40]]

    expect(readGeometry(makeEditorWindow({ corners }), true).selection).toBe(
      null
    )
  })

  it('keeps a selection that ends at the start of a paragraph', () => {
    // The end is the start of the next paragraph, where nothing is selected
    const corners = [
      [299, 95],
      [299, 110],
      [299, 110],
      [299, 110]
    ]

    expect(readGeometry(makeEditorWindow({ corners }), true).selection).toEqual(
      {
        rect: { left: 299, top: 95, width: 0, height: 15, corners },
        hasText: true
      }
    )
  })

  it('gives no selection for a cursor alone', () => {
    const cursor = [
      [356, 110],
      [356, 110],
      [356, 126],
      [356, 126]
    ]
    const corners = [
      [10, 20],
      [10, 40],
      [110, 20],
      [110, 40]
    ]

    expect(
      readGeometry(makeEditorWindow({ corners: cursor }), true).selection
    ).toBe(null)
    expect(readGeometry(makeEditorWindow({ corners }), false).selection).toBe(
      null
    )
  })

  it('gives no selection and no viewer without the viewer of the editor', () => {
    const corners = [
      [10, 20],
      [10, 40],
      [110, 20],
      [110, 40]
    ]

    expect(
      readGeometry(makeEditorWindow({ corners, viewer: null }), true)
    ).toEqual({ selection: null, viewer: null, page: null })
  })
})

describe('isSameGeometry', () => {
  const corners = [
    [10, 20],
    [10, 40],
    [110, 20],
    [110, 40]
  ]
  const reading = readGeometry(makeEditorWindow({ corners }), true)

  it('tells two readings apart by any number', () => {
    const again = readGeometry(makeEditorWindow({ corners }), true)
    const moved = readGeometry(
      makeEditorWindow({
        corners: [
          [10, 20],
          [10, 40],
          [110, 20],
          [111, 40]
        ]
      }),
      true
    )
    const resized = readGeometry(
      makeEditorWindow({ corners, viewer: { ...VIEWER, height: 599 } }),
      true
    )

    expect(isSameGeometry(reading, again)).toBe(true)
    expect(isSameGeometry(reading, moved)).toBe(false)
    expect(isSameGeometry(reading, resized)).toBe(false)
  })

  it('tells a reading from no reading and from no selection', () => {
    const cleared = readGeometry(makeEditorWindow({ corners }), false)

    expect(isSameGeometry(reading, null)).toBe(false)
    expect(isSameGeometry(null, reading)).toBe(false)
    expect(isSameGeometry(reading, cleared)).toBe(false)
    expect(isSameGeometry(cleared, { ...cleared })).toBe(true)
  })
})
