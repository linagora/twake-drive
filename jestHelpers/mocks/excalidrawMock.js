// @excalidraw/excalidraw evaluates browser canvas APIs (Path2D, …) at import
// time, which jsdom does not provide. Tests never exercise the real editor, so
// every test gets these lightweight stubs instead. Specs that need specific
// behaviour (e.g. useSceneSync) override them with their own jest.mock.
export const Excalidraw = () => null
export const serializeAsJSON = () => '{}'
export const getSceneVersion = () => 0
