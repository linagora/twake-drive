// lottie-web draws on a canvas at import time, which jsdom does not provide
// without node-canvas. Specs that need the mark (ScribeFloatingButton) override
// it with their own jest.mock.
const Lottie = () => null

export default Lottie
